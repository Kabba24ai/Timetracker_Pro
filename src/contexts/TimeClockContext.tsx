import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { ApiError } from '../lib/api';
import {
  ClockAction,
  ClockBreak,
  ClockShift,
  ClockState,
  ClockStatus,
  fetchClockState,
  performClockAction,
} from '../lib/timeclock';

// The clock context holds the server's authoritative state. It NEVER derives
// which actions are legal — it renders `allowed_actions` and dispatches them.
// Every action returns the new state, so there is no optimistic guessing and no
// local state machine to drift out of sync with the backend.
interface TimeClockContextType {
  state: ClockState | null;
  status: ClockStatus | null;
  statusLabel: string;
  allowedActions: ClockAction[];
  shift: ClockShift | null;
  openBreak: ClockBreak | null;
  loading: boolean; // initial state load in flight
  working: boolean; // a clock action is in flight
  error: string | null;
  /** True if the server currently permits this action from the present state. */
  can: (action: ClockAction) => boolean;
  /** Re-fetch the authoritative state (GET /clock/state). */
  refresh: () => Promise<void>;
  /** Dispatch a clock action; the server validates it and returns the new state. */
  perform: (action: ClockAction) => Promise<void>;
}

const TimeClockContext = createContext<TimeClockContextType>({} as TimeClockContextType);

export const useTimeClock = (): TimeClockContextType => {
  const context = useContext(TimeClockContext);
  if (!context) {
    throw new Error('useTimeClock must be used within a TimeClockProvider');
  }
  return context;
};

export const TimeClockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, initialClockState } = useAuth();
  // Seed from the login / session-restore payload so the card renders correct
  // controls immediately, then confirm with a fresh /clock/state fetch.
  const [state, setState] = useState<ClockState | null>(initialClockState);
  const [loading, setLoading] = useState<boolean>(false);
  const [working, setWorking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const next = await fetchClockState();
      setState(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your clock status.');
    }
  }, [user]);

  // Seed immediately when a fresh clock_state arrives from auth (login/restore).
  useEffect(() => {
    if (initialClockState) setState(initialClockState);
  }, [initialClockState]);

  // On sign-in (or reload once the session is restored), confirm with the server.
  useEffect(() => {
    if (!user) {
      setState(null);
      return;
    }
    let active = true;
    setLoading(true);
    fetchClockState()
      .then((next) => {
        if (active) setState(next);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'Could not load your clock status.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const perform = useCallback(
    async (action: ClockAction) => {
      setError(null);
      setWorking(true);
      try {
        const next = await performClockAction(action);
        setState(next);
      } catch (err) {
        setError(err instanceof ApiError ? err.firstError() : 'That action could not be completed.');
        throw err;
      } finally {
        setWorking(false);
      }
    },
    [],
  );

  const can = useCallback(
    (action: ClockAction) => !!state?.allowed_actions?.includes(action),
    [state],
  );

  return (
    <TimeClockContext.Provider
      value={{
        state,
        status: state?.status ?? null,
        statusLabel: state?.status_label ?? '',
        allowedActions: state?.allowed_actions ?? [],
        shift: state?.shift ?? null,
        openBreak: state?.open_break ?? null,
        loading,
        working,
        error,
        can,
        refresh,
        perform,
      }}
    >
      {children}
    </TimeClockContext.Provider>
  );
};
