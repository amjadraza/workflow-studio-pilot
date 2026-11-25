/* Light / Dark / System theme. The colours live in styles.css (light-dark() values);
   this only sets data-theme on <html>, which styles.css reads. Remembered in this browser. */
export const THEME_KEY = 'workflow-studio-theme';
export const THEMES = [['system', '◐', 'System'], ['light', '☀', 'Light'], ['dark', '☾', 'Dark']];

export function getTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; }
}

export function setTheme(theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage blocked: applies for this visit only */ }
}
