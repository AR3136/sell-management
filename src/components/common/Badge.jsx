import './Badge.css';

export default function Badge({ children, variant = 'info', size = 'md', className = '' }) {
  return (
    <span className={`badge badge--${variant} badge--${size} ${className}`}>
      {children}
    </span>
  );
}
