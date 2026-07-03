import './EmptyState.css';

export default function EmptyState({
  icon = 'inbox',
  title = 'No Data Available',
  message = 'There is nothing to display here right now.',
  action,
  className = '',
}) {
  return (
    <div className={`empty-state ${className}`}>
      <span className="material-icons empty-state__icon">{icon}</span>
      <h3 className="empty-state__title">{title}</h3>
      <p className="empty-state__message">{message}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
