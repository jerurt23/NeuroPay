import React, { useEffect, useRef, useState } from 'react';
import { whenGoogle } from '../lib/googleScript';
import { API_CONFIGURED, exchangeGoogleCredential, type SessionUser } from '../lib/session';

interface LoginScreenProps {
  onLogin: (user: SessionUser) => void;
}

interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    auto_select?: boolean;
    callback: (response: { credential?: string }) => void;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const botonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID || !API_CONFIGURED) return;
    let cancelado = false;

    whenGoogle('id')
      .then(() => {
        if (cancelado || !botonRef.current) return;
        const id = (window as unknown as { google: { accounts: { id: GoogleIdApi } } }).google.accounts.id;
        id.initialize({
          client_id: CLIENT_ID,
          auto_select: false,
          callback: async (response) => {
            if (!response.credential) {
              setError('Google no devolvió la confirmación. Intenta de nuevo.');
              return;
            }
            setCargando(true);
            setError(null);
            try {
              onLogin(await exchangeGoogleCredential(response.credential));
            } catch (e) {
              setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
            } finally {
              setCargando(false);
            }
          },
        });
        id.renderButton(botonRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: 280,
          locale: 'es',
        });
      })
      .catch((e) => {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No se pudo cargar Google.');
      });

    return () => {
      cancelado = true;
    };
  }, [onLogin]);

  return (
    <div className="min-h-screen bg-[#f8f9fa] safe-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            N
          </div>
          <h1 className="text-2xl font-bold text-main">NEUROPAY</h1>
          <p className="text-sm text-muted mt-1">by Urteagaholding</p>
        </div>

        <div className="bg-white rounded-2xl border border-line p-6 space-y-4 text-center">
          <h2 className="text-lg font-bold text-main">Iniciar sesión</h2>
          <p className="text-sm text-muted">Entra con tu cuenta de Google.</p>

          {!API_CONFIGURED && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs">
              El servidor de NEUROPAY no está configurado.
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs">
              {error}
            </div>
          )}

          <div ref={botonRef} className="flex justify-center min-h-[44px]" />

          {cargando && <p className="text-xs text-muted">Entrando...</p>}

          <p className="text-xs text-muted">Usa siempre la misma cuenta para ver tus datos en todos tus dispositivos.</p>
        </div>
      </div>
    </div>
  );
};
