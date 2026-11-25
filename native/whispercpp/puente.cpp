// ============================================================
// Puente mínimo entre whisper.cpp y el worker de transcripción.
//
// El modelo llega en un búfer que el worker ya escribió en la memoria de
// WebAssembly (sin copia intermedia en JavaScript). La carga va en dos pasos
// para bajar el pico de memoria: pg_iniciar lee los pesos, el worker libera el
// búfer y recién entonces pg_crear_estado reserva la memoria de cálculo, que
// reutiliza ese espacio. Se transcribe en español,
// sin marcas de tiempo, con el prompt del diccionario como sesgo. Todo ocurre
// en el dispositivo: este código no hace E/S de red ni de archivos.
// Se compila con scripts/compilar-whispercpp.sh.
// ============================================================

#include "whisper.h"

#include <emscripten/emscripten.h>
#include <cstdio>
#include <string>

static whisper_context * g_ctx = nullptr;
static whisper_state * g_estado = nullptr;
static std::string g_texto;

// Solo los errores llegan a la consola; el resto del registro de whisper.cpp se descarta.
static void registro(enum ggml_log_level nivel, const char * texto, void *) {
    if (nivel == GGML_LOG_LEVEL_ERROR) fputs(texto, stderr);
}

extern "C" {

EMSCRIPTEN_KEEPALIVE void pg_liberar();

// Lee los pesos del modelo (formato ggml) ya cargado en `datos`, sin reservar todavía
// la memoria de cálculo. Devuelve 0 si salió bien. Después se puede liberar `datos`.
EMSCRIPTEN_KEEPALIVE int pg_iniciar(void * datos, size_t n) {
    whisper_log_set(registro, nullptr);
    pg_liberar();
    whisper_context_params cp = whisper_context_default_params();
    cp.use_gpu = false;
    g_ctx = whisper_init_from_buffer_with_params_no_state(datos, n, cp);
    return g_ctx ? 0 : 1;
}

// Reserva la memoria de cálculo (cachés y búferes intermedios). Devuelve 0 si salió bien.
EMSCRIPTEN_KEEPALIVE int pg_crear_estado() {
    if (!g_ctx) return 1;
    if (!g_estado) g_estado = whisper_init_state(g_ctx);
    return g_estado ? 0 : 1;
}

// Cantidad de tokens que ocupa un texto (para recortar el prompt).
EMSCRIPTEN_KEEPALIVE int pg_tokens(const char * texto) {
    return g_ctx ? whisper_token_count(g_ctx, texto) : -1;
}

// Transcribe `n` muestras a 16 kHz. Devuelve el texto (válido hasta la próxima llamada)
// o nullptr si falló.
EMSCRIPTEN_KEEPALIVE const char * pg_transcribir(const float * audio, int n, const char * prompt, int hilos) {
    if (!g_ctx || !g_estado) return nullptr;
    whisper_full_params p = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    p.n_threads        = hilos;
    p.language         = "es";
    p.detect_language  = false;
    p.translate        = false;
    p.no_context       = true;
    p.no_timestamps    = true;
    p.print_special    = false;
    p.print_progress   = false;
    p.print_realtime   = false;
    p.print_timestamps = false;
    p.suppress_blank   = true;
    p.suppress_nst     = true;
    p.initial_prompt   = (prompt && *prompt) ? prompt : nullptr;

    if (whisper_full_with_state(g_ctx, g_estado, p, audio, n) != 0) return nullptr;

    g_texto.clear();
    const int segmentos = whisper_full_n_segments_from_state(g_estado);
    for (int i = 0; i < segmentos; ++i) g_texto += whisper_full_get_segment_text_from_state(g_estado, i);
    return g_texto.c_str();
}

EMSCRIPTEN_KEEPALIVE void pg_liberar() {
    if (g_estado) { whisper_free_state(g_estado); g_estado = nullptr; }
    if (g_ctx) { whisper_free(g_ctx); g_ctx = nullptr; }
    g_texto.clear();
    g_texto.shrink_to_fit();
}

EMSCRIPTEN_KEEPALIVE const char * pg_sistema() {
    return whisper_print_system_info();
}

} // extern "C"
