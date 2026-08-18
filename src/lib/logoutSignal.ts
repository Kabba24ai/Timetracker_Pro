// One-time cross-application logout signal.
//
// Some entry points may open TimeTracker with `?logout=1` to ask it to clear an
// existing session (an explicit logout handshake). That instruction must be
// consumed EXACTLY ONCE: clear the local session, then strip the parameter from
// the visible URL so a refresh never repeats it and the browser never stays
// parked on `/?logout=1`. Normal navigation (no `logout` param) is untouched, so
// a user with a valid session still lands straight in the app.

// Every localStorage key that makes up a TimeTracker session (mirrors the token
// key in api.ts and the tt_* keys in AuthContext).
const SESSION_KEYS = ['tt_token', 'tt_user', 'tt_employee', 'tt_roles', 'tt_timezone'];

/**
 * If the app was opened with `?logout=1`, clear the local session and remove the
 * one-time parameter from the URL (preserving any other query params + the hash).
 * Returns true when a logout signal was consumed. Safe to call once at startup.
 */
export function consumeLogoutSignal(): boolean {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get('logout') !== '1') return false;

  // 1. Clear the session so AuthContext restores as logged-out.
  SESSION_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage errors — clearing is best-effort.
    }
  });

  // 2. Consume the one-time instruction: drop `logout`, keep everything else,
  //    and leave the browser on a clean URL (no reload, no history entry).
  params.delete('logout');
  const qs = params.toString();
  const clean = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
  window.history.replaceState(null, '', clean);

  return true;
}
