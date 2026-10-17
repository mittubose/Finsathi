import { useState } from 'react';
import { useProfileStore } from '../hooks/useProfileStore';
import { useWidgetStore, type WorkflowPreset } from '../widgets/useWidgetStore';
import { type WidgetType, WIDGET_REGISTRY } from '../widgets/widgetTypes';
import { FinSathiLogo } from './FinSathiLogo';

interface ZeroStageOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ZeroStageOnboarding({ isOpen, onClose }: ZeroStageOnboardingProps) {
  const { getActiveProfile, completeOnboarding } = useProfileStore();
  const { applyPreset, configureCustomWidgets } = useWidgetStore();
  
  const activeProfile = getActiveProfile();
  const [selectedPersona, setSelectedPersona] = useState<WorkflowPreset | 'custom'>('salaried');
  
  // Custom checklist state
  const [customSelection, setCustomSelection] = useState<Record<WidgetType, boolean>>({
    salary: true,
    tax: true,
    ledger: true,
    reminders: true,
    planning: false,
    'ai-chat': true,
    trades: false,
  });

  if (!isOpen) return null;

  const handleToggleCustom = (type: WidgetType) => {
    setCustomSelection((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const handleComplete = () => {
    if (selectedPersona === 'custom') {
      const enabledTypes = (Object.keys(customSelection) as WidgetType[]).filter(
        (t) => customSelection[t]
      );
      configureCustomWidgets(enabledTypes);
      completeOnboarding(activeProfile.id, 'custom');
    } else {
      applyPreset(selectedPersona);
      completeOnboarding(activeProfile.id, selectedPersona);
    }
    onClose();
  };

  const personas = [
    {
      id: 'salaried' as const,
      icon: 'badge',
      title: 'Salaried Professional',
      badge: 'RECOMMENDED',
      description: 'Monthly salary slip, take-home calculator, FY25-26 tax optimizer, and daily expenses.',
      widgetsIncluded: ['Salary', 'Tax Optimizer', 'Ledger', 'Reminders', 'Local AI'],
      omitted: 'Trading & Capital Gains kept hidden until needed',
    },
    {
      id: 'active_trader' as const,
      icon: 'candlestick_chart',
      title: 'Active Investor & Trader',
      badge: 'MARKETS',
      description: 'Stock & F&O trades, realized P&L, STCG/LTCG capital gains sync, and tax filing.',
      widgetsIncluded: ['Trades Tracker', 'Tax & Capital Gains', 'Ledger', 'Local AI'],
      omitted: 'Salary slip kept hidden',
    },
    {
      id: 'minimalist' as const,
      icon: 'bolt',
      title: 'Minimalist Cashflow',
      badge: 'FASTEST',
      description: 'Ultra-lean workspace focused strictly on daily income, expense tracking, and bill alerts.',
      widgetsIncluded: ['Ledger', 'Bill Reminders', 'Local AI'],
      omitted: 'Salary & Trades hidden',
    },
    {
      id: 'custom' as const,
      icon: 'tune',
      title: 'Custom Modular Setup',
      badge: 'FLEXIBLE',
      description: 'Handpick the exact modules you want active on your dashboard right now.',
      widgetsIncluded: ['Pick below'],
      omitted: 'Full control',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#0a0a0a',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '4px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(0, 255, 65, 0.1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Terminal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FinSathiLogo size={20} glow />
              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--primary-container, #00ff41)', letterSpacing: '0.1em' }}>
                ZERO-STAGE SETUP // PROFILE: {activeProfile.name.toUpperCase()}
              </span>
            </div>
            <h2 style={{ margin: '6px 0 2px 0', fontSize: '18px', fontFamily: 'Space Grotesk, sans-serif', color: '#fff', fontWeight: 700 }}>
              What do you want to track in FinSathi?
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
              Gradual disclosure: only enable what you need now. You can turn on any module later via Settings or AI Chat.
            </p>
          </div>
        </div>

        {/* Persona Options Stack */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {personas.map((p) => {
            const isSelected = selectedPersona === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPersona(p.id)}
                style={{
                  padding: '14px 16px',
                  background: isSelected ? 'rgba(0, 255, 65, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                  border: isSelected ? '1px solid var(--primary-container, #00ff41)' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: isSelected ? 'var(--primary-container)' : 'rgba(255,255,255,0.6)' }}>
                      {p.icon}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>
                      {p.title}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '9px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '2px',
                      background: isSelected ? 'var(--primary-container)' : 'rgba(255,255,255,0.06)',
                      color: isSelected ? '#000' : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {p.badge}
                  </span>
                </div>

                <p style={{ margin: '4px 0 8px 30px', fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                  {p.description}
                </p>

                <div style={{ marginLeft: '30px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>
                    ACTIVE WIDGETS:
                  </span>
                  {p.widgetsIncluded.map((w, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        color: isSelected ? '#00ff41' : 'rgba(255,255,255,0.8)',
                        background: 'rgba(255,255,255,0.04)',
                        padding: '1px 6px',
                        borderRadius: '2px',
                      }}
                    >
                      {w}
                    </span>
                  ))}
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#ffb3ba', marginLeft: 'auto' }}>
                    ({p.omitted})
                  </span>
                </div>
              </div>
            );
          })}

          {/* If Custom Setup selected, show checklist */}
          {selectedPersona === 'custom' && (
            <div
              style={{
                marginTop: '4px',
                padding: '14px 16px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px dashed rgba(255, 255, 255, 0.15)',
                borderRadius: '3px',
              }}
            >
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--primary-container)', marginBottom: '10px' }}>
                SELECT MODULES TO ENABLE INITIALLY:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                {(Object.keys(WIDGET_REGISTRY) as WidgetType[]).map((type) => {
                  const reg = WIDGET_REGISTRY[type];
                  const isChecked = customSelection[type];
                  return (
                    <label
                      key={type}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: isChecked ? '#fff' : 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                        background: isChecked ? 'rgba(255,255,255,0.04)' : 'transparent',
                        padding: '6px 8px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '2px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCustom(type)}
                        style={{ accentColor: 'var(--primary-container)' }}
                      />
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{reg.icon}</span>
                      <span>{reg.defaultTitle}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
            💬 Tip: Tell AI Chat <span style={{ color: '#00ff41' }}>"enable trades widget"</span> at any time to add it.
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleComplete}
              style={{
                background: 'var(--primary-container, #00ff41)',
                color: '#000',
                border: 'none',
                padding: '8px 18px',
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                borderRadius: '2px',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>LAUNCH WORKSPACE</span>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
