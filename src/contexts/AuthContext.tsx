import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError, AUTH_ERROR_EVENT } from '../lib/api';
import { ClockState } from '../lib/timeclock';

// Employee = the kabba2 V2 EmployeeResource. Typed loosely (index signature) so
// screens can read the fields they need without us mirroring every column.
export interface Employee {
  id: number;
  user_id?: number;
  unique_id?: string;
  employee_code?: string;
  first_name: string;
  last_name?: string;
  email?: string;
  role?: string;
  roles?: string[];
  shift_start_time?: string | null;
  shift_end_time?: string | null;
  store?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface AuthUser {
  id: number;
  full_name: string;
  email?: string;
  status?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  employee: Employee | null;
  roles: string[];
  isAdmin: boolean;
  loading: boolean;
  /** The authoritative clock state from the last login / session restore (seed for the clock UI). */
  initialClockState: ClockState | null;
  /** Canonical tenant TimeTracker timezone (IANA id) from the server; null until known. */
  timezone: string | null;
  /** Log in with a user id + 6-digit employee code (the kabba2 V2 model). */
  signIn: (userId: number, employeeCode: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const USER_KEY = 'tt_user';
const EMP_KEY = 'tt_employee';
const ROLES_KEY = 'tt_roles';
const TZ_KEY = 'tt_timezone';
const ADMIN_ROLE = 'master_admin';

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

interface LoginResponse {
  user: AuthUser & { token?: string };
  employee: Employee;
  roles?: string[];
  clock_state?: ClockState;
  message?: string;
}

interface MeResponse {
  employee: Employee;
  roles?: string[];
  clock_state?: ClockState;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Restore the session synchronously from localStorage so a reload keeps the
  // user signed in without a flash; /auth/me then validates the token and
  // refreshes employee/roles/clock_state (a stale token surfaces as a 401,
  // which fires AUTH_ERROR_EVENT and clears the session).
  const [user, setUser] = useState<AuthUser | null>(() => readJson<AuthUser>(USER_KEY));
  const [employee, setEmployee] = useState<Employee | null>(() => readJson<Employee>(EMP_KEY));
  const [roles, setRoles] = useState<string[]>(() => readJson<string[]>(ROLES_KEY) ?? []);
  const [initialClockState, setInitialClockState] = useState<ClockState | null>(null);
  const [timezone, setTimezone] = useState<string | null>(() => localStorage.getItem(TZ_KEY));
  // Only block the UI on startup if there is a token to validate.
  const [loading, setLoading] = useState<boolean>(() => !!api.getToken());

  const clearSession = useCallback(() => {
    api.setToken(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EMP_KEY);
    localStorage.removeItem(ROLES_KEY);
    localStorage.removeItem(TZ_KEY);
    setUser(null);
    setEmployee(null);
    setRoles([]);
    setInitialClockState(null);
    setTimezone(null);
  }, []);

  // Persist the canonical tenant timezone whenever the server reports it.
  const rememberTimezone = useCallback((tz?: string | null) => {
    if (tz) {
      localStorage.setItem(TZ_KEY, tz);
      setTimezone(tz);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const onUnauthorized = () => clearSession();
    window.addEventListener(AUTH_ERROR_EVENT, onUnauthorized);

    // Session restore: with a token present, confirm it and refresh the session
    // from the server (source of truth). Without one, there is nothing to do.
    if (api.getToken()) {
      api
        .get<unknown>('/auth/me')
        .then((res) => {
          if (!active) return;
          const me = res as unknown as MeResponse;
          if (me.employee) {
            setEmployee(me.employee);
            localStorage.setItem(EMP_KEY, JSON.stringify(me.employee));
          }
          const nextRoles = me.roles ?? me.employee?.roles ?? [];
          setRoles(nextRoles);
          localStorage.setItem(ROLES_KEY, JSON.stringify(nextRoles));
          if (me.clock_state) setInitialClockState(me.clock_state);
          rememberTimezone(me.clock_state?.timezone);
        })
        .catch(() => {
          // A 401 already cleared the session via AUTH_ERROR_EVENT; other errors
          // (e.g. offline) keep the restored localStorage session in place.
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      active = false;
      window.removeEventListener(AUTH_ERROR_EVENT, onUnauthorized);
    };
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async (userId: number, employeeCode: string) => {
    const res = (await api.post<unknown>('/auth/login', {
      user_id: userId,
      employee_code: employeeCode,
    })) as unknown as LoginResponse;

    const token = res.user?.token;
    if (!token) {
      throw new ApiError(res.message || 'Login failed. Please try again.', 401);
    }
    api.setToken(token);

    const nextUser: AuthUser = {
      id: res.user.id,
      full_name: res.user.full_name,
      email: res.user.email,
      status: res.user.status,
    };
    const nextEmployee = res.employee;
    const nextRoles = res.roles ?? nextEmployee?.roles ?? [];

    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    localStorage.setItem(EMP_KEY, JSON.stringify(nextEmployee));
    localStorage.setItem(ROLES_KEY, JSON.stringify(nextRoles));

    setUser(nextUser);
    setEmployee(nextEmployee);
    setRoles(nextRoles);
    setInitialClockState(res.clock_state ?? null);
    rememberTimezone(res.clock_state?.timezone);
  }, [rememberTimezone]);

  const signOut = useCallback(async () => {
    // Revoke the token server-side (proper logout), then clear locally regardless
    // of the network result so the user is always signed out on this device.
    try {
      if (api.getToken()) await api.post('/auth/logout');
    } catch {
      // Ignore — we clear the local session either way.
    }
    clearSession();
  }, [clearSession]);

  const isAdmin = roles.includes(ADMIN_ROLE);

  return (
    <AuthContext.Provider
      value={{ user, employee, roles, isAdmin, loading, initialClockState, timezone, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};
