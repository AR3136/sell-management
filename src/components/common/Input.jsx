import './Input.css';

/**
 * Input — reusable text/email/password input
 * Props:
 *   label: string
 *   id: string (required for a11y)
 *   error: string
 *   hint: string
 *   icon: string (material icon, left)
 *   rightElement: ReactNode (e.g. password toggle)
 *   ...rest: any native input props
 */
export default function Input({
  label,
  id,
  error,
  hint,
  icon,
  rightElement,
  className = '',
  ...rest
}) {
  return (
    <div className={`input-field ${className}`}>
      {label && (
        <label className="input-field__label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className={`input-field__wrapper ${error ? 'input-field__wrapper--error' : ''}`}>
        {icon && (
          <span className="material-icons input-field__icon">{icon}</span>
        )}
        <input
          id={id}
          className={`input-field__input ${icon ? 'input-field__input--with-icon' : ''}`}
          {...rest}
        />
        {rightElement && (
          <div className="input-field__right">{rightElement}</div>
        )}
      </div>
      {error && <p className="input-field__error">{error}</p>}
      {hint && !error && <p className="input-field__hint">{hint}</p>}
    </div>
  );
}
