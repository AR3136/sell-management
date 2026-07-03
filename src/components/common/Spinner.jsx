import './Spinner.css';

/**
 * Spinner — loading indicator
 * Props: size ('sm' | 'md' | 'lg'), color ('primary' | 'white')
 */
export default function Spinner({ size = 'md', color = 'primary' }) {
  return (
    <div className={`spinner spinner--${size} spinner--${color}`} role="status" aria-label="Loading">
      <div className="spinner__ring" />
    </div>
  );
}
