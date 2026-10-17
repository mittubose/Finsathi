import { type InputHTMLAttributes } from 'react';
import './forms.css';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}

export function Checkbox({
  label,
  checked,
  onChange,
  error,
  disabled,
  className = '',
  ...props
}: CheckboxProps) {
  return (
    <div className={`vault-checkbox-field ${className}`}>
      <label className={`vault-checkbox-wrap ${disabled ? 'disabled' : ''}`}>
        <div className="vault-checkbox-input-container">
          <input
            type="checkbox"
            className="vault-checkbox-native"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            {...props}
          />
          <div className="vault-checkbox-box">
            {checked && (
              <span className="material-symbols-outlined vault-checkbox-icon">
                check
              </span>
            )}
          </div>
        </div>
        <span className="text-label-mono-sm">{label}</span>
      </label>
      {error && <span className="vault-field-error">{error}</span>}
    </div>
  );
}
