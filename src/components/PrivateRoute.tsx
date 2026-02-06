import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PrivateRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, adminOnly = false }) => {
  const { user, loading, profileLoading, userRole } = useAuth();

  if (loading || (adminOnly && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Si la route est réservée aux admins, vérifier le rôle de l'utilisateur
  if (adminOnly) {
    if (userRole !== 'admin') {
      // Rediriger vers le dashboard si l'utilisateur n'est pas admin
      return <Navigate to="/dashboard" />;
    }
  }

  return <>{children}</>;
};

export default PrivateRoute;