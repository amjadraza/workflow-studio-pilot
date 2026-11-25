/* Exercise 6: from a prompt and a CSV file to a dashboard.
   The exercise is the prompt below; this screen is the reference answer, calculated in the browser from the same file. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { analyse, aqiCat, AQI_CATS, CSV_NAME, CSV_URL, LAHORE, MONTHS, NEQS, WHO, r1 } from '../aqi.js';
import { HBars, Kpis, Legend } from '../components/Charts.jsx';
import { AQI_PROMPT } from '../../server/aqiPrompt.js';
import AiRun from './AiRun.jsx';


const fmt = n => (n == null ? 'No data' : r1(n).toFixed(1));
const monthName = x => `${MONTHS[x.m - 1]} ${x.y}`;

/* Width of an element, kept up to date, so charts draw at real pixel size (text stays readable on phones) */
function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function Tip({ tip }) {
  if (!tip) return null;
  return <div className="tip" style={{ left: tip.x, top: tip.y }} role="status">{tip.body}</div>;
}

/* ---------- 3. Map: simple outline of Pakistan (approximate, for orientation) ---------- */
const OUTLINE = [[61.6, 25.2], [61.8, 26.2], [63.2, 26.6], [63.2, 27.2], [62.8, 27.3], [62.8, 28.3], [61.9, 28.6], [61.4, 29.3], [60.9, 29.9],
  [62.5, 29.4], [64.2, 29.5], [66.3, 29.9], [66.4, 30.9], [67.8, 31.6], [69.3, 31.9], [69.6, 32.9], [70.0, 33.7], [71.1, 34.1], [71.6, 35.0],
  [71.5, 35.6], [71.2, 36.1], [72.5, 36.8], [74.5, 37.0], [75.0, 37.0], [75.8, 36.6], [77.0, 35.5], [77.0, 35.0], [75.5, 34.6], [74.0, 34.0],
  [73.8, 33.0], [74.6, 32.5], [74.6, 31.9], [74.6, 31.1], [74.0, 30.9], [73.4, 30.0], [73.0, 29.5], [71.9, 27.9], [70.6, 28.0], [69.6, 27.2],
  [70.2, 26.5], [70.1, 25.7], [70.7, 25.0], [71.1, 24.4], [69.5, 24.3], [68.8, 23.9], [68.2, 23.7], [67.4, 24.0], [67.0, 24.8], [66.6, 25.4],
  [65.0, 25.3], [64.0, 25.3], [62.5, 25.2]];
const LON0 = 60.3, LON1 = 78, LAT0 = 23.3, LAT1 = 37.4, STRETCH = 1.15; // 1.15 ≈ 1/cos(30°), so the shape is not squashed
const LABEL_LEFT = new Set(['Faisalabad', 'Multan', 'Quetta', 'Karachi', 'Peshawar']);

function CityMap({ a }) {
  const [ref, w] = useWidth();
  const [year, setYear] = useState(a.kpiYear);
  const [tip, setTip] = useState(null);
  const k = w / (LON1 - LON0);
  const h = Math.round((LAT1 - LAT0) * k * STRETCH);
  const x = lon => (lon - LON0) * k, y = lat => (LAT1 - lat) * k * STRETCH;
  const s = Math.min(1, w / 520);

  const dots = a.cities.map(c => ({ ...c, ...a.cityYear[c.name][year] }))
    .sort((p, q) => (q.pm ?? 0) - (p.pm ?? 0)); // big circles first, small ones on top
  const show = (c, el) => {
    const box = ref.current.getBoundingClientRect(), r = el.getBoundingClientRect();
    const cat = c.aqi != null ? aqiCat(c.aqi) : null;
    setTip({
      x: r.left - box.left + r.width / 2, y: r.top - box.top,
      body: <><b>{c.name}</b> <span className="urdu-inline" lang="ur">{c.urdu}</span><br />
        PM2.5: {fmt(c.pm)} µg/m³ · US AQI: {c.aqi == null ? 'No data' : Math.round(c.aqi)}<br />{cat ? cat[1] : ''}</>,
    });
  };

  return (
    <>
      <div className="yearpick" role="radiogroup" aria-label="Year">
        {a.years.map(yy => (
          <button key={yy} role="radio" aria-checked={year === yy} onClick={() => { setYear(yy); setTip(null); }}>
            {yy}{a.partial.has(yy) && <small> partial</small>}
          </button>
        ))}
      </div>
      <div ref={ref} className="mapbox" onMouseLeave={() => setTip(null)}>
        {w > 0 && (
          <svg width={w} height={h} role="img" aria-label={`Map of Pakistan, average PM2.5 by city, ${year}`}>
            <polygon className="land" points={OUTLINE.map(([lo, la]) => `${x(lo)},${y(la)}`).join(' ')} />
            {dots.map(c => {
              const r = c.pm == null ? 4 : (3 + Math.sqrt(c.pm) * 1.9) * s;
              const left = LABEL_LEFT.has(c.name);
              return (
                <g key={c.name} tabIndex={0} className="city" onMouseEnter={e => show(c, e.currentTarget.firstChild)}
                  onFocus={e => show(c, e.currentTarget.firstChild)} onBlur={() => setTip(null)}>
                  <circle cx={x(c.lon)} cy={y(c.lat)} r={r} fill={c.aqi == null ? 'var(--line)' : aqiCat(c.aqi)[2]} />
                  <text x={x(c.lon) + (left ? -r - 4 : r + 4)} y={y(c.lat) + 4} textAnchor={left ? 'end' : 'start'}>
                    {c.name === 'Islamabad / Rawalpindi' ? 'Isb / Rwp' : c.name}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        <Tip tip={tip} />
      </div>
      <Legend items={AQI_CATS.map(([, label, color]) => [label, color])} />
      <p className="cap">Circle size = average PM2.5 in {year}{a.partial.has(year) ? ' (partial year)' : ''}. Colour = US AQI category of the
        year's average daily AQI. Outline is approximate, for orientation only.</p>
    </>
  );
}

/* ---------- 4. Lahore monthly line ---------- */
function MonthlyLine({ a }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const data = a.monthly;
  const H = 280, L = 40, R = 12, T = 14, B = 30;
  const top = Math.ceil(Math.max(...data.map(d => d.pm ?? 0)) / 50) * 50;
  const step = (w - L - R) / data.length;
  const x = i => L + step * (i + 0.5), y = v => T + (H - T - B) * (1 - v / top);
  /* the line breaks where a month has no data */
  const path = data.map((d, i) => (d.pm == null ? '' : `${i && data[i - 1].pm != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.pm).toFixed(1)}`)).join('');
  const move = e => {
    const px = e.clientX - ref.current.getBoundingClientRect().left;
    setHover(Math.max(0, Math.min(data.length - 1, Math.floor((px - L) / step))));
  };
  const hd = hover != null ? data[hover] : null;

  return (
    <div ref={ref} className="mapbox">
      {w > 0 && (
        <svg width={w} height={H} onMouseMove={move} onMouseLeave={() => setHover(null)} role="img"
          aria-label="Lahore monthly average PM2.5 with October to January shaded">
          {data.map((d, i) => [10, 11, 12, 1].includes(d.m) && <rect key={d.key} className="season" x={L + step * i} y={T} width={step + 0.5} height={H - T - B} />)}
          {Array.from({ length: top / 50 + 1 }, (_, i) => i * 50).map(v => (
            <g key={v}><line className="grid" x1={L} x2={w - R} y1={y(v)} y2={y(v)} /><text className="axis" x={L - 6} y={y(v) + 4} textAnchor="end">{v}</text></g>
          ))}
          {[[WHO, 'WHO 5', 72], [NEQS, 'NEQS 15', 0]].map(([v, label, dx]) => (
            <g key={v}><line className="refline" x1={L} x2={w - R} y1={y(v)} y2={y(v)} />
              <text className="axis" x={w - R - dx} y={y(v) - 4} textAnchor="end">{label}</text></g>
          ))}
          {data.map((d, i) => d.m === 1 && <text key={d.key} className="axis" x={L + step * i} y={H - 10}>{d.y}{a.partial.has(d.y) ? '*' : ''}</text>)}
          {/* first month label, unless the next January label is too close */}
          {data[0].m !== 1 && step * (13 - data[0].m) > 70 && <text className="axis" x={x(0)} y={H - 10} textAnchor="middle">{MONTHS[data[0].m - 1]} {data[0].y}</text>}
          <path className="line" d={path} />
          {hd && <line className="cross" x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} />}
          {hd?.pm != null && <circle className="dot" cx={x(hover)} cy={y(hd.pm)} r={5} />}
        </svg>
      )}
      {hd && <Tip tip={{ x: Math.min(Math.max(x(hover), 70), w - 70), y: hd.pm != null ? y(hd.pm) - 8 : T,
        body: <><b>{monthName(hd)}</b><br />{hd.pm == null ? 'No data' : `${fmt(hd.pm)} µg/m³ (${hd.days} days)`}</> }} />}
    </div>
  );
}

/* ---------- 5. Heatmap: years × months ---------- */
function Heatmap({ a }) {
  const max = Math.max(...a.monthly.map(d => d.pm ?? 0));
  const cell = (yy, m) => a.monthly.find(d => d.y === yy && d.m === m);
  return (
    <div className="scroll">
      <table className="heat">
        <thead><tr><th />{MONTHS.map(m => <th key={m}>{m}</th>)}</tr></thead>
        <tbody>
          {a.years.map(yy => (
            <tr key={yy}>
              <th>{yy}{a.partial.has(yy) && <small> partial</small>}</th>
              {MONTHS.map((_, i) => {
                const d = cell(yy, i + 1);
                if (!d || d.pm == null) return <td key={i} className="nodata" title={`${MONTHS[i]} ${yy}: No data`}>No data</td>;
                const pct = Math.round((d.pm / max) * 100);
                return (
                  <td key={i} title={`${MONTHS[i]} ${yy}: ${fmt(d.pm)} µg/m³`}
                    style={{ background: `color-mix(in oklab, var(--heat) ${pct}%, var(--card))`, color: pct > 55 ? 'var(--heat-ink)' : 'var(--ink)' }}>
                    {Math.round(d.pm)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="heatkey"><span>0</span><i /><span>{Math.round(max)} µg/m³</span></div>
    </div>
  );
}

/* ---------- 6. City ranking ---------- */
function Ranking({ a }) {
  const [key, setKey] = useState(a.kpiYear);
  const rows = a.ranking(key);
  const span = `${a.fullYears[0]}–${a.fullYears.at(-1)}`;
  return (
    <>
      <div className="yearpick" role="radiogroup" aria-label="Year">
        {[...a.fullYears, 'full'].map(k => (
          <button key={k} role="radio" aria-checked={key === k} onClick={() => setKey(k)}>{k === 'full' ? span : k}</button>
        ))}
      </div>
      <HBars refs={[{ v: WHO, label: 'WHO' }, { v: NEQS, label: 'NEQS' }]} rows={rows.map(r => ({
        label: r.name, value: fmt(r.pm),
        segs: [{ v: r.pm, color: r.name === LAHORE ? 'var(--crit)' : 'var(--mute)', tip: `${r.name}: ${fmt(r.pm)} µg/m³` }],
      }))} />
      <p className="cap" style={{ marginTop: 10 }}>Full years only. Partial years ({[...a.partial].join(', ')}) are not ranked.
        {a.merged && ' Islamabad and Rawalpindi have identical values in the file (same model grid cell), so they are shown as one.'}</p>
    </>
  );
}

export default function AirQuality({ notify }) {
  const [prompt, setPrompt] = useState(AQI_PROMPT); // participants may edit it before running it on Claude
  const [file, setFile] = useState({ name: CSV_NAME, text: null, error: '' });
  useEffect(() => {
    fetch(CSV_URL).then(r => (r.ok ? r.text() : Promise.reject(new Error(`Could not load ${CSV_NAME}`))))
      .then(text => setFile(f => ({ ...f, text })), e => setFile(f => ({ ...f, error: e.message })));
  }, []);
  const result = useMemo(() => {
    if (!file.text) return null;
    try { return { a: analyse(file.text) }; } catch (e) { return { error: e.message }; }
  }, [file.text]);
  const a = result?.a;

  const upload = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) setFile({ name: f.name, text: await f.text(), error: '' });
  };
  const copy = () => navigator.clipboard?.writeText(prompt)
    .then(() => notify('Prompt copied. Attach the CSV file and paste the prompt into your assistant.'), () => notify('Copy failed: select the text and copy it.'));

  return (
    <section className="band">
      <div className="grid ag" style={{ marginBottom: 22 }}>
        <div className="card">
          <h2>The exercise</h2>
          <p className="what">Give an AI assistant the data file and this prompt. It should build a one-page dashboard. Then compare its
            numbers with the reference dashboard below, which is calculated from the same file.</p>
          <div className="row" style={{ marginTop: 0 }}>
            <button className="primary" onClick={copy}>Copy prompt</button>
            <a className="filebtn" href={CSV_URL} download>⬇ Download the CSV</a>
          </div>
          <details>
            <summary>Check your answer</summary>
            {a ? <p>Lahore's {a.kpiYear} average PM2.5: <b>{fmt(a.lahore.pm)} µg/m³</b>, from {a.lahore.days} days of data.
              Unhealthy days (daily US AQI above 150): <b>{a.lahore.unhealthy}</b>.</p> : <p className="empty">Loading the file…</p>}
          </details>
        </div>
        <div className="card">
          <h2>The prompt</h2>
          <textarea className="prompt tall" aria-label="The prompt" value={prompt} onChange={e => setPrompt(e.target.value)} spellCheck={false} />
          {prompt !== AQI_PROMPT && <button className="ghost" style={{ marginTop: 10 }} onClick={() => setPrompt(AQI_PROMPT)}>Reset to the original prompt</button>}
        </div>
      </div>

      <div className="dgrid"><AiRun prompt={prompt} reference={a?.lahore.pm} notify={notify} /></div>

      <h2 className="ref-title">Reference dashboard</h2>
      <div className="toolbar">
        <span className="source">Calculated in your browser from <b>{file.name}</b>{a && ` (${a.rows.toLocaleString('en-US')} rows)`}.</span>
        <label className="filebtn">Use another copy of the file<input type="file" accept=".csv,text/csv" onChange={upload} /></label>
      </div>
      {(file.error || result?.error) && <p className="notice">{file.error || result.error}</p>}
      {a && <Dashboard a={a} />}
    </section>
  );
}

function Dashboard({ a }) {
  const L = a.lahore, top = a.ranking(a.kpiYear)[0];
  return (
    <>
      <div className="db-head">
        <div>
          <h2>In {a.kpiYear}, Lahore breathed PM2.5 at {fmt(L.pm)} µg/m³ on average: {L.timesWho.toFixed(1)} times the WHO guideline.
            {L.rank > 1 ? ` It ranked ${L.rank} of ${L.of} cities; ${top.name} was worst.` : ` It was the worst of ${L.of} cities.`}</h2>
          <p>Data period: {a.period}. Daily modelled estimates for {a.cities.length} {a.merged ? 'locations (Islamabad and Rawalpindi shown as one)' : 'cities'}.</p>
        </div>
      </div>

      <Kpis items={[
        { lab: `Lahore average PM2.5, ${a.kpiYear}`, val: fmt(L.pm), unit: 'µg/m³', foot: `${L.days} days of data`, cls: 'alert' },
        { lab: 'Times the WHO guideline', val: L.timesWho.toFixed(1) + '×', foot: `WHO annual guideline: ${WHO} µg/m³`, cls: 'alert' },
        { lab: `Worst month of ${a.kpiYear}`, val: MONTHS[L.worst.m - 1], unit: `${fmt(L.worst.pm)} µg/m³`,
          foot: `Worst on record: ${monthName(L.worstEver)}, ${fmt(L.worstEver.pm)} µg/m³`, cls: 'warnk' },
        { lab: `“Unhealthy” days, ${a.kpiYear}`, val: L.unhealthy, unit: `of ${L.aqiDays}`, foot: 'Daily US AQI above 150', cls: 'warnk' },
      ]} />

      <div className="dgrid">
        <div className="card">
          <h3>Average PM2.5 by city</h3>
          <p className="cap">Hover or tab to a circle for the city in English and Urdu.</p>
          <CityMap a={a} />
        </div>
        <div className="card">
          <h3>City ranking: annual average PM2.5</h3>
          <p className="cap">µg/m³. Lahore in red. Dashed lines: WHO guideline (5) and Pakistan NEQS (15).</p>
          <Ranking a={a} />
        </div>
        <div className="card w12">
          <h3>Lahore: monthly average PM2.5</h3>
          <p className="cap">µg/m³. Shaded: October to January, the smog season. * partial year.</p>
          <Legend items={[['October–January', 'var(--season)'], ['WHO 5 / NEQS 15 (dashed)', 'var(--soft)'], ['Lahore monthly average', 'var(--s1)']]} />
          <MonthlyLine a={a} />
        </div>
        <div className="card w12">
          <h3>Lahore: month by month, year by year</h3>
          <p className="cap">Average PM2.5 in µg/m³. Darker = dirtier air.</p>
          <Heatmap a={a} />
        </div>
      </div>
      <p className="note">Source: Open-Meteo / Copernicus CAMS (CC BY 4.0). Modelled estimates, not measurements.</p>
    </>
  );
}
