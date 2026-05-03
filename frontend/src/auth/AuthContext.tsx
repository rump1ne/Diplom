import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';

type Role = 'USER' | 'ADMIN' | 'HR';

export interface AuthUser {
  id: number;
  email: string;
  nickname: string;
  position: string | null;
  role: Role;
  balance: number;
  totalEarned: number;
  completedQuests: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'krissquest-token';

async function apiRequest<T>(path: string, options: RequestInit = {}, token: string | null = null): Promise<T> {
  const res = await fetch(apiUrl(`/api${path}`), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    const message = data?.error || `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const refreshUser = async () => {
    if (!token) {
      return;
    }
    const fullUser = await apiRequest<AuthUser>('/users/me', {}, token);
    setUser(fullUser);
  };

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (stored) {
      setToken(stored);
      apiRequest<AuthUser>('/users/me', {}, stored)
        .then(setUser)
        .catch(() => {
          window.localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        });
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiRequest<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    window.localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    const fullUser = await apiRequest<AuthUser>('/users/me', {}, data.token);
    setUser(fullUser);
  };

  const logout = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, token, login, logout, refreshUser }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};

