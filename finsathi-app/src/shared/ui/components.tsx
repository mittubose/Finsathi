import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import './components.css';

// ============ GlassCard ============
interface GlassCardProps {
  children: ReactNode;
  elevated?: boolean;
  className?: string;
}

export function GlassCard({ children, elevated, className = '' }: GlassCardProps) {
  return (
    <div className={`${elevated ? 'glass-surface-elevated' : 'glass-surface'} ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  trailing?: ReactNode;
  dark?: boolean;
}

export function CardHeader({ title, trailing, dark }: CardHeaderProps) {
  return (
    <div className="glass-card-header" style={dark ? { background: 'rgba(0,0,0,0.4)' } : undefined}>
      <h2 className="text-label-mono color-subtle">{title}</h2>
      {trailing}
    </div>
  );
}

// ============ Button ============
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: string;
  children: ReactNode;
}

export function Button({ variant = 'primary', icon, children, className = '', ...props }: ButtonProps) {
  return (
    <button className={`vault-btn vault-btn--${variant} ${className}`} {...props}>
      {icon && (
        <span className="material-symbols-outlined icon-sm" style={{ fontVariationSettings: "'wght' 300" }}>
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

// ============ Input ============
interface InputFieldProps {
  label: string;
  prefix?: string;
  suffix?: string;
  error?: string;
  hint?: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function InputField({ label, prefix, suffix, error, hint, ...inputProps }: InputFieldProps) {
  return (
    <div className="vault-field">
      <label className="text-label-mono-sm color-muted">{label}</label>
      <div className={`vault-input-wrap ${error ? 'vault-input-wrap--error' : ''}`}>
        {prefix && <span className="vault-input-affix vault-input-prefix">{prefix}</span>}
        <input className="vault-input" {...inputProps} />
        {suffix && <span className="vault-input-affix vault-input-suffix">{suffix}</span>}
      </div>
      {error && <span className="vault-field-error">{error}</span>}
      {hint && !error && <span className="vault-field-hint">{hint}</span>}
    </div>
  );
}

// ============ Select ============
interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  error?: string;
}

export function SelectField({ label, value, onChange, options, error }: SelectFieldProps) {
  return (
    <div className="vault-field">
      <label className="text-label-mono-sm color-muted">{label}</label>
      <select className={`vault-select ${error ? 'vault-input-wrap--error' : ''}`} value={value} onChange={onChange}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <span className="vault-field-error">{error}</span>}
    </div>
  );
}

// ============ Badge ============
type BadgeVariant = 'positive' | 'warning' | 'negative' | 'neutral';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  icon?: string;
}

export function Badge({ children, variant = 'neutral', icon }: BadgeProps) {
  return (
    <span className={`vault-badge vault-badge--${variant}`}>
      {icon && <span className="material-symbols-outlined icon-xs" style={{ fontVariationSettings: "'wght' 300" }}>{icon}</span>}
      {children}
    </span>
  );
}

// ============ StatusPip ============
interface StatusPipProps {
  status: 'active' | 'warning' | 'error' | 'idle';
  label?: string;
  pulse?: boolean;
}

export function StatusPip({ status, label, pulse }: StatusPipProps) {
  return (
    <span className="vault-status-pip-wrap">
      <span className={`vault-status-pip vault-status-pip--${status} ${pulse ? 'vault-status-pip--pulse' : ''}`} />
      {label && <span className="text-label-mono-sm">{label}</span>}
    </span>
  );
}

// ============ SegmentedProgress ============
interface SegmentedProgressProps {
  value: number; // 0-100
  segments?: number;
  label?: string;
  showValue?: boolean;
}

export function SegmentedProgress({ value, segments = 10, label, showValue = true }: SegmentedProgressProps) {
  const filledSegments = Math.round((value / 100) * segments);
  return (
    <div className="vault-seg-progress">
      {(label || showValue) && (
        <div className="vault-seg-progress-labels">
          {label && <span className="text-label-mono-sm color-muted">{label}</span>}
          {showValue && <span className="text-label-mono-sm color-muted">{value}%</span>}
        </div>
      )}
      <div className="vault-seg-progress-bar">
        {Array.from({ length: segments }, (_, i) => (
          <div key={i} className={`vault-seg-progress-segment ${i < filledSegments ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  );
}

// ============ Skeleton ============
interface SkeletonProps {
  width?: string;
  height?: string;
  variant?: 'text' | 'rect' | 'circle';
}

export function Skeleton({ width = '100%', height = '16px', variant = 'text' }: SkeletonProps) {
  return (
    <div
      className={`vault-skeleton vault-skeleton--${variant}`}
      style={{ width, height }}
    />
  );
}

// ============ EmptyState ============
interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="vault-empty-state">
      <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'rgba(255,255,255,0.12)' }}>{icon}</span>
      <span className="text-label-mono color-muted" style={{ marginTop: '8px' }}>{title}</span>
      {description && <span className="text-body color-muted" style={{ marginTop: '4px', fontSize: '12px' }}>{description}</span>}
      {action && <div style={{ marginTop: '12px' }}>{action}</div>}
    </div>
  );
}

// ============ Divider ============
export function Divider() {
  return <div className="vault-divider" />;
}

// ============ KeyValue ============
interface KVProps {
  label: string;
  value: ReactNode;
  valueClass?: string;
}

export function KV({ label, value, valueClass = '' }: KVProps) {
  return (
    <div className="vault-kv">
      <span className="color-muted">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

// ============ Checkbox ============
interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({ label, checked, onChange, disabled }: CheckboxProps) {
  return (
    <label className={`vault-checkbox ${disabled ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="vault-checkbox-input"
      />
      <div className="vault-checkbox-box">
        {checked && <span className="material-symbols-outlined">check</span>}
      </div>
      <span className="text-label-mono-sm">{label}</span>
    </label>
  );
}

// ============ Radio ============
interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  label?: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function RadioGroup({ label, options, value, onChange, disabled }: RadioGroupProps) {
  return (
    <div className="vault-field">
      {label && <label className="text-label-mono-sm color-muted">{label}</label>}
      <div className="vault-radio-group">
        {options.map((opt) => (
          <label key={opt.value} className={`vault-radio ${disabled ? 'disabled' : ''}`}>
            <input
              type="radio"
              name={label || 'vault-radio'}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              disabled={disabled}
              className="vault-radio-input"
            />
            <div className="vault-radio-circle" />
            <span className="text-label-mono-sm">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ============ ToggleSwitch ============
interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleSwitch({ label, checked, onChange, disabled }: ToggleProps) {
  return (
    <label className={`vault-toggle ${disabled ? 'disabled' : ''}`}>
      <span className="text-label-mono-sm">{label}</span>
      <div className="vault-toggle-wrap">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="vault-toggle-input"
        />
        <div className={`vault-toggle-track ${checked ? 'active' : ''}`}>
          <div className="vault-toggle-thumb" />
        </div>
      </div>
    </label>
  );
}
