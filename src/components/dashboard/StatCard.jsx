import './StatCard.css';
import Card from '../common/Card';

export default function StatCard({
  title,
  value,
  icon,
  trend,
  trendDirection = 'up', // 'up' | 'down' | 'neutral'
  color = 'primary',
  className = '',
}) {
  return (
    <Card padding="md" className={`stat-card stat-card--${color} ${className}`}>
      <div className="stat-card__main">
        <div className="stat-card__info">
          <span className="stat-card__title">{title}</span>
          <span className="stat-card__value">{value}</span>
        </div>
        <div className={`stat-card__icon-wrapper stat-card__icon-wrapper--${color}`}>
          <span className="material-icons">{icon}</span>
        </div>
      </div>
      {trend && (
        <div className="stat-card__trend">
          <span
            className={`material-icons stat-card__trend-icon stat-card__trend-icon--${trendDirection}`}
          >
            {trendDirection === 'up'
              ? 'trending_up'
              : trendDirection === 'down'
              ? 'trending_down'
              : 'remove'}
          </span>
          <span className={`stat-card__trend-text stat-card__trend-text--${trendDirection}`}>
            {trend}
          </span>
        </div>
      )}
    </Card>
  );
}
