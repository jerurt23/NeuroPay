import React, { useState } from 'react';
import { FileText, X, Lock } from 'lucide-react';
import type { Transaction } from '../types/index.ts';
import {
  ClaveIncorrecta,
  ClaveRequerida,
  gastosATransacciones,
  parsearEstadoCuenta,
  type ResultadoParseo,
} from '../lib/estadoCuenta.ts';

interface EstadoCuentaModalProps {
  open: boolean;
  onClose: () => void;
  existentes: Transaction[];
  currencySymbol: string;
  onConfirm: (movimientos: Transaction[]) => void;
}

type Resultado = Extract<ResultadoParseo, { ok: true }>;

const formato = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const diaMes = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

export const EstadoCuentaModal: React.FC<EstadoCuentaModalProps> = ({
  open,
  onClose,
  existentes,
  currencySymbol,
  onConfirm,
}) => {
  const [clave, setClave] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [pideClave, setPideClave] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [confirmando, setConfirmando] = useState(false);

  if (!open) return null;

  const reiniciar = () => {
    setClave('');
    setArchivo(null);
    setPideClave(false);
    setLeyendo(false);
    setError(null);
    setResultado(null);
    setMarcados(new Set());
    setConfirmando(false);
  };

  const cerrar = () => {
    reiniciar();
    onClose();
  };

  const procesar = async (f: File, contrasena?: string) => {
    setLeyendo(true);
    setError(null);
    try {
      const { leerItemsPdf } = await import('../lib/pdfTexto.ts');
      const paginas = await leerItemsPdf(f, contrasena);
      const r = parsearEstadoCuenta(paginas, existentes);
      if (!r.ok) {
        setError(r.error);
        setResultado(null);
        return;
      }
      setResultado(r);
      setMarcados(new Set(r.gastos.flatMap((g, i) => (g.posibleDuplicado ? [] : [i]))));
      setPideClave(false);
      setClave('');
    } catch (e) {
      if (e instanceof ClaveRequerida) {
        setPideClave(true);
      } else if (e instanceof ClaveIncorrecta) {
        setPideClave(true);
        setError(e.message);
      } else {
        setError('No pude leer el PDF. Revisa que sea un estado de cuenta.');
      }
    } finally {
      setLeyendo(false);
    }
  };

  const elegirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setArchivo(f);
    setResultado(null);
    void procesar(f);
  };

  const alternar = (i: number) =>
    setMarcados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(i)) siguiente.delete(i);
      else siguiente.add(i);
      return siguiente;
    });

  const seleccionados = resultado ? resultado.gastos.filter((_, i) => marcados.has(i)) : [];
  const totalSeleccionado = seleccionados.reduce((suma, g) => suma + g.monto, 0);
  const coincideConBanco =
    resultado?.controlBanco ? Math.abs(resultado.controlBanco.cargos - resultado.cargos) < 0.005 : null;
  const duplicados = resultado ? resultado.gastos.filter((g) => g.posibleDuplicado).length : 0;

  const subir = () => {
    onConfirm(gastosATransacciones(seleccionados, Date.now().toString(36)));
    cerrar();
  };

  return (
    <div
      className="fixed inset-0 z-50 safe-overlay flex items-center justify-center p-4 bg-white/40 backdrop-blur-2xl"
      onClick={cerrar}
    >
      <div
        className="w-full max-w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-white/90 rounded-3xl p-6 border border-white/60 shadow-2xl space-y-4 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-main flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" /> Comparar Est. Cuenta
          </h2>
          <button onClick={cerrar} className="p-1.5 rounded-full text-zinc-400 hover:text-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!resultado && (
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Sube el estado de cuenta en PDF. Se lee en tu navegador: el archivo no se envía a ningún servidor.
            </p>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={elegirArchivo}
              disabled={leyendo}
              className="w-full text-sm"
            />
            {pideClave && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Contraseña del PDF
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    autoComplete="off"
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-zinc-50 border border-line text-sm"
                  />
                  <button
                    type="button"
                    disabled={!clave || leyendo || !archivo}
                    onClick={() => archivo && void procesar(archivo, clave)}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-40"
                  >
                    Abrir
                  </button>
                </div>
              </div>
            )}
            {leyendo && <p className="text-xs text-muted">Leyendo el PDF...</p>}
            {error && <p className="text-xs text-rose-500">{error}</p>}
          </div>
        )}

        {resultado && !confirmando && (
          <div className="space-y-3">
            <p className="text-sm text-main">
              Encontré <strong>{resultado.gastos.length}</strong> gastos por{' '}
              <strong>{currencySymbol} {formato(resultado.cargos)}</strong>.
            </p>
            {coincideConBanco === true && (
              <p className="text-xs text-emerald-600">Coincide con el total de cargos que imprime el banco.</p>
            )}
            {coincideConBanco === false && (
              <p className="text-xs text-rose-500">No coincide con el total del banco. Revisa antes de subir.</p>
            )}
            {duplicados > 0 && (
              <p className="text-xs text-muted">
                {duplicados} ya están registrados el mismo día y monto. Vienen sin marcar.
              </p>
            )}
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => setMarcados(new Set(resultado.gastos.map((_, i) => i)))} className="px-3 py-1.5 rounded-lg bg-zinc-100 text-muted">
                Marcar todos
              </button>
              <button type="button" onClick={() => setMarcados(new Set())} className="px-3 py-1.5 rounded-lg bg-zinc-100 text-muted">
                Desmarcar todos
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 rounded-xl border border-line">
              {resultado.gastos.map((g, i) => (
                <label key={i} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={marcados.has(i)} onChange={() => alternar(i)} className="w-4 h-4 shrink-0" />
                  <span className="text-xs text-muted w-10 shrink-0">{diaMes(g.fecha)}</span>
                  <span className="flex-1 min-w-0 truncate text-main">
                    {g.descripcion}
                    {g.posibleDuplicado && <span className="ml-1 text-[10px] text-amber-600">ya registrado</span>}
                  </span>
                  <span className="shrink-0 font-medium text-main">{formato(g.monto)}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={seleccionados.length === 0}
              onClick={() => setConfirmando(true)}
              className="w-full py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              Subir {seleccionados.length} gastos
            </button>
          </div>
        )}

        {resultado && confirmando && (
          <div className="space-y-4 text-center">
            <p className="text-base font-semibold text-main">¿Deseas subir los gastos?</p>
            <p className="text-sm text-muted">
              Se agregarán {seleccionados.length} gastos por {currencySymbol} {formato(totalSeleccionado)}.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmando(false)} className="flex-1 py-2.5 rounded-xl bg-zinc-200 text-muted text-sm font-medium">
                No, volver
              </button>
              <button type="button" onClick={subir} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium">
                Sí, subir
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
