import './Button.css';

/**
 * Button — reusable button component
 * Props:
 *   variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
 *   size: 'sm' | 'md' | 'lg'
 *   icon: string (material icon name, shown left)
 *   iconRight: string (material icon name, shown right)
 *   loading: boolean
 *   disabled: boolean
 *   fullWidth: boolean
 *   onClick, type, ...rest
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      className={[
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        fullWidth ? 'btn--full' : '',
        loading ? 'btn--loading' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span className="btn__spinner" aria-hidden="true" />
      )}
      {!loading && icon && (
        <span className="material-icons btn__icon">{icon}</span>
      )}
      {children && <span className="btn__label">{children}</span>}
      {!loading && iconRight && (
        <span className="material-icons btn__icon btn__icon--right">{iconRight}</span>
      )}
    </button>
  );
}
