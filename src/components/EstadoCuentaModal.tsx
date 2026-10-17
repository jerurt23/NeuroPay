import React, { useState } from 'react';
import { FileText, X, Lock } from 'lucide-react';
import type { Transaction } from '../types/index.ts';
import {
  ClaveIncorrecta,
  ClaveRequerida,
  gastosATransacciones,
  indicesEnRango,
  parsearEstadoCuenta,
  rangoCompleto,
  buscarAbonos,
  seleccionInicial,
  type ResultadoParseo,
} from '../lib/estadoCuenta.ts';
import { parseDecimal } from '../lib/money.ts';

interface EstadoCuentaModalProps {
  open: boolean;
  onClose: () => void;
  existentes: Transaction[];
  currencySymbol: string;
  onConfirm: (movimientos: Transaction[]) => void;
}

type Resultado = Extract<ResultadoParseo, { ok: true }>;
type Paso = 'archivo' | 'rango' | 'lista';

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
  const [paso, setPaso] = useState<Paso>('archivo');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [montoAbono, setMontoAbono] = useState('');

  if (!open) return null;

  const reiniciar = () => {
    setClave('');
    setArchivo(null);
    setPideClave(false);
    setLeyendo(false);
    setError(null);
    setResultado(null);
    setPaso('archivo');
    setDesde('');
    setHasta('');
    setMontoAbono('');
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
      const completo = rangoCompleto(r.gastos);
      setResultado(r);
      setDesde(completo.desde);
      setHasta(completo.hasta);
      setPideClave(false);
      setClave('');
      setPaso('rango');
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

  const verGastos = () => {
    if (!resultado) return;
    setMarcados(new Set(seleccionInicial(resultado.gastos, desde, hasta)));
    setConfirmando(false);
    setPaso('lista');
  };

  const alternar = (i: number) =>
    setMarcados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(i)) siguiente.delete(i);
      else siguiente.add(i);
      return siguiente;
    });

  const completo = rangoCompleto(resultado?.gastos ?? []);
  const esRangoCompleto = !!resultado && desde === completo.desde && hasta === completo.hasta;
  const rangoValido = !!desde && !!hasta && desde <= hasta;
  const enRango = resultado && rangoValido ? indicesEnRango(resultado.gastos, desde, hasta) : [];
  const seleccionados = resultado ? enRango.filter((i) => marcados.has(i)).map((i) => resultado.gastos[i]) : [];
  const totalSeleccionado = seleccionados.reduce((suma, g) => suma + g.monto, 0);
  const totalEnRango = resultado ? enRango.reduce((suma, i) => suma + resultado.gastos[i].monto, 0) : 0;
  const duplicadosEnRango = resultado ? enRango.filter((i) => resultado.gastos[i].posibleDuplicado).length : 0;
  const abonosHallados =
    resultado && montoAbono.trim() ? buscarAbonos(resultado.abonosDetalle, parseDecimal(montoAbono)) : [];
  const coincideConBanco =
    resultado?.controlBanco && esRangoCompleto
      ? Math.abs(resultado.controlBanco.cargos - resultado.cargos) < 0.005
      : null;

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

        {paso === 'archivo' && (
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

        {paso === 'rango' && resultado && (
          <div className="space-y-3">
            <p className="text-sm text-main">
              El estado tiene <strong>{resultado.gastos.length}</strong> gastos, del {diaMes(completo.desde)} al{' '}
              {diaMes(completo.hasta)}.
            </p>
            <p className="text-sm font-medium text-main">¿Desde qué fecha quieres subir?</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted space-y-1">
                Desde
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-line text-sm"
                />
              </label>
              <label className="text-xs text-muted space-y-1">
                Hasta
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-line text-sm"
                />
              </label>
            </div>
            <div className="space-y-2 rounded-xl border border-line p-3">
              <p className="text-xs font-medium text-muted">¿Desde qué abono empiezas? Escribe su monto:</p>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ej. 750"
                value={montoAbono}
                onChange={(e) => setMontoAbono(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-line text-sm"
              />
              {abonosHallados.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setDesde(a.fecha);
                    setHasta(completo.hasta);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-blue-50 text-xs text-blue-700"
                >
                  <span className="truncate">
                    {diaMes(a.fecha)} · {a.descripcion}
                  </span>
                  <span className="shrink-0 font-semibold">{formato(a.monto)}</span>
                </button>
              ))}
              {montoAbono.trim() && abonosHallados.length === 0 && (
                <p className="text-xs text-muted">No encontré un abono de ese monto en el estado.</p>
              )}
            </div>
            {!rangoValido && (
              <p className="text-xs text-rose-500">La fecha inicial debe ser igual o anterior a la final.</p>
            )}
            {rangoValido && enRango.length === 0 && (
              <p className="text-xs text-rose-500">No hay gastos en ese rango.</p>
            )}
            {rangoValido && enRango.length > 0 && (
              <p className="text-xs text-muted">
                {enRango.length} gastos en el rango, por {currencySymbol} {formato(totalEnRango)}.
              </p>
            )}
            <button
              type="button"
              disabled={!rangoValido || enRango.length === 0}
              onClick={verGastos}
              className="w-full py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              Ver los gastos del rango
            </button>
            <button type="button" onClick={reiniciar} className="w-full py-2 text-xs text-muted">
              Elegir otro PDF
            </button>
          </div>
        )}

        {paso === 'lista' && resultado && !confirmando && (
          <div className="space-y-3">
            <p className="text-sm text-main">
              <strong>{seleccionados.length}</strong> de {enRango.length} gastos del {diaMes(desde)} al{' '}
              {diaMes(hasta)}, por {currencySymbol} {formato(totalSeleccionado)}.
            </p>
            {coincideConBanco === true && (
              <p className="text-xs text-emerald-600">Coincide con el total de cargos que imprime el banco.</p>
            )}
            {coincideConBanco === false && (
              <p className="text-xs text-rose-500">No coincide con el total del banco. Revisa antes de subir.</p>
            )}
            <p className="text-xs text-muted">
              Comparado con tus registros: <strong>{enRango.length - duplicadosEnRango}</strong> nuevos y{' '}
              <strong>{duplicadosEnRango}</strong> ya registrados (mismo día y monto). Los ya registrados vienen sin
              marcar.
            </p>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => setMarcados(new Set(enRango))} className="px-3 py-1.5 rounded-lg bg-zinc-100 text-muted">
                Marcar todos
              </button>
              <button type="button" onClick={() => setMarcados(new Set())} className="px-3 py-1.5 rounded-lg bg-zinc-100 text-muted">
                Desmarcar todos
              </button>
              <button type="button" onClick={() => setPaso('rango')} className="ml-auto px-3 py-1.5 rounded-lg text-blue-600">
                Cambiar rango
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 rounded-xl border border-line">
              {enRango.map((i) => {
                const g = resultado.gastos[i];
                return (
                  <label key={i} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={marcados.has(i)} onChange={() => alternar(i)} className="w-4 h-4 shrink-0" />
                    <span className="text-xs text-muted w-10 shrink-0">{diaMes(g.fecha)}</span>
                    <span className="flex-1 min-w-0 truncate text-main">
                      {g.descripcion}
                      {g.posibleDuplicado && <span className="ml-1 text-[10px] text-amber-600">ya registrado</span>}
                    </span>
                    <span className="shrink-0 font-medium text-main">{formato(g.monto)}</span>
                  </label>
                );
              })}
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

        {paso === 'lista' && resultado && confirmando && (
          <div className="space-y-4 text-center">
            <p className="text-base font-semibold text-main">¿Deseas subir los gastos?</p>
            <p className="text-sm text-muted">
              Se agregarán {seleccionados.length} gastos del {diaMes(desde)} al {diaMes(hasta)} por {currencySymbol}{' '}
              {formato(totalSeleccionado)}.
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
