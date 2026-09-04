// TimeTracker API client — talks to the kabba2 Laravel "TimeTracker V2" REST API.
//
// Base URL comes from VITE_API_URL (the /api root, e.g. https://api.rentnking.com/api).
// This client appends the /time-tracker/v2 namespace, sends the Sanctum bearer
// token, and normalizes the { success, message, data, errors } envelope.
//
// V2 is authoritative: the server validates every clock transition, computes the
// state, and returns allowed_actions. React never re-derives the state machine.

const API_ROOT = ((import.meta.env.VITE_API_URL as string | undefined) || 'http://api.kabba.local:8000/api').replace(/\/+$/, '');

// The TimeTracker V2 namespace under the API root.
const TT = '/time-tracker/v2';

const TOKEN_KEY = 'tt_token';

// Fired when any request returns 401 so AuthContext can force a clean logout.
export const AUTH_ERROR_EVENT = 'tt:unauthorized';

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
  // Some endpoints add extra top-level keys (current_period, stats, meta,
  // user, employee, roles, active_break, ...).
  [key: string]: unknown;
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  payload?: unknown;

  constructor(message: string, status: number, errors?: Record<string, string[]>, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.payload = payload;
  }

  /** First validation message if present, else the main message. */
  firstError(): string {
    if (this.errors) {
      const first = Object.values(this.errors)[0];
      if (first && first.length) return first[0];
    }
    return this.message;
  }
}

class ApiClient {
  private token: string | null = localStorage.getItem(TOKEN_KEY);

  setToken(token: string | null): void {
    this.token = token;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<ApiEnvelope<T>> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    let response: Response;
    try {
      response = await fetch(`${API_ROOT}${TT}${path}`, { ...options, headers });
    } catch {
      throw new ApiError('Could not reach the server. Please check your connection and try again.', 0);
    }

    // Read as text first so non-JSON responses (e.g. an HTML error page) don't throw.
    const text = await response.text();
    let body: ApiEnvelope<T> | undefined;
    if (text) {
      try {
        body = JSON.parse(text) as ApiEnvelope<T>;
      } catch {
        body = { success: false, message: text } as ApiEnvelope<T>;
      }
    }

    if (response.status === 401) {
      this.setToken(null);
      window.dispatchEvent(new CustomEvent(AUTH_ERROR_EVENT));
      throw new ApiError(body?.message || 'Your session has expired. Please sign in again.', 401, body?.errors, body);
    }

    if (!response.ok) {
      throw new ApiError(body?.message || 'The request could not be completed.', response.status, body?.errors, body);
    }

    return (body ?? ({ success: true } as ApiEnvelope<T>));
  }

  get<T>(path: string): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined });
  }

  put<T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, { method: 'PUT', body: body != null ? JSON.stringify(body) : undefined });
  }

  patch<T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined });
  }

  del<T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, { method: 'DELETE', body: body != null ? JSON.stringify(body) : undefined });
  }

  /** Raw fetch (with auth header) for non-JSON responses such as CSV exports. */
  raw(path: string, options: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = { ...((options.headers as Record<string, string>) || {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return fetch(`${API_ROOT}${TT}${path}`, { ...options, headers });
  }
}

export const api = new ApiClient();
export const API_ROOT_URL = API_ROOT;
