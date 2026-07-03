import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../../services/authService';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import './ForgotPasswordPage.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMsg('');

    if (!email) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setLoading(true);
    const result = await requestPasswordReset(email);
    setLoading(false);

    if (result.success) {
      setSuccessMessage(result.message);
      setEmail('');
    } else {
      setErrorMsg(result.error || 'Failed to send reset link.');
    }
  };

  return (
    <div className="forgot-card-content">
      <div className="forgot-card-content__header">
        <h2 className="forgot-card-content__title">Forgot Password</h2>
        <p className="forgot-card-content__subtitle">
          Enter your email to receive a password reset link.
        </p>
      </div>

      {successMessage && (
        <div className="forgot-card-content__alert forgot-card-content__alert--success" role="alert">
          <span className="material-icons forgot-card-content__alert-icon">check_circle</span>
          <span className="forgot-card-content__alert-text">{successMessage}</span>
        </div>
      )}

      {errorMsg && (
        <div className="forgot-card-content__alert forgot-card-content__alert--danger" role="alert">
          <span className="material-icons forgot-card-content__alert-icon">error</span>
          <span className="forgot-card-content__alert-text">{errorMsg}</span>
        </div>
      )}

      {!successMessage && (
        <form onSubmit={handleSubmit} className="forgot-form">
          <Input
            id="forgot-email"
            type="email"
            label="Email Address"
            placeholder="admin@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrorMsg('');
            }}
            icon="email"
            required
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
          >
            Send Reset Link
          </Button>
        </form>
      )}

      <div className="forgot-card-content__footer">
        <Link to="/login" className="forgot-card-content__back-link font-medium">
          <span className="material-icons">arrow_back</span>
          <span>Back to Sign In</span>
        </Link>
      </div>
    </div>
  );
}
