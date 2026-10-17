import { type InputHTMLAttributes, useState } from 'react';
import './forms.css';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  prefixIcon?: string;
  suffixIcon?: string;
  isPassword?: boolean;
}

export function TextInput({
  label,
  error,
  hint,
  prefixIcon,
  suffixIcon,
  isPassword,
  type = 'text',
  className = '',
  ...props
}: TextInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
   // const hasSuffix = suffixIcon || isPassword;

  return (
    <div className={`vault-field ${className}`}>
      <label className="text-label-mono-sm color-muted">{label}</label>
      <div className={`vault-input-wrap ${error ? 'vault-input-wrap--error' : ''}`}>
        {prefixIcon && (
          <span className="vault-input-affix vault-input-prefix material-symbols-outlined icon-sm">
            {prefixIcon}
          </span>
        )}
        <input 
          className="vault-input" 
          type={inputType}
          {...props} 
        />
        {isPassword && (
          <button 
            type="button"
            className="vault-input-affix vault-input-suffix btn-ghost"
            onClick={() => setShowPassword(!showPassword)}
          >
            <span className="material-symbols-outlined icon-sm">
              {showPassword ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        )}
        {suffixIcon && !isPassword && (
          <span className="vault-input-affix vault-input-suffix material-symbols-outlined icon-sm">
            {suffixIcon}
          </span>
        )}
      </div>
      {error && <span className="vault-field-error">{error}</span>}
      {hint && !error && <span className="vault-field-hint">{hint}</span>}
    </div>
  );
}
