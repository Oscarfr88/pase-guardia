import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '../index.css';
import BenchApp from './BenchApp';
import { BenchProvider } from '../context/BenchContext';
import { impedirIframe, registrarServiceWorker } from '../utils/registroSW';

if (!impedirIframe()) {
  registrarServiceWorker();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BenchProvider>
        <BenchApp />
      </BenchProvider>
    </StrictMode>,
  );
}
