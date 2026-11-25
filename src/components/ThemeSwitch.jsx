/* Three-button switch: follow the computer's setting, or force Light or Dark */
import { useState } from 'react';
import { THEMES, getTheme, setTheme } from '../theme.js';

export default function ThemeSwitch() {
  const [theme, setThemeState] = useState(getTheme);
  const choose = t => { setTheme(t); setThemeState(t); };
  return (
    <div className="modeswitch theme" role="radiogroup" aria-label="Colour theme">
      {THEMES.map(([id, icon, label]) => (
        <button key={id} role="radio" aria-checked={theme === id} aria-label={label}
          title={id === 'system' ? 'Follow the computer’s setting' : label + ' mode'} onClick={() => choose(id)}>
          <span aria-hidden="true">{icon}</span>
        </button>
      ))}
    </div>
  );
}
