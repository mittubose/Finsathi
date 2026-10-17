import './forms.css';

interface RadioOption {
  value: string | number;
  label: string;
}

interface RadioGroupProps {
  label: string;
  options: RadioOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  error?: string;
  disabled?: boolean;
  name: string;
}

export function RadioGroup({
  label,
  options,
  value,
  onChange,
  error,
  disabled,
  name,
}: RadioGroupProps) {
  return (
    <div className="vault-field">
      <label className="text-label-mono-sm color-muted">{label}</label>
      <div className="vault-radio-list">
        {options.map((opt) => (
          <label 
            key={opt.value} 
            className={`vault-radio-wrap ${disabled ? 'disabled' : ''}`}
          >
            <div className="vault-radio-input-container">
              <input
                type="radio"
                name={name}
                className="vault-radio-native"
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                disabled={disabled}
              />
              <div className="vault-radio-circle">
                {value === opt.value && <div className="vault-radio-dot" />}
              </div>
            </div>
            <span className="text-label-mono-sm">{opt.label}</span>
          </label>
        ))}
      </div>
      {error && <span className="vault-field-error">{error}</span>}
    </div>
  );
}
