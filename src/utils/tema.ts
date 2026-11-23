// Preferencia de tema (claro/oscuro). Es lo único que se guarda fuera del
// almacenamiento cifrado: no es un dato clínico.
import { useEffect, useState } from 'react';

const CLAVE = 'pase-guardia:tema';

export function useTema(): [boolean, () => void] {
  const [oscuro, setOscuro] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CLAVE) !== 'claro';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', oscuro);
    try {
      localStorage.setItem(CLAVE, oscuro ? 'oscuro' : 'claro');
    } catch {
      /* almacenamiento no disponible */
    }
  }, [oscuro]);
  return [oscuro, () => setOscuro((o) => !o)];
}
