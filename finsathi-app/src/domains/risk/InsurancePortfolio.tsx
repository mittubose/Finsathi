import React, { useState } from 'react';
import { useRiskStore, type InsurancePolicy } from '../../shared/hooks/useRiskStore';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { toPaise } from '../../shared/lib/currency';

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const POLICY_ICONS: Record<InsurancePolicy['type'], string> = {
  'Term Life': 'favorite',
  'Health (Personal)': 'local_hospital',
  'Health (Corporate)': 'local_hospital',
  'Vehicle': 'directions_car',
  'Property': 'home',
};

const POLICY_ICON_COLORS: Record<InsurancePolicy['type'], string> = {
  'Term Life': 'var(--error)',
  'Health (Personal)': 'var(--positive)',
  'Health (Corporate)': 'var(--accent)',
  'Vehicle': 'var(--warning)',
  'Property': 'var(--primary-container)',
};

function RenewalBadge({ renewalDate }: { renewalDate: string }) {
  const daysUntil = Math.floor((new Date(renewalDate).getTime() - Date.now()) / 86400000);

  let color = 'var(--on-surface-variant)';
  let label = `${daysUntil}d`;

  if (daysUntil < 0) {
    color = 'var(--error)';
    label = `OVERDUE ${Math.abs(daysUntil)}d`;
  } else if (daysUntil < 30) {
    color = 'var(--warning)';
    label = `${daysUntil}d`;
  }

  return (
    <span
      className="text-label-mono-sm"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '4px',
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
        fontSize: '10px',
        letterSpacing: '0.5px',
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: '12px', fontVariationSettings: "'wght' 200" }}
      >
        schedule
      </span>
      {label}
    </span>
  );
}

export function InsurancePortfolio() {
  const { policies, addPolicy, deletePolicy } = useRiskStore();

  const [showModal, setShowModal] = useState(false);
  const [provider, setProvider] = useState('');
  const [type, setType] = useState<InsurancePolicy['type']>('Term Life');
  const [coverage, setCoverage] = useState('');
  const [premium, setPremium] = useState('');
  const [renewal, setRenewal] = useState('');

  const resetForm = () => {
    setProvider('');
    setType('Term Life');
    setCoverage('');
    setPremium('');
    setRenewal('');
  };

  const handleAdd = () => {
    if (!provider || !coverage || !premium || !renewal) return;
    addPolicy({
      id: generateId(),
      provider,
      type,
      coverageAmountPaise: toPaise(Number(coverage)),
      annualPremiumPaise: toPaise(Number(premium)),
      renewalDate: renewal,
    });
    resetForm();
    setShowModal(false);
  };

  const closeModal = () => {
    resetForm();
    setShowModal(false);
  };

  const totalPremium = policies.reduce((acc, p) => acc + p.annualPremiumPaise, 0);
  const totalLifeCover = policies
    .filter((p) => p.type === 'Term Life')
    .reduce((acc, p) => acc + p.coverageAmountPaise, 0);

  return (
    <div className="insurance-portfolio animate-in" style={{ padding: '24px' }}>
      {/* ── Header ── */}
      <header className="ledger-header" style={{ marginBottom: '24px' }}>
        <div className="header-meta">
          <h1 className="text-headline-md tracking-tighter">INSURANCE_PORTFOLIO</h1>
          <div className="status-line">
            <span className="pulse-dot" style={{ background: 'var(--accent)' }} />
            <span className="text-label-mono color-muted">RISK_&_COVERAGE_TRACKING</span>
          </div>
        </div>
      </header>

      {/* ── Summary Stats ── */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        {/* Total Annual Premiums */}
        <div
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '14px 16px',
          }}
        >
          <div className="text-label-mono-sm color-muted" style={{ marginBottom: '6px' }}>
            TOTAL_ANNUAL_PREMIUMS
          </div>
          <div className="text-data-display" style={{ color: 'var(--warning)' }}>
            <CurrencyValue paise={totalPremium} />
          </div>
        </div>

        {/* Total Life Cover */}
        <div
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '14px 16px',
          }}
        >
          <div className="text-label-mono-sm color-muted" style={{ marginBottom: '6px' }}>
            TOTAL_LIFE_COVER
          </div>
          <div className="text-data-display" style={{ color: 'var(--positive)' }}>
            <CurrencyValue paise={totalLifeCover} />
          </div>
        </div>

        {/* Total Policies */}
        <div
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '14px 16px',
          }}
        >
          <div className="text-label-mono-sm color-muted" style={{ marginBottom: '6px' }}>
            TOTAL_POLICIES
          </div>
          <div className="text-data-display" style={{ color: 'var(--on-surface)' }}>
            {policies.length}
          </div>
        </div>
      </div>

      {/* ── Add Policy Button ── */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: 'var(--primary-container)',
            color: '#000',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            fontFamily: 'var(--font-headline)',
            fontSize: '11px',
            letterSpacing: '1px',
            cursor: 'pointer',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '16px', fontVariationSettings: "'wght' 200" }}
          >
            add_circle
          </span>
          ADD_POLICY
        </button>
      </div>

      {/* ── Policy List ── */}
      {policies.length === 0 ? (
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '48px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: '40px',
              fontVariationSettings: "'wght' 200",
              color: 'var(--outline-variant)',
            }}
          >
            shield
          </span>
          <span className="text-label-mono color-muted">
            No policies tracked. Add your first insurance policy.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {policies.map((policy) => {
            const icon = POLICY_ICONS[policy.type];
            const iconColor = POLICY_ICON_COLORS[policy.type];

            return (
              <div
                key={policy.id}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto auto auto',
                  alignItems: 'center',
                  gap: '20px',
                  transition: 'all 0.2s ease',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: `color-mix(in srgb, ${iconColor} 12%, transparent)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: '20px',
                      fontVariationSettings: "'wght' 200",
                      color: iconColor,
                    }}
                  >
                    {icon}
                  </span>
                </div>

                {/* Provider & Type */}
                <div style={{ minWidth: 0 }}>
                  <div className="text-data-display" style={{ marginBottom: '4px' }}>
                    {policy.provider}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span className="text-label-mono-sm color-muted">{policy.type}</span>
                    <RenewalBadge renewalDate={policy.renewalDate} />
                  </div>
                </div>

                {/* Coverage */}
                <div style={{ textAlign: 'right' }}>
                  <div className="text-label-mono-sm color-muted" style={{ marginBottom: '4px' }}>
                    COVERAGE
                  </div>
                  <div className="text-data-display" style={{ color: 'var(--positive)' }}>
                    <CurrencyValue paise={policy.coverageAmountPaise} />
                  </div>
                </div>

                {/* Premium */}
                <div style={{ textAlign: 'right' }}>
                  <div className="text-label-mono-sm color-muted" style={{ marginBottom: '4px' }}>
                    ANNUAL_PREMIUM
                  </div>
                  <div className="text-data-display" style={{ color: 'var(--warning)' }}>
                    <CurrencyValue paise={policy.annualPremiumPaise} />
                  </div>
                </div>

                {/* Delete */}
                <button
                  className="tool-icon-btn"
                  style={{
                    color: 'var(--error)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => deletePolicy(policy.id)}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '18px', fontVariationSettings: "'wght' 200" }}
                  >
                    delete
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Policy Modal ── */}
      {showModal && (
        <div className="salary-modal-overlay" onClick={closeModal}>
          <div
            className="glass-surface-elevated salary-modal"
            style={{ width: '500px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="glass-card-header">
              <span className="text-label-mono">ADD_INSURANCE_POLICY</span>
            </div>

            <div
              className="salary-modal-body"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}
            >
              {/* Provider */}
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">PROVIDER</label>
                <input
                  className="salary-input"
                  type="text"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="e.g. LIC, HDFC Ergo"
                />
              </div>

              {/* Type */}
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">TYPE</label>
                <select
                  className="salary-input"
                  value={type}
                  onChange={(e) => setType(e.target.value as InsurancePolicy['type'])}
                >
                  <option value="Term Life">Term Life</option>
                  <option value="Health (Personal)">Health (Personal)</option>
                  <option value="Health (Corporate)">Health (Corporate)</option>
                  <option value="Vehicle">Vehicle</option>
                  <option value="Property">Property</option>
                </select>
              </div>

              {/* Coverage */}
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">COVERAGE_AMOUNT (₹)</label>
                <input
                  className="salary-input"
                  type="number"
                  value={coverage}
                  onChange={(e) => setCoverage(e.target.value)}
                  placeholder="e.g. 10000000"
                />
              </div>

              {/* Premium */}
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">ANNUAL_PREMIUM (₹)</label>
                <input
                  className="salary-input"
                  type="number"
                  value={premium}
                  onChange={(e) => setPremium(e.target.value)}
                  placeholder="e.g. 15000"
                />
              </div>

              {/* Renewal Date – full width */}
              <div className="salary-field" style={{ gridColumn: '1 / -1' }}>
                <label className="text-label-mono-sm color-muted">RENEWAL_DATE</label>
                <input
                  className="salary-input"
                  type="date"
                  value={renewal}
                  onChange={(e) => setRenewal(e.target.value)}
                />
              </div>
            </div>

            <div className="salary-modal-actions">
              <button className="salary-btn-primary" onClick={handleAdd}>
                SAVE_POLICY
              </button>
              <button className="salary-btn-secondary" onClick={closeModal}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
