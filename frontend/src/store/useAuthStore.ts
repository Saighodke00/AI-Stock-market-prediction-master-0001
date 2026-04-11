import { create } from 'zustand';

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Hydrate from localStorage on init
  const storedToken = localStorage.getItem('apex_token');
  const storedUser = localStorage.getItem('apex_user');
  
  let initialUser = null;
  if (storedUser) {
    try {
      initialUser = JSON.parse(storedUser);
    } catch {
      localStorage.removeItem('apex_user');
    }
  }

  return {
    token: storedToken,
    user: initialUser,
    isAuthenticated: !!storedToken,

    login: (token, user) => {
      localStorage.setItem('apex_token', token);
      localStorage.setItem('apex_user', JSON.stringify(user));
      set({ token, user, isAuthenticated: true });
    },

    logout: () => {
      localStorage.removeItem('apex_token');
      localStorage.removeItem('apex_user');
      set({ token: null, user: null, isAuthenticated: false });
    },
  };
});
