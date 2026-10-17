/**
 * Google Identity Services se carga desde index.html. Este módulo espera a que
 * la parte que pidas (inicio de sesión o código de Gmail) esté lista.
 */
export function whenGoogle(parte: 'id' | 'oauth2', timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const inicio = Date.now();
    const revisar = () => {
      const accounts = (window as unknown as { google?: { accounts?: Record<string, unknown> } }).google?.accounts;
      if (accounts?.[parte]) {
        resolve();
        return;
      }
      if (Date.now() - inicio > timeoutMs) {
        reject(new Error('No se pudo cargar Google. Revisa tu conexión.'));
        return;
      }
      window.setTimeout(revisar, 150);
    };
    revisar();
  });
}
