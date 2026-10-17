import { type InputHTMLAttributes, useState, useEffect, useId } from 'react';
import { toPaise, toRupees } from '../lib/currency';
import './forms.css';

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  label: string;
  value: number; // Stored as paise (integer)
  onChange: (paise: number) => void;
  error?: string;
  hint?: string;
  allowNegative?: boolean;
  /** Accessible label for screen readers when visual label is empty */
  ariaLabel?: string;
}

export function NumberInput({
  label,
  value,
  onChange,
  error,
  hint,
  allowNegative = false,
  ariaLabel,
  className = '',
  ...props
}: NumberInputProps) {
  const uid = useId();
  const inputId = `number-input-${uid}`;
  const errorId = error ? `number-error-${uid}` : undefined;
  const hintId = hint && !error ? `number-hint-${uid}` : undefined;

  // Local state for the input string to allow typing decimal point
  const [inputValue, setInputValue] = useState<string>('');

  // Update local state when value prop changes (but not while typing)
  useEffect(() => {
    const rupees = toRupees(value);
    // If the numeric value matches what we have in the input, don't override
    // This prevents cursor jump or formatting issues while typing "10."
    if (parseFloat(inputValue) !== rupees) {
      setInputValue(value === 0 ? '' : rupees.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setInputValue('');
      onChange(0);
      return;
    }
    // Reject negative values when not allowed
    if (!allowNegative && val.includes('-')) return;
    // Allow negative sign, digits, and decimal point
    if ((allowNegative && val === '-') || /^\d*\.?\d*$/.test(val) || (allowNegative && /^-?\d*\.?\d*$/.test(val))) {
      setInputValue(val);
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        onChange(toPaise(parsed));
      } else {
        onChange(0);
      }
    }
  };

  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`vault-field ${className}`}>
      {label && <label htmlFor={inputId} className="text-label-mono-sm color-muted">{label}</label>}
      <div className={`vault-input-wrap ${error ? 'vault-input-wrap--error' : ''}`}>
        <span className="vault-input-affix vault-input-prefix text-label-mono-sm" aria-hidden="true">₹</span>
        <input
          id={inputId}
          className="vault-input"
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={handleChange}
          placeholder="0.00"
          aria-label={!label ? (ariaLabel || 'Amount in rupees') : undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          {...props}
        />
        <span className="vault-input-affix vault-input-suffix text-label-mono-sm color-muted" aria-hidden="true">INR</span>
      </div>
      {error && <span id={errorId} className="vault-field-error" role="alert">{error}</span>}
      {hint && !error && <span id={hintId} className="vault-field-hint">{hint}</span>}
    </div>
  );
}
