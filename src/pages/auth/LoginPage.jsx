import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import './LoginPage.css';

export default function LoginPage() {
  const { login, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();

  // Route to send user back to original page or fallback to dashboard root
  const from = location.state?.from?.pathname || '/';

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    clearError();

    if (!email || !password) {
      setValidationError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    const res = await login(email, password);
    setLoading(false);

    if (res.success) {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="login-card-content">
      <div className="login-card-content__header">
        <h2 className="login-card-content__title">Sign In</h2>
        <p className="login-card-content__subtitle">
          Access your Company Operations Portal session.
        </p>
      </div>

      {(error || validationError) && (
        <div className="login-card-content__alert" role="alert">
          <span className="material-icons login-card-content__alert-icon">error</span>
          <span className="login-card-content__alert-text">
            {validationError || error}
          </span>
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="login-form">
        <Input
          id="email-address"
          type="email"
          label="Email Address"
          placeholder="admin@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setValidationError('');
            clearError();
          }}
          icon="email"
          required
          autoComplete="email"
        />

        <Input
          id="password"
          type={showPassword ? 'text' : 'password'}
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setValidationError('');
            clearError();
          }}
          icon="lock"
          required
          autoComplete="current-password"
          rightElement={
            <button
              type="button"
              className="login-form__pwd-toggle"
              onClick={toggleShowPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <span className="material-icons">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          }
        />

        <div className="login-form__actions">
          <span className="login-form__tip">
            Demo: admin@company.com / Admin@123
          </span>
          <Link
            to="/forgot-password"
            className="login-form__forgot-link font-medium"
            onClick={clearError}
          >
            Forgot Password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={loading}
        >
          Sign In
        </Button>
      </form>
    </div>
  );
}
