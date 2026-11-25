#!/usr/bin/env bash
# ============================================================
# Compila whisper.cpp a WebAssembly (SIMD + hilos) junto con el puente de
# native/whispercpp/puente.cpp. Deja whisper.mjs y whisper.wasm en
# public/motores/whispercpp/, que se versionan (son chicos y así el deploy no
# necesita Emscripten). Van en public/ y no pasan por Vite porque los hilos de
# Emscripten se crean con new URL("whisper.mjs", import.meta.url): el archivo
# tiene que conservar su nombre.
#
# Versiones fijadas (cambiarlas es una decisión: hay que volver a medir):
#   whisper.cpp v1.9.5 (commit d1be6fde11ac6e0407606b4e42fe72d34add8037), licencia MIT
#   Emscripten 6.0.13
#
# Requisitos de desarrollo (no van al sitio): emsdk con 6.0.13 activado,
# Python ≥ 3.10 para Emscripten, cmake y ninja.
#   WHISPERCPP_SRC  carpeta de whisper.cpp (por defecto ~/.local/src/whisper.cpp)
#   EMSDK_DIR       carpeta de emsdk (por defecto ~/.local/emsdk)
#   EMSDK_PYTHON    Python ≥ 3.10 (por defecto ~/.local/python312/bin/python3 si existe)
# ============================================================
set -euo pipefail

WHISPER_TAG=v1.9.5
WHISPER_COMMIT=d1be6fde11ac6e0407606b4e42fe72d34add8037
EMSCRIPTEN=6.0.13

RAIZ=$(cd "$(dirname "$0")/.." && pwd)
FUENTES=${WHISPERCPP_SRC:-$HOME/.local/src/whisper.cpp}
EMSDK=${EMSDK_DIR:-$HOME/.local/emsdk}
SALIDA=$RAIZ/public/motores/whispercpp
OBRA=${TMPDIR:-/tmp}/pase-guardia-whispercpp

if [ -z "${EMSDK_PYTHON:-}" ] && [ -x "$HOME/.local/python312/bin/python3" ]; then
  export EMSDK_PYTHON="$HOME/.local/python312/bin/python3"
fi
command -v cmake >/dev/null || { echo "✘ Falta cmake"; exit 1; }
command -v ninja >/dev/null || { echo "✘ Falta ninja"; exit 1; }

if [ ! -d "$FUENTES/.git" ]; then
  git clone --depth 1 --branch "$WHISPER_TAG" https://github.com/ggml-org/whisper.cpp.git "$FUENTES"
fi
if [ "$(git -C "$FUENTES" rev-parse HEAD)" != "$WHISPER_COMMIT" ]; then
  echo "✘ $FUENTES no está en $WHISPER_TAG ($WHISPER_COMMIT)"; exit 1
fi

# shellcheck disable=SC1091
source "$EMSDK/emsdk_env.sh" >/dev/null 2>&1
emcc --version | head -1 | grep -q " $EMSCRIPTEN " || { echo "✘ Hace falta Emscripten $EMSCRIPTEN (emsdk activate $EMSCRIPTEN)"; exit 1; }

# EMSCRIPTEN_SYSTEM_PROCESSOR=wasm32: sin esto la cadena declara "x86", ggml no reconoce
# WASM y deja afuera su código SIMD para los pesos cuantizados (mucho más lento).
rm -rf "$OBRA"
emcmake cmake -S "$FUENTES" -B "$OBRA" -G Ninja \
  -DEMSCRIPTEN_SYSTEM_PROCESSOR=wasm32 \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=OFF \
  -DWHISPER_BUILD_EXAMPLES=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF \
  -DGGML_NATIVE=OFF -DGGML_OPENMP=OFF | grep -E "Wasm detected|Unknown CPU" || true
grep -q "arch/wasm/quants.c" "$OBRA/build.ninja" || { echo "✘ ggml no incluyó el código SIMD de WASM"; exit 1; }
cmake --build "$OBRA" --target whisper -j >/dev/null

mkdir -p "$SALIDA"
em++ -O3 -msimd128 -pthread -std=c++17 \
  -I"$FUENTES/include" -I"$FUENTES/ggml/include" \
  "$RAIZ/native/whispercpp/puente.cpp" \
  "$OBRA/src/libwhisper.a" "$OBRA/ggml/src/libggml.a" "$OBRA/ggml/src/libggml-cpu.a" "$OBRA/ggml/src/libggml-base.a" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=crearWhisper \
  -sENVIRONMENT=worker \
  -sPTHREAD_POOL_SIZE=4 \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB -sMAXIMUM_MEMORY=2GB \
  -sSTACK_SIZE=5MB \
  -sFILESYSTEM=0 \
  -sEXPORTED_FUNCTIONS=_malloc,_free,_pg_iniciar,_pg_crear_estado,_pg_tokens,_pg_transcribir,_pg_liberar,_pg_sistema \
  -sEXPORTED_RUNTIME_METHODS=HEAPU8,HEAPF32,UTF8ToString,stringToNewUTF8 \
  -o "$SALIDA/whisper.mjs"

cat > "$RAIZ/native/whispercpp/VERSION.txt" <<EOF
whisper.cpp $WHISPER_TAG ($WHISPER_COMMIT), licencia MIT
Emscripten $EMSCRIPTEN
Generado por scripts/compilar-whispercpp.sh
EOF
ls -l "$SALIDA"
