import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import App from './App';
import './index.css';
import { impedirIframe, registrarServiceWorker } from './utils/registroSW';

if (!impedirIframe()) {
  registrarServiceWorker();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
