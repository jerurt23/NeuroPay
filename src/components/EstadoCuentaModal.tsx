import React, { useState } from 'react';
import { FileText, X, Lock } from 'lucide-react';
import type { Transaction } from '../types/index.ts';
import {
  buscarMovimientos,
  ClaveIncorrecta,
  ClaveRequerida,
  movimientosATransacciones,
  parsearEstadoCuenta,
  periodoDe,
  type MovimientoEstado,
  type ResultadoParseo,
  type TipoMovimiento,
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
type Paso = 'archivo' | 'condiciones' | 'resultados';

const formato = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const diaMes = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

const etiquetasDe = (tipo: TipoMovimiento | null) =>
  tipo === 'egreso'
    ? { monto: 'Monto del egreso', referencia: 'A quién pagó', ejemplo: 'Ej. Yape Juan o nombre del comercio' }
    : { monto: 'Monto del ingreso', referencia: 'Quién abonó', ejemplo: 'Ej. HABERES o nombre de quien abonó' };

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
  const [tipo, setTipo] = useState<TipoMovimiento | null>(null);
  const [montoTexto, setMontoTexto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [resumenBusqueda, setResumenBusqueda] = useState('');
  const [hallados, setHallados] = useState<MovimientoEstado[]>([]);
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
    setPaso('archivo');
    setTipo(null);
    setMontoTexto('');
    setReferencia('');
    setDesde('');
    setHasta('');
    setResumenBusqueda('');
    setHallados([]);
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
      setPideClave(false);
      setClave('');
      setPaso('condiciones');
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

  const monto = parseDecimal(montoTexto);
  const montoIndicado = montoTexto.trim() !== '';
  const montoValido = !montoIndicado || (!Number.isNaN(monto) && monto > 0);
  const rangoValido = !desde || !hasta || desde <= hasta;
  const periodo = resultado ? periodoDe(resultado.movimientos) : null;
  const fueraDelPeriodo =
    !!periodo && ((!!desde && desde < periodo.desde) || (!!hasta && hasta > periodo.hasta));
  const puedeBuscar = !!tipo && montoValido && rangoValido;

  const buscar = () => {
    if (!resultado || !tipo) return;
    const encontrados = buscarMovimientos(resultado.movimientos, {
      tipo,
      monto: montoIndicado ? monto : undefined,
      referencia,
      desde,
      hasta,
    });
    const resumen = [
      montoIndicado ? `de ${currencySymbol} ${formato(monto)}` : '',
      referencia.trim() ? `con la referencia "${referencia.trim()}"` : '',
      desde || hasta ? 'en ese rango de fechas' : '',
    ]
      .filter(Boolean)
      .join(' ');
    setResumenBusqueda(resumen);
    setHallados(encontrados);
    setMarcados(new Set(encontrados.flatMap((m, i) => (m.posibleDuplicado ? [] : [i]))));
    setConfirmando(false);
    setPaso('resultados');
  };

  const alternar = (i: number) =>
    setMarcados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(i)) siguiente.delete(i);
      else siguiente.add(i);
      return siguiente;
    });

  const elegidos = hallados.filter((_, i) => marcados.has(i));
  const totalElegido = elegidos.reduce((suma, m) => suma + m.monto, 0);
  const plural = elegidos.length !== 1;
  const nombreElegidos = tipo === 'ingreso' ? (plural ? 'ingresos' : 'ingreso') : plural ? 'gastos' : 'gasto';
  const etiquetas = etiquetasDe(tipo);
  const cuadraConBanco =
    resultado?.controlBanco
      ? Math.abs(resultado.controlBanco.cargos - resultado.cargos) < 0.005 &&
        Math.abs(resultado.controlBanco.abonos - resultado.abonos) < 0.005
      : null;

  const subir = () => {
    onConfirm(movimientosATransacciones(elegidos, Date.now().toString(36)));
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

        {paso === 'condiciones' && resultado && periodo && (
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Leí {resultado.movimientos.length} movimientos (
              {resultado.movimientos.filter((m) => m.tipo === 'ingreso').length} ingresos y{' '}
              {resultado.movimientos.filter((m) => m.tipo === 'egreso').length} egresos). El estado cubre del{' '}
              {diaMes(periodo.desde)} al {diaMes(periodo.hasta)}.
              {cuadraConBanco === true && ' Coinciden con los totales que imprime el banco.'}
              {cuadraConBanco === false && ' No coinciden con los totales del banco; revisa antes de subir.'}
            </p>
            <p className="text-sm font-semibold text-main">Indica tus condiciones</p>
            <div className="grid grid-cols-2 gap-2">
              {(['ingreso', 'egreso'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`py-2.5 rounded-xl text-sm font-medium ${
                    tipo === t ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-muted'
                  }`}
                >
                  {t === 'ingreso' ? 'Ingreso' : 'Egreso'}
                </button>
              ))}
            </div>
            {tipo && (
              <>
                <label className="block text-xs font-medium text-muted space-y-1">
                  {etiquetas.monto} (opcional)
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={montoTexto}
                    onChange={(e) => setMontoTexto(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-line text-sm"
                  />
                </label>
                {!montoValido && (
                  <p className="text-xs text-rose-500">Escribe un monto válido o deja el campo vacío.</p>
                )}
                <label className="block text-xs font-medium text-muted space-y-1">
                  {etiquetas.referencia} (opcional)
                  <input
                    type="text"
                    placeholder={etiquetas.ejemplo}
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-line text-sm"
                  />
                </label>
              </>
            )}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted">Rango de fechas (opcional, para afinar la búsqueda)</p>
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
              {!rangoValido && (
                <p className="text-xs text-rose-500">La fecha inicial debe ser igual o anterior a la final.</p>
              )}
              {rangoValido && fueraDelPeriodo && (
                <p className="text-xs text-amber-600">
                  Tu rango no coincide con el periodo del estado ({diaMes(periodo.desde)} al{' '}
                  {diaMes(periodo.hasta)}).
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={!puedeBuscar}
              onClick={buscar}
              className="w-full py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              Buscar en el PDF
            </button>
            <button type="button" onClick={reiniciar} className="w-full py-2 text-xs text-muted">
              Elegir otro PDF
            </button>
          </div>
        )}

        {paso === 'resultados' && resultado && periodo && !confirmando && (
          <div className="space-y-3">
            {hallados.length === 0 ? (
              <p className="text-sm text-main">
                No encontré ningún {tipo === 'ingreso' ? 'ingreso' : 'egreso'}
                {resumenBusqueda ? ` ${resumenBusqueda}` : ''}. El estado cubre del {diaMes(periodo.desde)} al{' '}
                {diaMes(periodo.hasta)}.
              </p>
            ) : (
              <>
                <p className="text-sm text-main">
                  Encontré <strong>{hallados.length}</strong> {hallados.length === 1 ? 'movimiento' : 'movimientos'}.
                  Marcados: <strong>{elegidos.length}</strong> por {currencySymbol} {formato(totalElegido)}.
                </p>
                <p className="text-xs text-muted">
                  Los que ya están registrados (mismo tipo, día y monto) vienen sin marcar.
                </p>
                <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 rounded-xl border border-line">
                  {hallados.map((m, i) => (
                    <label key={i} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={marcados.has(i)}
                        onChange={() => alternar(i)}
                        className="w-4 h-4 shrink-0"
                      />
                      <span className="text-xs text-muted w-10 shrink-0">{diaMes(m.fecha)}</span>
                      <span className="flex-1 min-w-0 truncate text-main">
                        {m.descripcion}
                        {m.posibleDuplicado && <span className="ml-1 text-[10px] text-amber-600">ya registrado</span>}
                      </span>
                      <span className="shrink-0 font-medium text-main">{formato(m.monto)}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaso('condiciones')}
                className="flex-1 py-2.5 rounded-xl bg-zinc-200 text-muted text-sm font-medium"
              >
                Cambiar condiciones
              </button>
              {hallados.length > 0 && (
                <button
                  type="button"
                  disabled={elegidos.length === 0}
                  onClick={() => setConfirmando(true)}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-40"
                >
                  Subir {elegidos.length}
                </button>
              )}
            </div>
          </div>
        )}

        {paso === 'resultados' && resultado && confirmando && (
          <div className="space-y-4 text-center">
            <p className="text-base font-semibold text-main">
              ¿Deseas subir {plural ? 'estos movimientos' : 'este movimiento'}?
            </p>
            <p className="text-sm text-muted">
              {plural ? 'Se agregarán' : 'Se agregará'} {elegidos.length} {nombreElegidos} por {currencySymbol}{' '}
              {formato(totalElegido)}.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-200 text-muted text-sm font-medium"
              >
                No, volver
              </button>
              <button
                type="button"
                onClick={subir}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium"
              >
                Sí, subir
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
