import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

/**
 * Registra el service worker para que la app abra sin internet.
 * Solo en producción: en desarrollo el HMR de Vite entraría en conflicto.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => {
      // No es grave si falla: la app sigue funcionando con internet.
      console.warn('No se pudo registrar el service worker:', e);
    });
  });
}
