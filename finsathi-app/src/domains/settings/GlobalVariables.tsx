import React from 'react';
import { useSettingsStore } from '../../shared/hooks/useSettingsStore';

interface SettingRowProps {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  isLast?: boolean;
}

function SettingRow({ label, description, value, onChange, isLast }: SettingRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 0',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {/* Left: label + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="text-label-mono" style={{ marginBottom: '4px' }}>
          {label}
        </div>
        <div className="text-label-mono-sm color-subtle">{description}</div>
      </div>

      {/* Right: slider + number input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <input
          type="range"
          min={0}
          max={20}
          step={0.1}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            width: '120px',
            accentColor: 'var(--primary-container)',
            cursor: 'pointer',
          }}
        />
        <div style={{ position: 'relative' }}>
          <input
            type="number"
            min={0}
            max={20}
            step={0.1}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            style={{
              width: '80px',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--on-surface)',
              padding: '8px 24px 8px 12px',
              borderRadius: '4px',
              fontFamily: 'var(--font-headline)',
              fontSize: '12px',
              textAlign: 'right',
            }}
          />
          <span
            className="text-label-mono-sm color-muted"
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              fontSize: '10px',
            }}
          >
            %
          </span>
        </div>
      </div>
    </div>
  );
}

export function GlobalVariables() {
  const {
    baseInflationRate,
    educationInflationRate,
    expectedEquityReturn,
    expectedDebtReturn,
    updateSettings,
  } = useSettingsStore();

  return (
    <div className="global-variables animate-in" style={{ padding: '24px' }}>
      {/* ── Header ── */}
      <header className="ledger-header" style={{ marginBottom: '24px' }}>
        <div className="header-meta">
          <h1 className="text-headline-md tracking-tighter">GLOBAL_VARIABLES</h1>
          <div className="status-line">
            <span className="pulse-dot" />
            <span className="text-label-mono color-muted">MACRO_ECONOMIC_ADJUSTMENTS</span>
          </div>
        </div>
      </header>

      {/* ── Inflation Assumptions Card ── */}
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '16px',
        }}
      >
        <div
          className="text-label-mono"
          style={{
            color: 'var(--positive)',
            paddingBottom: '12px',
            marginBottom: '4px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '16px', fontVariationSettings: "'wght' 200" }}
          >
            trending_up
          </span>
          INFLATION_ASSUMPTIONS
        </div>

        <SettingRow
          label="BASE_INFLATION_RATE"
          description="Affects general wealth projections and living expenses."
          value={baseInflationRate}
          onChange={(v) => updateSettings({ baseInflationRate: v })}
        />
        <SettingRow
          label="EDUCATION_INFLATION_RATE"
          description="Education costs typically rise faster than general inflation."
          value={educationInflationRate}
          onChange={(v) => updateSettings({ educationInflationRate: v })}
          isLast
        />
      </div>

      {/* ── Return Assumptions Card ── */}
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '16px',
        }}
      >
        <div
          className="text-label-mono"
          style={{
            color: 'var(--positive)',
            paddingBottom: '12px',
            marginBottom: '4px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '16px', fontVariationSettings: "'wght' 200" }}
          >
            show_chart
          </span>
          RETURN_ASSUMPTIONS
        </div>

        <SettingRow
          label="EXPECTED_EQUITY_RETURN"
          description="Used for long-term compound interest calculations in SIPs/Mutual Funds."
          value={expectedEquityReturn}
          onChange={(v) => updateSettings({ expectedEquityReturn: v })}
        />
        <SettingRow
          label="EXPECTED_DEBT_RETURN"
          description="Used for FD, RD, and conservative bond projections."
          value={expectedDebtReturn}
          onChange={(v) => updateSettings({ expectedDebtReturn: v })}
          isLast
        />
      </div>
    </div>
  );
}
