import React, { useState } from 'react';
import { 
 Lock, 
 Unlock, 
 ScanFace, 
 Key, 
 ShieldCheck, 
 User, 
 Mail, 
 ArrowRight, 
 CheckCircle2, 
 X,
 Sparkles
} from 'lucide-react';

interface AuthModalProps {
 isOpen: boolean;
 onClose: () => void;
 onAuthenticate: (password: string, userName: string, userEmail: string) => void;
 currentUserName: string;
 currentUserEmail: string;
 isLocked: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
 isOpen,
 onClose,
 onAuthenticate,
 currentUserName,
 currentUserEmail,
 isLocked,
}) => {
 const [mode, setMode] = useState<'login' | 'register'>('login');
 const [userName, setUserName] = useState(currentUserName || 'Jeremy Urteaga');
 const [userEmail, setUserEmail] = useState(currentUserEmail || 'jeremyurteaga23@gmail.com');
 const [masterPassword, setMasterPassword] = useState('AppleSecure2026!');
 const [isBiometricScanning, setIsBiometricScanning] = useState(false);
 const [authSuccess, setAuthSuccess] = useState(false);

 if (!isOpen) return null;

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!masterPassword) return;

 setAuthSuccess(true);
 setTimeout(() => {
 onAuthenticate(masterPassword, userName, userEmail);
 setAuthSuccess(false);
 onClose();
 }, 600);
 };

 const handleSimulateFaceID = () => {
 setIsBiometricScanning(true);
 setTimeout(() => {
 setIsBiometricScanning(false);
 setAuthSuccess(true);
 setTimeout(() => {
 onAuthenticate(masterPassword, userName, userEmail);
 setAuthSuccess(false);
 onClose();
 }, 500);
 }, 1200);
 };

 return (
 <div className="fixed inset-0 z-50 safe-overlay flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl">
 <div
 className="w-full max-w-full sm:max-w-md surface-card border border-white/20 rounded-[32px] p-6 sm:p-7 shadow-2xl backdrop-blur-2xl relative animate-in fade-in zoom-in-95 duration-200"
 >
 <button
 type="button"
 onClick={onClose}
 className="absolute p-2 rounded-full text-zinc-400 hover:text-muted:text-zinc-200"
 style={{ top: 'calc(1.25rem + var(--safe-top))', right: 'calc(1.25rem + var(--safe-right))' }}
 >
 <X className="w-5 h-5" />
 </button>

 {/* Biometric FaceID Scanner Icon */}
 <div className="flex flex-col items-center text-center mb-6">
 <div className="relative mb-3">
 <div
 className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg transition-all ${
 authSuccess
 ? 'bg-emerald-500 text-white scale-110'
 : isBiometricScanning
 ? 'bg-blue-600 text-white animate-pulse scale-105'
 : 'surface-input text-blue-600'
 }`}
 >
 {authSuccess ? (
 <ShieldCheck className="w-8 h-8" />
 ) : isBiometricScanning ? (
 <ScanFace className="w-8 h-8" />
 ) : (
 <Lock className="w-8 h-8" />
 )}
 </div>
 </div>

 <h2 className="text-xl font-bold text-main">
 {isLocked ? 'Desbloquear Bóveda Financiera' : 'Autenticación y Registro E2EE'}
 </h2>
 <p className="text-xs text-muted mt-1 max-w-xs">
 Cifrado de grado militar con clave derivada de tu contraseña maestra.
 </p>
 </div>

 {/* Quick Face ID Simulation button */}
 <div className="mb-4">
 <button
 type="button"
 onClick={handleSimulateFaceID}
 disabled={isBiometricScanning}
 className="w-full py-3 px-4 rounded-2xl surface-input hover:bg-zinc-200:bg-zinc-700 text-muted font-semibold text-xs flex items-center justify-center gap-2 transition-all"
 >
 <ScanFace className="w-4 h-4 text-blue-500" />
 <span>{isBiometricScanning ? 'Escaneando rostro...' : 'Desbloquear con Face ID / Touch ID'}</span>
 </button>
 </div>

 <div className="relative flex py-2 items-center">
 <div className="flex-grow border-t border-line"></div>
 <span className="flex-shrink mx-3 text-[10px] uppercase font-bold text-zinc-400">
 o con Clave Maestra
 </span>
 <div className="flex-grow border-t border-line"></div>
 </div>

 {/* Form */}
 <form onSubmit={handleSubmit} className="space-y-3 mt-2">
 {mode === 'register' && (
 <div>
 <label className="text-[11px] font-semibold text-muted block mb-1">
 Nombre Completo
 </label>
 <div className="flex items-center gap-2 px-3 py-2 rounded-2xl surface-input border border-line">
 <User className="w-4 h-4 text-zinc-400" />
 <input
 type="text"
 required
 value={userName}
 onChange={(e) => setUserName(e.target.value)}
 className="w-full text-xs bg-transparent border-none text-main focus:outline-none"
 />
 </div>
 </div>
 )}

 <div>
 <label className="text-[11px] font-semibold text-muted block mb-1">
 Correo Electrónico (para vincular alertas bancarias)
 </label>
 <div className="flex items-center gap-2 px-3 py-2 rounded-2xl surface-input border border-line">
 <Mail className="w-4 h-4 text-zinc-400" />
 <input
 type="email"
 required
 value={userEmail}
 onChange={(e) => setUserEmail(e.target.value)}
 className="w-full text-xs bg-transparent border-none text-main focus:outline-none"
 />
 </div>
 </div>

 <div>
 <label className="text-[11px] font-semibold text-muted block mb-1">
 Clave Maestra E2EE (Desencriptación AES-256)
 </label>
 <div className="flex items-center gap-2 px-3 py-2 rounded-2xl surface-input border border-line">
 <Key className="w-4 h-4 text-zinc-400" />
 <input
 type="password"
 required
 value={masterPassword}
 onChange={(e) => setMasterPassword(e.target.value)}
 placeholder="Ingresa tu clave maestra..."
 className="w-full text-xs bg-transparent border-none text-main focus:outline-none font-mono"
 />
 </div>
 </div>

 <div className="pt-2">
 <button
 type="submit"
 className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
 >
 <span>{mode === 'login' ? 'Acceder y Desbloquear Bóveda' : 'Crear Cuenta y Generar Llaves E2EE'}</span>
 <ArrowRight className="w-4 h-4" />
 </button>
 </div>

 <div className="text-center pt-2">
 <button
 type="button"
 onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
 className="text-xs text-blue-600 hover:underline font-medium"
 >
 {mode === 'login'
 ? '¿No tienes cuenta? Regístrate aquí'
 : '¿Ya tienes cuenta? Inicia sesión'}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};
