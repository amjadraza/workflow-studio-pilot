/* Exercise 6: the class prompt. Shared by the browser (shown and copied) and the server (run on Claude). No Node imports. */
export const AQI_PROMPT = `ROLE: You are a data analyst who builds clear dashboards for Pakistani
government officers who are not technical.

DATA: Use ONLY the attached file
pakistan_10_cities_air_quality_daily_2022-08_to_2026-10.csv
(daily PM2.5 and US AQI for 10 cities, 4 Aug 2022 – 31 Oct 2026;
modelled estimates from Open-Meteo / Copernicus CAMS).

TASK: Build ONE interactive dashboard (a single HTML page) on Lahore's air
quality over time and how it compares with other cities. Include:
1. A headline stating the key finding, plus the data period.
2. Lahore KPI cards for 2025: average PM2.5, times above the WHO guideline,
   worst month on record, number of "Unhealthy" days (daily us_aqi_mean
   above 150).
3. A map of Pakistan with one circle per city at its latitude/longitude:
   size = average PM2.5, colour = US AQI category (green, yellow, orange,
   red, purple, maroon), with a year selector. Tooltip shows the city name
   in English and Urdu. If map tiles don't load, draw the circles on a
   simple outline instead.
4. Lahore monthly PM2.5 line chart, with October–January shaded and dashed
   lines for WHO (5 µg/m³) and Pakistan NEQS (15 µg/m³ annual).
5. Lahore heatmap: years × months.
6. City ranking bar chart of annual average PM2.5, with Lahore highlighted.
7. A footer: "Source: Open-Meteo / Copernicus CAMS (CC BY 4.0). Modelled
   estimates, not measurements."

RULES:
- Calculate every number from the file. Never invent or estimate.
  Show "No data" for gaps.
- 2022 and 2026 are partial years: label them and rank cities on full
  years (2023–2025).
- Islamabad and Rawalpindi have identical values (same model grid cell):
  show them as one.
- Embed the calculated data in the page. Use free libraries only.

When done, tell me Lahore's 2025 average PM2.5 so I can check it.`;

export const CSV_FILE = 'pakistan_10_cities_air_quality_daily_2022-08_to_2026-10.csv';
