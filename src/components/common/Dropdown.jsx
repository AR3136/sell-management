import { useState, useEffect, useRef } from 'react';
import './Dropdown.css';

export default function Dropdown({
  trigger,
  children,
  align = 'right',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div className={`dropdown-container ${className}`} ref={dropdownRef}>
      <div className="dropdown-trigger" onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      {isOpen && (
        <div className={`dropdown-menu dropdown-menu--${align}`} onClick={() => setIsOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
