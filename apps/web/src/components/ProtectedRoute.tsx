"use client";

import { Navigate } from "@/lib/router-shim";
import { useAuth } from "@/lib/auth-shim";
import { useUserProfile } from "@/hooks/useUserProfile";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isPending } = useAuth();
  const { loading: profileLoading, error: profileError } = useUserProfile();

  if (isPending || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profileError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Acesso Negado</h2>
            <p className="text-red-600">{profileError}</p>
            <p className="text-sm text-gray-600 mt-4">
              Entre em contato com o administrador do sistema para solicitar acesso.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
