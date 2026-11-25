/* Small CSS charts for the dashboard. Hover a bar for its value. */
import { Fragment } from 'react';

const fmt = n => Number(n).toLocaleString('en-US');
const total = segs => segs.reduce((s, x) => s + x.v, 0);

export function Progress({ value, label }) {
  return (
    <div className="progress">
      <div className="bar"><i style={{ width: value * 100 + '%' }} /></div>
      <b>{label}</b>
    </div>
  );
}

/* rows: [{ label, value?, segs: [{ v, color?, tip? }] }]; refs: [{ v, label }] dashed reference lines */
export function HBars({ rows, max, refs }) {
  const top = max || Math.max(1, ...rows.map(r => total(r.segs)));
  return (
    <div className="hb" style={refs ? { paddingTop: 20 } : undefined}>
      {rows.map((r, i) => (
        <Fragment key={r.label}>
          <span className="l" title={r.label}>{r.label}</span>
          <div className="track">
            {r.segs.filter(s => s.v).map((s, k) => (
              <span key={k} className="seg" title={s.tip || `${r.label}: ${fmt(s.v)}`}
                style={{ width: (s.v / top) * 100 + '%', background: s.color || 'var(--s1)' }} />
            ))}
            {refs?.map(f => (
              <span key={f.v} className="ref" style={{ left: (f.v / top) * 100 + '%' }}>{i === 0 && <span>{f.label}</span>}</span>
            ))}
          </div>
          <span className="v">{r.value ?? fmt(total(r.segs))}</span>
        </Fragment>
      ))}
    </div>
  );
}

/* items: [{ label, v, tip }] */
export function Columns({ items }) {
  const max = Math.max(1, ...items.map(i => i.v));
  return (
    <>
      <div className="cols">
        {items.map(it => (
          <div className="col" key={it.label}>
            <b>{it.v ? fmt(it.v) : ''}</b>
            <i title={it.tip} style={{ height: (it.v / max) * 100 + '%' }} />
          </div>
        ))}
      </div>
      <div className="xl">{items.map(it => <span key={it.label}>{it.label}</span>)}</div>
    </>
  );
}

/* items: [{ lab, val, unit?, foot?, cls?, delta?: [text, 'good'|'bad'] }] */
export function Kpis({ items }) {
  return (
    <div className="kpis">
      {items.map(k => (
        <div key={k.lab} className={'kpi ' + (k.cls || '')}>
          <div className="lab">{k.lab}</div>
          <div className="val">{k.val}{k.unit && <small> {k.unit}</small>}</div>
          <div className="foot">{k.delta && <span className={'delta ' + k.delta[1]}>{k.delta[0]}</span>} {k.foot}</div>
        </div>
      ))}
    </div>
  );
}

/* items: [[label, color]] */
export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map(([label, color]) => <span key={label}><i style={{ background: color }} />{label}</span>)}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="emptybox">{children}</div>;
}
