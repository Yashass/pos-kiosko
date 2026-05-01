import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const WHITELIST = (import.meta.env.VITE_AUTH_WHITELIST ?? '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

function isAllowed(email: string): boolean {
  if (!WHITELIST.length) return true; // empty whitelist = allow everyone
  return WHITELIST.includes(email.toLowerCase());
}

interface AuthStore {
  user: User | null;
  loading: boolean;
  skipAuth: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

let initialized = false;

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  loading: true,
  skipAuth: false,
  error: null,

  initialize: async () => {
    if (initialized) return;
    initialized = true;

    // If Supabase is not configured, bypass auth (dev/offline mode)
    if (!isSupabaseConfigured()) {
      set({ user: null, loading: false, skipAuth: true });
      return;
    }

    set({ loading: true });

    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      if (!isAllowed(session.user.email ?? '')) {
        await supabase.auth.signOut();
        set({ user: null, loading: false, error: 'Email no autorizado' });
        return;
      }
      set({ user: session.user, loading: false });
    } else {
      set({ user: null, loading: false });
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        if (!isAllowed(session.user.email ?? '')) {
          await supabase.auth.signOut();
          set({ user: null, error: 'Email no autorizado para acceder a esta aplicación' });
          toast.error('Email no autorizado');
          return;
        }
        set({ user: session.user, error: null });
      } else if (event === 'SIGNED_OUT') {
        set({ user: null });
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        set({ user: session.user });
      }
    });
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(`Error al iniciar sesión: ${error.message}`);
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
}));
