import { PackageCheck, Trophy, Wrench } from 'lucide-react';

const COLOR_INGRESOS = 'hsl(var(--h) calc(65% * var(--sat)) 54%)';
const COLOR_ENTREGAS = '#46b985';

export interface PuntoDia {
  dia: string;
  ingresos: number;
  entregas: number;
}

/** Ingresos (columnas) y entregas (línea) de los últimos días. */
export function GraficoDiario({ datos }: { datos: PuntoDia[] }) {
  const W = 560;
  const H = 300;
  const m = { t: 14, r: 12, b: 30, l: 30 };
  const max = Math.max(1, ...datos.map((d) => Math.max(d.ingresos, d.entregas)));
  const techo = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const ancho = W - m.l - m.r;
  const alto = H - m.t - m.b;
  const paso = ancho / datos.length;
  const barra = Math.min(22, Math.max(3, paso * 0.5));
  const y = (v: number) => m.t + alto - (v / techo) * alto;
  const x = (i: number) => m.l + paso * i + paso / 2;
  const marcas = techo <= 4 ? Array.from({ length: techo + 1 }, (_, i) => i) : [0, techo / 2, techo];
  const linea = datos.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.entregas)}`).join(' ');
  const etiqueta = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  return (
    <div className="grafico-centrado">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ingresos y entregas de los últimos días" className="grafico-svg">
        {marcas.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--borde)" strokeDasharray={v === 0 ? undefined : '3 4'} />
            <text x={m.l - 8} y={y(v) + 4} textAnchor="end" className="eje">
              {v}
            </text>
          </g>
        ))}
        {datos.map((d, i) => (
          <g key={d.dia}>
            <rect x={x(i) - barra / 2} y={y(d.ingresos)} width={barra} height={Math.max(0, y(0) - y(d.ingresos))} rx="3" style={{ fill: COLOR_INGRESOS }}>
              <title>{`${etiqueta(d.dia)}: ${d.ingresos} ingreso(s), ${d.entregas} entrega(s)`}</title>
            </rect>
            {(datos.length - 1 - i) % Math.ceil(datos.length / 7) === 0 && (
              <text x={x(i)} y={H - 10} textAnchor="middle" className="eje">
                {etiqueta(d.dia)}
              </text>
            )}
          </g>
        ))}
        <path d={linea} fill="none" stroke={COLOR_ENTREGAS} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {datos.map((d, i) => (
          <circle key={d.dia} cx={x(i)} cy={y(d.entregas)} r={datos.length > 30 ? 2 : 3.5} fill="var(--superficie)" stroke={COLOR_ENTREGAS} strokeWidth="2">
            <title>{`${etiqueta(d.dia)}: ${d.entregas} entrega(s)`}</title>
          </circle>
        ))}
      </svg>
      <div className="leyenda en-fila">
        <span>
          <span className="punto" style={{ background: COLOR_INGRESOS }} /> Ingresos
        </span>
        <span>
          <span className="punto" style={{ background: COLOR_ENTREGAS }} /> Entregas
        </span>
      </div>
    </div>
  );
}

export interface FilaAnalista {
  analista: string;
  total: number;
  en_proceso: number;
  listos: number;
}

/** Quién encabeza una métrica (con empates) y cuántos equipos tiene. */
function lideres(datos: FilaAnalista[], k: 'total' | 'en_proceso' | 'listos') {
  const max = Math.max(0, ...datos.map((d) => d[k]));
  return { max, nombres: max > 0 ? datos.filter((d) => d[k] === max).map((d) => d.analista) : [] };
}

const COLOR_EN_PROCESO = '#f0983c';
const COLOR_LISTOS = '#8fd9b6';

/** Líderes (total, en progreso, listos) y barras apiladas por analista. */
export function GraficoAnalistas({ datos, totalEquipos }: { datos: FilaAnalista[]; totalEquipos: number }) {
  const tarjetas = [
    { k: 'total', etiqueta: 'Más equipos en total', icono: <Trophy size={18} />, tono: 'rojo' },
    { k: 'en_proceso', etiqueta: 'Más en progreso', icono: <Wrench size={18} />, tono: 'naranja' },
    { k: 'listos', etiqueta: 'Más listos para entregar', icono: <PackageCheck size={18} />, tono: 'verde' },
  ] as const;
  const lista = datos.slice(0, 8);
  const max = Math.max(1, ...lista.map((d) => d.total));
  return (
    <div>
      <div className="lideres">
        {tarjetas.map((t) => {
          const l = lideres(datos, t.k);
          return (
            <div key={t.k} className={`lider ${t.tono}`}>
              <div className="lider-etiqueta">
                {t.icono} {t.etiqueta}
              </div>
              <div className="lider-nombre">
                {l.nombres.length > 2 ? `Empate entre ${l.nombres.length} analistas` : l.nombres.length ? l.nombres.join(' · ') : 'Nadie aún'}
              </div>
              <div className="lider-dato">
                {l.nombres.length
                  ? `${l.max} equipo(s)${l.nombres.length > 1 ? ' cada uno' : ''}${t.k === 'total' && totalEquipos > 0 ? ` · ${Math.round((l.max / totalEquipos) * 100)}% del total` : ''}`
                  : 'Sin equipos en este estado'}
              </div>
            </div>
          );
        })}
      </div>
      <ul className="barras">
        {lista.map((d, i) => (
          <li key={d.analista}>
            <span className="barras-nombre" title={d.analista}>
              <span className="barras-puesto">{i + 1}</span>
              {d.analista}
            </span>
            <span className="barras-pista" title={`${d.en_proceso} en progreso · ${d.listos} listos · ${d.total} en total`}>
              <span className="barras-tramo" style={{ width: `${(d.en_proceso / max) * 100}%`, background: COLOR_EN_PROCESO }} />
              <span className="barras-tramo" style={{ width: `${(d.listos / max) * 100}%`, background: COLOR_LISTOS }} />
              <span
                className="barras-tramo"
                style={{ width: `${((d.total - d.en_proceso - d.listos) / max) * 100}%`, background: 'hsl(var(--h) calc(49% * var(--sat)) 34%)' }}
              />
            </span>
            <strong>{d.total}</strong>
          </li>
        ))}
      </ul>
      <div className="leyenda en-fila">
        <span>
          <span className="punto" style={{ background: COLOR_EN_PROCESO }} /> En progreso
        </span>
        <span>
          <span className="punto" style={{ background: COLOR_LISTOS }} /> Listos para entregar
        </span>
        <span>
          <span className="punto" style={{ background: 'hsl(var(--h) calc(49% * var(--sat)) 34%)' }} /> Otros (recibidos, pendientes, entregados)
        </span>
      </div>
    </div>
  );
}
