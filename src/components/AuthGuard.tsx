import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import LoginPage from '../pages/LoginPage';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, skipAuth, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!skipAuth && !user) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
