import { Link } from 'react-router-dom';
import Button from '../common/Button';
import './NotFoundPage.css';

export default function NotFoundPage() {
  return (
    <div className="notfound-container">
      <span className="material-icons notfound-icon">error_outline</span>
      <h1 className="notfound-title">404 - Page Not Found</h1>
      <p className="notfound-message">
        The workspace path or module folder you are looking for does not exist or has been moved.
      </p>
      <Link to="/">
        <Button variant="primary" icon="home">
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
}
