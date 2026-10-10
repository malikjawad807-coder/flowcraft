'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiFetch, clearCsrfToken } from '@/lib/api-fetch';
import type { LoginInput, SignupInput } from '@flowcart/shared/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'user';
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  mfaEnabled?: boolean;
  timezone?: string;
}


interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (data: LoginInput) => Promise<void>;
  signup: (data: SignupInput) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<AuthUser>('/api/auth/me');
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    const handleUnauthorized = () => {
      setUser(null);
      clearCsrfToken();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [refreshUser]);

  const login = async (data: LoginInput) => {
    await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await refreshUser();
  };

  const signup = async (data: SignupInput) => {
    const res = await apiFetch<{ message: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res;
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Continue cleanup even if server logout errored
    } finally {
      setUser(null);
      clearCsrfToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
