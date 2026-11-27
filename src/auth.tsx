import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  signIn,
  signUp,
  confirmSignUp,
  signInWithRedirect,
  signOut,
  getCurrentUser,
  fetchAuthSession,
} from 'aws-amplify/auth';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  groups: string[];
  isAdmin: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  confirmRegistration: (email: string, code: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | undefined>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload || {};
      const groups = (payload['cognito:groups'] as string[]) || [];

      setUser({
        id: currentUser.userId,
        email: (payload.email as string) || currentUser.signInDetails?.loginId || '',
        name: (payload.name as string) || (payload.email as string) || 'Chef',
        groups,
        isAdmin: groups.includes('Admins'),
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    await signIn({ username: email, password });
    await loadUser();
  };

  const register = async (email: string, password: string, name: string) => {
    await signUp({
      username: email,
      password,
      options: { userAttributes: { email, name } },
    });
    await signIn({ username: email, password });
    await loadUser();
  };

  

  const confirmRegistration = async (email: string, code: string) => {
    await confirmSignUp({ username: email, confirmationCode: code });
  };

  const loginWithGoogle = async () => {
    await signInWithRedirect({ provider: 'Google' });
  };

  const logout = async () => {
    await signOut();
    setUser(null);
  };

  const getToken = async () => {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, confirmRegistration, loginWithGoogle, logout, getToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
