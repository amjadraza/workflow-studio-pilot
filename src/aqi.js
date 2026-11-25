/* Exercise 6: every number on the AQI dashboard is calculated here, from the CSV file. Nothing is typed in by hand. */

export const CSV_NAME = 'pakistan_10_cities_air_quality_daily_2022-08_to_2026-10.csv';
export const CSV_URL = 'demo-data/' + CSV_NAME;
export const WHO = 5;    // WHO annual guideline for PM2.5, µg/m³
export const NEQS = 15;  // Pakistan NEQS annual limit for PM2.5, µg/m³
export const LAHORE = 'Lahore';
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const URDU = {
  Lahore: 'لاہور', Karachi: 'کراچی', Faisalabad: 'فیصل آباد', Multan: 'ملتان', Peshawar: 'پشاور', Quetta: 'کوئٹہ',
  Gujranwala: 'گوجرانوالہ', Hyderabad: 'حیدرآباد', Islamabad: 'اسلام آباد', Rawalpindi: 'راولپنڈی',
  'Islamabad / Rawalpindi': 'اسلام آباد / راولپنڈی',
};

/* US AQI categories, upper bound inclusive */
export const AQI_CATS = [
  [50, 'Good', '#3E9B4F'], [100, 'Moderate', '#E2BE1C'], [150, 'Unhealthy for sensitive groups', '#EE8A26'],
  [200, 'Unhealthy', '#D7352B'], [300, 'Very unhealthy', '#8A3FA8'], [Infinity, 'Hazardous', '#7E0023'],
];
export const aqiCat = aqi => AQI_CATS.find(([max]) => aqi <= max);

const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const r1 = n => (n == null ? null : Math.round(n * 10) / 10);
const dayLabel = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function analyse(text) {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(',').map(h => h.trim());
  const need = ['city', 'date', 'latitude', 'longitude', 'pm2_5_mean_ugm3', 'us_aqi_mean'];
  const missing = need.filter(n => !head.includes(n));
  if (missing.length) throw new Error(`This file is missing the column(s): ${missing.join(', ')}`);
  const at = Object.fromEntries(need.map(n => [n, head.indexOf(n)]));
  const num = v => (v === '' || v == null ? null : Number(v));

  /* 1. Read every row */
  const cities = new Map(); // name -> { lat, lon, days: Map(date -> { pm, aqi }) }
  for (const line of lines.slice(1)) {
    const c = line.split(',');
    const name = c[at.city];
    if (!name || !/^\d{4}-\d\d-\d\d$/.test(c[at.date])) continue;
    if (!cities.has(name)) cities.set(name, { lat: num(c[at.latitude]), lon: num(c[at.longitude]), days: new Map() });
    cities.get(name).days.set(c[at.date], { pm: num(c[at.pm2_5_mean_ugm3]), aqi: num(c[at.us_aqi_mean]) });
  }

  /* 2. Islamabad and Rawalpindi share one model grid cell: if every value matches, show them as one city */
  let merged = false;
  const isb = cities.get('Islamabad'), rwp = cities.get('Rawalpindi');
  if (isb && rwp && isb.days.size === rwp.days.size &&
      [...isb.days].every(([d, v]) => rwp.days.get(d)?.pm === v.pm && rwp.days.get(d)?.aqi === v.aqi)) {
    cities.delete('Islamabad'); cities.delete('Rawalpindi');
    cities.set('Islamabad / Rawalpindi', isb);
    merged = true;
  }

  /* 3. Period, years, and which years are partial */
  const dates = [...new Set([...cities.values()].flatMap(c => [...c.days.keys()]))].sort();
  const first = dates[0], last = dates.at(-1);
  const years = [...new Set(dates.map(d => +d.slice(0, 4)))];
  const partial = new Set(years.filter(y => first > `${y}-01-01` || last < `${y}-12-31`));
  const fullYears = years.filter(y => !partial.has(y));

  /* 4. City × year averages */
  const cityYear = {}; // name -> year -> { pm, aqi, days, unhealthy }
  for (const [name, c] of cities) {
    cityYear[name] = {};
    for (const y of years) {
      const vals = [...c.days].filter(([d]) => d.startsWith(y + '-')).map(([, v]) => v);
      const pms = vals.map(v => v.pm).filter(v => v != null), aqis = vals.map(v => v.aqi).filter(v => v != null);
      cityYear[name][y] = { pm: mean(pms), aqi: mean(aqis), days: pms.length, unhealthy: aqis.filter(a => a > 150).length };
    }
    const full = [...c.days].filter(([d]) => fullYears.includes(+d.slice(0, 4))).map(([, v]) => v.pm).filter(v => v != null);
    cityYear[name].full = { pm: mean(full), days: full.length };
  }

  /* 5. Lahore month by month (null = No data) */
  const lahore = cities.get(LAHORE);
  if (!lahore) throw new Error('The file has no Lahore rows.');
  const monthly = [];
  for (let y = +first.slice(0, 4), m = +first.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` <= last.slice(0, 7); m === 12 ? (y++, m = 1) : m++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const pms = [...lahore.days].filter(([d, v]) => d.startsWith(key) && v.pm != null).map(([, v]) => v.pm);
    monthly.push({ key, y, m, pm: mean(pms), days: pms.length });
  }

  /* 6. Lahore KPIs for the latest full year */
  const kpiYear = fullYears.at(-1);
  const ly = cityYear[LAHORE][kpiYear];
  const inYear = monthly.filter(x => x.y === kpiYear && x.pm != null);
  const worst = inYear.reduce((a, b) => (b.pm > a.pm ? b : a), inYear[0]);
  const worstEver = monthly.filter(x => x.pm != null).reduce((a, b) => (b.pm > a.pm ? b : a));

  /* 7. Ranking: annual average PM2.5, full years only */
  const ranking = key => [...cities.keys()]
    .map(name => ({ name, pm: key === 'full' ? cityYear[name].full.pm : cityYear[name][key].pm }))
    .filter(r => r.pm != null).sort((a, b) => b.pm - a.pm);
  const rankNow = ranking(kpiYear);

  return {
    rows: lines.length - 1, first, last, period: `${dayLabel(first)} – ${dayLabel(last)}`,
    years, partial, fullYears, merged, monthly, cityYear, ranking, kpiYear,
    cities: [...cities].map(([name, c]) => ({ name, lat: c.lat, lon: c.lon, urdu: URDU[name] || '' })),
    lahore: {
      pm: ly.pm, days: ly.days, timesWho: ly.pm / WHO, unhealthy: ly.unhealthy, aqiDays: ly.days,
      worst, worstEver, rank: rankNow.findIndex(r => r.name === LAHORE) + 1, of: rankNow.length,
    },
  };
}
