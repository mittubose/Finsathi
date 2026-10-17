import { type SelectHTMLAttributes } from 'react';
import './forms.css';

interface Option {
  value: string | number;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  error?: string;
  hint?: string;
}

export function Select({
  label,
  options,
  error,
  hint,
  className = '',
  ...props
}: SelectProps) {
  return (
    <div className={`vault-field ${className}`}>
      <label className="text-label-mono-sm color-muted">{label}</label>
      <div className={`vault-select-wrap ${error ? 'vault-input-wrap--error' : ''}`}>
        <select className="vault-select-native" {...props}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="material-symbols-outlined vault-select-icon">
          expand_more
        </span>
      </div>
      {error && <span className="vault-field-error">{error}</span>}
      {hint && !error && <span className="vault-field-hint">{hint}</span>}
    </div>
  );
}
