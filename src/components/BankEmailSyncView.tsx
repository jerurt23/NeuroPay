import React, { useState } from 'react';
import { 
 Mail, 
 RefreshCw, 
 CheckCircle2, 
 ArrowRight, 
 Sparkles, 
 ShieldCheck, 
 Plus, 
 Zap, 
 Bell, 
 ExternalLink,
 Sliders,
 DollarSign,
 AlertCircle
} from 'lucide-react';
import { BankEmail, Transaction } from '../types/index.ts';
import { parseBankEmail, createTransactionFromBankNotification } from '../utils/bankEmailParser.ts';

interface BankEmailSyncViewProps {
 bankEmails: BankEmail[];
 onImportEmailAsTransaction: (email: BankEmail, tx: Transaction) => void;
 onSimulateIncomingEmail: () => void;
 currencySymbol: string;
}

export const BankEmailSyncView: React.FC<BankEmailSyncViewProps> = ({
 bankEmails,
 onImportEmailAsTransaction,
 onSimulateIncomingEmail,
 currencySymbol,
}) => {
 const [pasteSender, setPasteSender] = useState('notificaciones@bbva.com');
 const [pasteSubject, setPasteSubject] = useState('Aviso de consumo con tarjeta Débito');
 const [pasteBody, setPasteBody] = useState('Has realizado una compra en UBER TRIP desde Miraflores hacia San Isidro por USD 16.80');
 const [isSyncing, setIsSyncing] = useState(false);
 const [successToast, setSuccessToast] = useState<string | null>(null);

 // Live preview of parsed pasted text
 const previewParsed = parseBankEmail(pasteSender, pasteSubject, pasteBody);

 const handleSyncInbox = () => {
 setIsSyncing(true);
 setTimeout(() => {
 setIsSyncing(false);
 onSimulateIncomingEmail();
 setSuccessToast('Sincronización con correo personal completada. Nueva alerta bancaria detectada.');
 setTimeout(() => setSuccessToast(null), 4000);
 }, 1200);
 };

 const handleImportParsed = () => {
 const tx = createTransactionFromBankNotification(previewParsed);
 const mockEmail: BankEmail = {
 id: `email_${Date.now()}`,
 bankName: previewParsed.bankName,
 senderEmail: previewParsed.senderEmail,
 subject: previewParsed.subject,
 bodySnippet: previewParsed.rawSnippet,
 parsedAmount: previewParsed.amount,
 parsedCurrency: previewParsed.currency,
 parsedDate: previewParsed.date,
 parsedMerchant: previewParsed.merchant,
 parsedCategory: previewParsed.category,
 status: 'synced',
 };

 onImportEmailAsTransaction(mockEmail, tx);
 setSuccessToast(`Movimiento de ${previewParsed.merchant} importado con éxito a la Red Neuronal.`);
 setTimeout(() => setSuccessToast(null), 3500);
 };

 const pendingEmails = bankEmails.filter((e) => e.status === 'pending');
 const syncedEmails = bankEmails.filter((e) => e.status === 'synced');

 return (
 <div className="space-y-5">
 {/* Hero Card */}
 <div className="p-5 sm:p-6 rounded-3xl ios-glass-card bg-gradient-to-tr from-indigo-600/10 via-blue-500/5 to-transparent border border-indigo-500/20">
 <div className="flex flex-wrap items-center justify-between gap-4">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center">
 <Mail className="w-6 h-6" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h2 className="text-lg font-bold text-main">
 Seguimiento Automático de Correos Bancarios
 </h2>
 <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
 E2EE Sync
 </span>
 </div>
 <p className="text-xs text-muted max-w-xl">
 Lee automáticamente los reportes y comprobantes de compras emitidos por bancas móviles (BBVA, BCP, Interbank, Nu, Santander, etc.) que llegan a tu bandeja de correo personal.
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={handleSyncInbox}
 disabled={isSyncing}
 className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50"
 >
 <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
 <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Correos Ahora'}</span>
 </button>

 <button
 type="button"
 onClick={onSimulateIncomingEmail}
 title="Simular nueva notificación entrante"
 className="px-3 py-2.5 rounded-2xl surface-input text-muted hover:bg-zinc-200:bg-zinc-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
 >
 <Bell className="w-4 h-4 text-amber-500 animate-bounce" />
 <span className="hidden sm:inline">Simular Alerta Push</span>
 </button>
 </div>
 </div>

 {successToast && (
 <div
 className="mt-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200"
 >
 <CheckCircle2 className="w-4 h-4" />
 <span>{successToast}</span>
 </div>
 )}
 </div>

 {/* Pending Approval Queue */}
 {pendingEmails.length > 0 && (
 <div className="p-5 rounded-3xl ios-glass-card space-y-3 border-amber-500/30 bg-amber-500/5">
 <div className="flex items-center justify-between">
 <h3 className="text-sm font-bold text-amber-700 flex items-center gap-2">
 <AlertCircle className="w-4 h-4 text-amber-500" />
 <span>Alertas Pendientes de Confirmar ({pendingEmails.length})</span>
 </h3>
 <span className="text-[11px] text-zinc-400">
 Detectadas en el correo personal
 </span>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {pendingEmails.map((email) => {
 const tx = createTransactionFromBankNotification({
 bankName: email.bankName,
 senderEmail: email.senderEmail,
 subject: email.subject,
 amount: email.parsedAmount,
 currency: email.parsedCurrency,
 merchant: email.parsedMerchant,
 type: 'expense',
 category: email.parsedCategory as any,
 date: email.parsedDate,
 confidence: 0.95,
 rawSnippet: email.bodySnippet,
 });

 return (
 <div
 key={email.id}
 className="p-4 rounded-2xl surface-card border border-line space-y-2.5 shadow-sm"
 >
 <div className="flex items-center justify-between">
 <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-bold">
 {email.bankName}
 </span>
 <span className="text-sm font-bold font-mono text-main">
 {email.parsedCurrency} {email.parsedAmount.toFixed(2)}
 </span>
 </div>

 <div>
 <h4 className="text-xs font-bold text-main">
 {email.parsedMerchant}
 </h4>
 <p className="text-[11px] text-muted line-clamp-2 mt-0.5">
 {email.bodySnippet}
 </p>
 </div>

 <div className="pt-1 flex items-center justify-between border-t border-line">
 <span className="text-[10px] text-zinc-400">
 Categoría detectada: <strong className="uppercase">{email.parsedCategory}</strong>
 </span>
 <button
 type="button"
 onClick={() => onImportEmailAsTransaction(email, tx)}
 className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
 >
 <span>Aprobar e Integrar</span>
 <ArrowRight className="w-3 h-3" />
 </button>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Manual Email Paste & Smart Extractor */}
 <div className="p-5 sm:p-6 rounded-3xl ios-glass-card space-y-4">
 <div className="flex items-center gap-2">
 <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
 <Sparkles className="w-5 h-5" />
 </div>
 <div>
 <h3 className="text-sm font-bold text-main">
 Analizador de Correo Bancario (Prueba en Vivo)
 </h3>
 <p className="text-xs text-muted">
 Pega cualquier extracto o notificación de correo para comprobar la extracción neural de montos, destinos y rubros.
 </p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <div>
 <label htmlFor="email-sender-input" className="text-[11px] font-semibold text-muted block mb-0.5">
 Remitente del Banco
 </label>
 <input
 id="email-sender-input"
 type="text"
 value={pasteSender}
 onChange={(e) => setPasteSender(e.target.value)}
 className="w-full px-3 py-2 rounded-xl surface-input text-xs text-muted border border-line"
 />
 </div>

 <div>
 <label htmlFor="email-subject-input" className="text-[11px] font-semibold text-muted block mb-0.5">
 Asunto del Correo
 </label>
 <input
 id="email-subject-input"
 type="text"
 value={pasteSubject}
 onChange={(e) => setPasteSubject(e.target.value)}
 className="w-full px-3 py-2 rounded-xl surface-input text-xs text-muted border border-line"
 />
 </div>

 <div>
 <label htmlFor="email-body-input" className="text-[11px] font-semibold text-muted block mb-0.5">
 Cuerpo o Notificación
 </label>
 <textarea
 id="email-body-input"
 rows={3}
 value={pasteBody}
 onChange={(e) => setPasteBody(e.target.value)}
 className="w-full px-3 py-2 rounded-xl surface-input text-xs text-muted border border-line"
 />
 </div>
 </div>

 {/* Live Extraction Preview */}
 <div className="p-4 rounded-2xl surface-card border border-line space-y-3 flex flex-col justify-between">
 <div>
 <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-2">
 Resultado de Extracción Neural
 </span>

 <div className="grid grid-cols-2 gap-2 text-xs">
 <div className="p-2 rounded-xl surface-input">
 <span className="text-[10px] text-zinc-400 block">Banco Reconocido</span>
 <span className="font-bold text-main">{previewParsed.bankName}</span>
 </div>
 <div className="p-2 rounded-xl surface-input">
 <span className="text-[10px] text-zinc-400 block">Monto Extraído</span>
 <span className="font-bold font-mono text-blue-600">
 {previewParsed.currency} {previewParsed.amount.toFixed(2)}
 </span>
 </div>
 <div className="p-2 rounded-xl surface-input">
 <span className="text-[10px] text-zinc-400 block">Comercio</span>
 <span className="font-bold text-main">{previewParsed.merchant}</span>
 </div>
 <div className="p-2 rounded-xl surface-input">
 <span className="text-[10px] text-zinc-400 block">Categoría Neural</span>
 <span className="font-bold uppercase text-emerald-600">{previewParsed.category}</span>
 </div>
 </div>

 {previewParsed.transportDetails && (
 <div className="mt-2 p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700">
 <strong>Ruta Detectada:</strong> {previewParsed.transportDetails.origin} -&gt; {previewParsed.transportDetails.destination}
 </div>
 )}
 </div>

 <button
 type="button"
 onClick={handleImportParsed}
 className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5"
 >
 <CheckCircle2 className="w-4 h-4" />
 <span>Incorporar como Movimiento Real a la Red</span>
 </button>
 </div>
 </div>
 </div>

 {/* History of Synced Emails */}
 <div className="p-5 rounded-3xl ios-glass-card space-y-3">
 <h3 className="text-sm font-bold text-main">
 Historial de Alertas de Correo Sincronizadas ({syncedEmails.length})
 </h3>
 <div className="divide-y divide-line">
 {syncedEmails.map((email) => (
 <div key={email.id} className="py-3 flex items-center justify-between gap-3">
 <div className="flex items-center gap-3 min-w-0">
 <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
 <CheckCircle2 className="w-4 h-4" />
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold text-main truncate">
 {email.parsedMerchant}
 </span>
 <span className="text-[10px] px-1.5 py-0.5 rounded-full surface-input text-muted font-medium">
 {email.bankName}
 </span>
 </div>
 <p className="text-[11px] text-muted truncate">
 {email.subject}
 </p>
 </div>
 </div>

 <div className="text-right flex-shrink-0 font-mono text-xs font-bold text-main">
 {email.parsedCurrency} {email.parsedAmount.toFixed(2)}
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
};
