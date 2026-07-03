import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';

/**
 * ProtectedRoute
 * Wraps any route that requires authentication.
 * - If auth is still loading (hydrating from localStorage) → show spinner
 * - If not authenticated → redirect to /login with return URL
 * - If authenticated → render children
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="protected-route-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
