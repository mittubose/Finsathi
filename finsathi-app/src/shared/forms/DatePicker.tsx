import { type InputHTMLAttributes } from 'react';
import './forms.css';

interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  label: string;
  value: string; // ISO string YYYY-MM-DD
  onChange: (date: string) => void;
  error?: string;
  hint?: string;
}

export function DatePicker({
  label,
  value,
  onChange,
  error,
  hint,
  className = '',
  ...props
}: DatePickerProps) {
  return (
    <div className={`vault-field ${className}`}>
      <label className="text-label-mono-sm color-muted">{label}</label>
      <div className={`vault-input-wrap ${error ? 'vault-input-wrap--error' : ''}`}>
        <span className="vault-input-affix vault-input-prefix material-symbols-outlined icon-sm">
          calendar_today
        </span>
        <input
          className="vault-input vault-date-input"
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        />
      </div>
      {error && <span className="vault-field-error">{error}</span>}
      {hint && !error && <span className="vault-field-hint">{hint}</span>}
    </div>
  );
}
