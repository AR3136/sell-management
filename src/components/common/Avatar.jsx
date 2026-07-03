import './Avatar.css';

export default function Avatar({ name, src, size = 'md', className = '' }) {
  const getInitials = (userName) => {
    if (!userName) return '?';
    const parts = userName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <div className={`avatar avatar--${size} ${className}`} title={name}>
      {src ? (
        <img src={src} alt={name} className="avatar__img" />
      ) : (
        <span className="avatar__initials">{getInitials(name)}</span>
      )}
    </div>
  );
}
