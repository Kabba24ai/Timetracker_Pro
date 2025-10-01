const API_URL = 'http://localhost:3001/api';

export interface LoginResponse {
  user: {
    id: string;
    email: string;
  };
  employee: {
    id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: 'employee' | 'admin';
  };
  session: {
    access_token: string;
    refresh_token: string;
  };
}

export interface TimeEntry {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  break_duration: number;
  notes: string | null;
  status: 'active' | 'completed' | 'edited';
  created_at: string;
  updated_at: string;
}

class ApiService {
  private getAuthHeader(): HeadersInit {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    return response.json();
  }

  async logout(): Promise<void> {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: this.getAuthHeader()
    });

    if (!response.ok) {
      throw new Error('Logout failed');
    }
  }

  async getMe(): Promise<LoginResponse> {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: this.getAuthHeader()
    });

    if (!response.ok) {
      throw new Error('Failed to get user data');
    }

    return response.json();
  }

  async clockIn(): Promise<TimeEntry> {
    const response = await fetch(`${API_URL}/time-entries/clock-in`, {
      method: 'POST',
      headers: this.getAuthHeader()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Clock in failed');
    }

    return response.json();
  }

  async clockOut(breakDuration: number = 0, notes: string = ''): Promise<TimeEntry> {
    const response = await fetch(`${API_URL}/time-entries/clock-out`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({ break_duration: breakDuration, notes })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Clock out failed');
    }

    return response.json();
  }

  async getMyEntries(): Promise<TimeEntry[]> {
    const response = await fetch(`${API_URL}/time-entries/my-entries`, {
      headers: this.getAuthHeader()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch time entries');
    }

    return response.json();
  }
}

export const api = new ApiService();
