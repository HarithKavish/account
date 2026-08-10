'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getAuthBackend } from '@/lib/account/backend';
import type {
  AccountUser,
  AuthCapabilities,
  ProfileInput,
  Result,
  SignInInput,
  SignUpInput,
} from '@/lib/account/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AccountUser | null;
  capabilities: AuthCapabilities;
  /** True while the installed backend is the Phase 1 demo. Drives the banner. */
  isDemo: boolean;
  signIn: (input: SignInInput) => Promise<Result<AccountUser>>;
  signUp: (input: SignUpInput) => Promise<Result<AccountUser>>;
  signOut: () => Promise<void>;
  updateProfile: (input: ProfileInput) => Promise<Result<AccountUser>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const backend = useMemo(() => getAuthBackend(), []);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AccountUser | null>(null);

  // The demo session lives in browser storage, so it can only be resolved after
  // hydration. Until then `status` stays 'loading' and guards hold their render
  // rather than flashing the wrong screen.
  useEffect(() => {
    let active = true;
    backend
      .getCurrentUser()
      .then((current) => {
        if (!active) return;
        setUser(current);
        setStatus(current ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus('unauthenticated');
      });
    return () => {
      active = false;
    };
  }, [backend]);

  const signIn = useCallback(
    async (input: SignInInput) => {
      const result = await backend.signIn(input);
      if (result.ok) {
        setUser(result.data);
        setStatus('authenticated');
      }
      return result;
    },
    [backend],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      const result = await backend.signUp(input);
      if (result.ok) {
        setUser(result.data);
        setStatus('authenticated');
      }
      return result;
    },
    [backend],
  );

  const signOut = useCallback(async () => {
    await backend.signOut();
    setUser(null);
    setStatus('unauthenticated');
  }, [backend]);

  const updateProfile = useCallback(
    async (input: ProfileInput) => {
      const result = await backend.updateProfile(input);
      if (result.ok) setUser(result.data);
      return result;
    },
    [backend],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      capabilities: backend.capabilities,
      isDemo: backend.kind === 'mock',
      signIn,
      signUp,
      signOut,
      updateProfile,
    }),
    [status, user, backend, signIn, signUp, signOut, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}
