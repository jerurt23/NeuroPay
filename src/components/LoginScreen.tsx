import React, { useState } from 'react';
import { UserPlus, LogIn } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';

interface LoginScreenProps {
  onLogin: (user: { uid: string; displayName: string; email: string }) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleReset = async () => {
    setError(null);
    if (!email) {
      setError('Ingresa tu correo para restablecer la contrasena.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      setError('No se pudo enviar el correo de recuperacion.');
    } finally {
      setLoading(false);
    }
  };

  const friendlyError = (code?: string, message?: string) => {
    if (!code && !message) return 'Error de autenticacion.';
    const raw = `${code || ''} ${message || ''}`;
    if (raw.includes('invalid-credential') || raw.includes('wrong-password')) return 'Correo o contrasena incorrectos.';
    if (raw.includes('user-not-found') || raw.includes('EMAIL_NOT_FOUND')) return 'No existe una cuenta con ese correo.';
    if (raw.includes('email-already-in-use') || raw.includes('EMAIL_EXISTS')) return 'Este correo ya esta registrado. Usa Iniciar sesion.';
    if (raw.includes('operation-not-allowed') || raw.includes('OPERATION_NOT_ALLOWED')) return 'Habilita el metodo Email/Contrasena en Firebase Console -> Authentication -> Sign-in method.';
    if (raw.includes('invalid-email') || raw.includes('INVALID_EMAIL')) return 'El correo no es valido.';
    if (raw.includes('weak-password') || raw.includes('WEAK_PASSWORD')) return 'La contrasena es muy debil (minimo 6 caracteres).';
    if (raw.includes('missing-password') || raw.includes('MISSING_PASSWORD')) return 'Falta la contrasena.';
    if (raw.includes('too-many-requests')) return 'Demasiados intentos. Intenta mas tarde.';
    if (raw.includes('network-request-failed')) return 'Problema de red. Revisa tu conexion.';
    return code ? `Error de autenticacion (${code})` : 'Error de autenticacion.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
        onLogin({ uid: cred.user.uid, displayName: name.trim() || email.split('@')[0], email });
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        onLogin({ uid: cred.user.uid, displayName: cred.user.displayName || email.split('@')[0], email });
      }
    } catch (err: any) {
      console.error('firebase-auth', err);
      setError(friendlyError(err?.code, err?.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            N
          </div>
          <h1 className="text-2xl font-bold text-main">NEUROPAY</h1>
          <p className="text-sm text-muted mt-1">by Urteagaholding</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-line p-6 space-y-4">
          <h2 className="text-lg font-bold text-main">
            {isRegister ? 'Crear cuenta' : 'Iniciar sesion'}
          </h2>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs">
              {error}
            </div>
          )}

          {resetSent && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs text-center">
              Te enviamos un correo para restablecer la contrasena.
            </div>
          )}

          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre completo"
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-line text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-line text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Contrasena</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="........"
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-line text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              required
              minLength={6}
            />
          </div>

          {!isRegister && (
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="w-full text-center text-xs text-blue-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed mb-1"
            >
              Olvidaste tu contrasena?
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            {isRegister ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            {loading ? 'Procesando...' : isRegister ? 'Registrarme' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-4">
          {isRegister ? 'Ya tienes cuenta?' : 'No tienes cuenta?'}{' '}
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-blue-600 font-medium hover:underline"
          >
            {isRegister ? 'Inicia sesion' : 'Registrate'}
          </button>
        </p>
      </div>
    </div>
  );
};