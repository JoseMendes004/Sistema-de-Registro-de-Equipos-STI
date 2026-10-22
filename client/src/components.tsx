import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import type { Estado } from './types';
import { claseEstado, porcentaje } from './util';

export function Insignia({ estado }: { estado: Estado }) {
  return <span className={`insignia ${claseEstado[estado]}`}>{estado}</span>;
}

export function Progreso({ hechas, total }: { hechas: number; total: number }) {
  const pct = porcentaje(hechas, total);
  const tono = pct === 100 ? 'verde' : pct >= 50 ? 'naranja' : 'rojo';
  return (
    <div className="progreso" title={`${hechas} de ${total} actividades completadas`}>
      <div className="progreso-texto">
        <span>
          {hechas}/{total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="progreso-pista" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`progreso-barra ${tono}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Campo({
  etiqueta,
  error,
  ayuda,
  children,
}: {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <label className={`campo${error ? ' con-error' : ''}`}>
      <span className="campo-etiqueta">{etiqueta}</span>
      {children}
      {error ? <span className="campo-error">{error}</span> : ayuda ? <span className="campo-ayuda">{ayuda}</span> : null}
    </label>
  );
}

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'ok' | 'info'; children: ReactNode }) {
  return (
    <div className={`aviso ${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Modal({
  titulo,
  onCerrar,
  children,
  pie,
}: {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
}) {
  const id = useId();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onCerrar]);
  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={id}>
        <header className="modal-cabecera">
          <h2 id={id}>{titulo}</h2>
          <button className="btn-icono" onClick={onCerrar} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        <div className="modal-cuerpo">{children}</div>
        {pie && <footer className="modal-pie">{pie}</footer>}
      </div>
    </div>
  );
}

export function Confirmar({
  titulo,
  mensaje,
  textoAccion,
  peligro,
  ocupado,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  mensaje: ReactNode;
  textoAccion: string;
  peligro?: boolean;
  ocupado?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <Modal
      titulo={titulo}
      onCerrar={onCancelar}
      pie={
        <>
          <button className="btn" onClick={onCancelar} disabled={ocupado}>
            Cancelar
          </button>
          <button className={`btn ${peligro ? 'peligro' : 'primario'}`} onClick={onConfirmar} disabled={ocupado}>
            {ocupado ? 'Procesando…' : textoAccion}
          </button>
        </>
      }
    >
      <div className="confirmar-mensaje">{mensaje}</div>
    </Modal>
  );
}

export function Paginacion({
  pagina,
  porPagina,
  total,
  onCambiar,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  onCambiar: (p: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(total, pagina * porPagina);
  const visibles: number[] = [];
  for (let p = Math.max(1, pagina - 2); p <= Math.min(paginas, pagina + 2); p++) visibles.push(p);
  return (
    <div className="paginacion">
      <span className="paginacion-resumen">
        Mostrando {desde}–{hasta} de {total} registros
      </span>
      <div className="paginacion-botones">
        <button className="btn-pagina" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)} aria-label="Página anterior">
          <ChevronLeft size={16} />
        </button>
        {visibles.map((p) => (
          <button
            key={p}
            className={`btn-pagina${p === pagina ? ' activa' : ''}`}
            onClick={() => onCambiar(p)}
            aria-current={p === pagina ? 'page' : undefined}
          >
            {p}
          </button>
        ))}
        <button className="btn-pagina" disabled={pagina >= paginas} onClick={() => onCambiar(pagina + 1)} aria-label="Página siguiente">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function Cabecera({
  icono,
  titulo,
  subtitulo,
  acciones,
}: {
  icono: ReactNode;
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="cabecera-pagina">
      <div className="cabecera-icono">{icono}</div>
      <div className="cabecera-texto">
        <h1>{titulo}</h1>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      {acciones && <div className="cabecera-acciones">{acciones}</div>}
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="vacio">{children}</div>;
}
