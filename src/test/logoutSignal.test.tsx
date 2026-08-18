import { beforeEach, describe, expect, it } from 'vitest';
import { consumeLogoutSignal } from '../lib/logoutSignal';

// Regression for the HRM → TimeTracker "?logout=1" bug: the one-time logout
// signal must clear the session AND be stripped from the URL, so a refresh never
// repeats it and the browser never stays parked on /?logout=1.

const SESSION_KEYS = ['tt_token', 'tt_user', 'tt_employee', 'tt_roles', 'tt_timezone'];

function seedSession() {
  localStorage.setItem('tt_token', 'tok');
  localStorage.setItem('tt_user', JSON.stringify({ id: 1, full_name: 'Ada' }));
  localStorage.setItem('tt_roles', JSON.stringify(['employee']));
  localStorage.setItem('tt_timezone', 'America/Chicago');
}

function setUrl(url: string) {
  window.history.replaceState(null, '', url);
}

beforeEach(() => {
  localStorage.clear();
  setUrl('/');
});

describe('consumeLogoutSignal — one-time cross-app logout', () => {
  it('clears the session and strips ?logout=1 from the URL', () => {
    seedSession();
    setUrl('/?logout=1');

    const consumed = consumeLogoutSignal();

    expect(consumed).toBe(true);
    // Session cleared.
    SESSION_KEYS.forEach((k) => expect(localStorage.getItem(k)).toBeNull());
    // URL cleaned (no logout param), still on the app root.
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/');
  });

  it('does not log out again after the param has been consumed (refresh is clean)', () => {
    seedSession();
    setUrl('/?logout=1');
    consumeLogoutSignal(); // first consume strips the param

    // Simulate a fresh session established afterward + a refresh on the clean URL.
    seedSession();
    const consumedAgain = consumeLogoutSignal();

    expect(consumedAgain).toBe(false);
    expect(localStorage.getItem('tt_token')).toBe('tok'); // session intact — no loop
  });

  it('is a no-op for normal entry (no logout param) — a valid session survives', () => {
    seedSession();
    setUrl('/');

    expect(consumeLogoutSignal()).toBe(false);
    expect(localStorage.getItem('tt_token')).toBe('tok');
    expect(window.location.search).toBe('');
  });

  it('preserves other query parameters while removing only logout', () => {
    seedSession();
    setUrl('/?foo=bar&logout=1&baz=qux');

    expect(consumeLogoutSignal()).toBe(true);
    const params = new URLSearchParams(window.location.search);
    expect(params.get('logout')).toBeNull();
    expect(params.get('foo')).toBe('bar');
    expect(params.get('baz')).toBe('qux');
  });

  it('ignores a non-"1" logout value (only the explicit signal is honored)', () => {
    seedSession();
    setUrl('/?logout=0');

    expect(consumeLogoutSignal()).toBe(false);
    expect(localStorage.getItem('tt_token')).toBe('tok');
  });
});
