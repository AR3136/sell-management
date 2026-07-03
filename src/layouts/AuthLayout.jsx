import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthLayout.css';

export default function AuthLayout() {
  const { isAuthenticated } = useAuth();

  // If already logged in, skip auth pages and send to dashboard
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="auth-layout">
      <div className="auth-layout__card">
        <div className="auth-layout__logo-container">
          <span className="material-icons auth-layout__logo-icon">business</span>
          <span className="auth-layout__brand">Company Portal</span>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
