'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const load = () => {
      const storedUser = window.localStorage.getItem('portal_user');
      if (!storedUser) {
        setIsLoading(false);
        return;
      }
      try {
        setUser(JSON.parse(storedUser) as User);
      } catch {
        window.localStorage.removeItem('portal_user');
      } finally {
        setIsLoading(false);
      }
    };

    const id = window.setTimeout(load, 0);
    return () => window.clearTimeout(id);
  }, []);

  const login = async (email: string) => {
    // Simulate API call
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const mockUser: User = {
            id: 'mock-user-id',
            email,
            name: 'Admin User',
            role: 'admin',
          };
        setUser(mockUser);
        window.localStorage.setItem('portal_user', JSON.stringify(mockUser));
        setIsLoading(false);
        resolve();
      }, 1000);
    });
  };

  const logout = () => {
    setUser(null);
    window.localStorage.removeItem('portal_user');
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
