/* Sign-in screen: the person types their name and the shared PIN. */
import { useState } from 'react';
import { login } from './api.js';

export default function Login({ onSignedIn }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSignedIn(await login(name, pin));
    } catch (err) {
      setError(err.message);
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="card login" onSubmit={submit}>
        <h1>Workflow Studio</h1>
        <p className="what">Enter your name and the session PIN from your trainer.</p>
        <label>Your name
          <input value={name} onChange={e => setName(e.target.value)} maxLength={40} autoComplete="name" autoFocus required />
        </label>
        <label>PIN
          <input type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)} autoComplete="off" required />
        </label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
