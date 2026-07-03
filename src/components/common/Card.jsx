import './Card.css';

/**
 * Card — surface container
 * Props:
 *   padding: 'none' | 'sm' | 'md' | 'lg'
 *   shadow: 'none' | 'sm' | 'md'
 *   className, children, ...rest
 */
export default function Card({
  children,
  padding = 'md',
  shadow = 'sm',
  className = '',
  ...rest
}) {
  return (
    <div
      className={['card', `card--pad-${padding}`, `card--shadow-${shadow}`, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
