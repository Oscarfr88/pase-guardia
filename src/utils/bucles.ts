// Detección de bucles de repetición en la salida del modelo (señal de alucinación).

/** ¿Hay un bucle? (el mismo grupo de 1 a 8 tokens repetido 5 veces o más seguidas) */
export function hayBucle(tokens: number[]): boolean {
  for (let n = 1; n <= 8; n++) {
    for (let i = 0; i + n * 5 <= tokens.length; i++) {
      let rep = 1;
      while (i + (rep + 1) * n <= tokens.length && tokens.slice(i + rep * n, i + (rep + 1) * n).every((t, k) => t === tokens[i + k])) rep++;
      if (rep >= 5) return true;
    }
  }
  return false;
}
