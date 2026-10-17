import React, { useState, useEffect } from 'react';

interface ShortcutDef {
  keyCombo: string[];
  label: string;
  category: 'NAVIGATION' | 'SEARCH_AI' | 'SECURITY';
  description: string;
}

const SHORTCUTS: ShortcutDef[] = [
  // Search & AI
  { keyCombo: ['⌘', 'K'], label: 'Search & Ask AI', category: 'SEARCH_AI', description: 'Open universal command palette and local AI query bar' },
  { keyCombo: ['/'], label: 'Quick Search', category: 'SEARCH_AI', description: 'Instant search bar focus (when not typing in an input)' },
  { keyCombo: ['⌘', 'J'], label: 'Financial AI', category: 'SEARCH_AI', description: 'Jump straight to full-screen Local Financial AI Assistant' },
  { keyCombo: ['8'], label: 'AI Assistant', category: 'SEARCH_AI', description: 'Single-key navigation to Financial AI Assistant' },

  // Navigation
  { keyCombo: ['1'], label: 'Dashboard', category: 'NAVIGATION', description: 'Go to main overview dashboard' },
  { keyCombo: ['2'], label: 'Ledger', category: 'NAVIGATION', description: 'Go to transaction ledger & income/expense log' },
  { keyCombo: ['3'], label: 'Tax Engine', category: 'NAVIGATION', description: 'Go to FY tax engine & regime comparison' },
  { keyCombo: ['4'], label: 'Trades', category: 'NAVIGATION', description: 'Go to capital gains & trading journal' },
  { keyCombo: ['5'], label: 'Reminders', category: 'NAVIGATION', description: 'Go to credit cards & recurring bill reminders' },
  { keyCombo: ['6'], label: 'Imports', category: 'NAVIGATION', description: 'Go to bank statement & spreadsheet importer' },
  { keyCombo: ['7'], label: 'Reports', category: 'NAVIGATION', description: 'Go to wealth projection & FY reports' },

  // Security & System
  { keyCombo: ['⌘', 'H'], label: 'Toggle Privacy', category: 'SECURITY', description: 'Instantly blur or unblur sensitive money values' },
  { keyCombo: ['⌘', 'L'], label: 'Lock Vault', category: 'SECURITY', description: 'Securely lock the app behind cryptographic vault' },
  { keyCombo: ['⌘', ','], label: 'Settings', category: 'SECURITY', description: 'Open settings, profile management & sync' },
  { keyCombo: ['?'], label: 'Shortcuts Help', category: 'SECURITY', description: 'Jump directly to this keyboard shortcuts reference' },
  { keyCombo: ['Esc'], label: 'Close / Cancel', category: 'SECURITY', description: 'Close active modals, wizards, or search drawer' },
];

export function KeyboardShortcutsCheatSheet() {
  const [lastKeyPressed, setLastKeyPressed] = useState<string>('Press any key to test');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push('⌘');
      if (e.altKey) parts.push('⌥');
      if (e.shiftKey) parts.push('⇧');
      if (e.key && !['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
        parts.push(e.key.toUpperCase());
      }
      if (parts.length > 0) {
        setLastKeyPressed(parts.join(' + '));
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const categories = [
    { id: 'SEARCH_AI', label: 'SEARCH & FINANCIAL AI', icon: 'smart_toy' },
    { id: 'NAVIGATION', label: 'ONE-KEY NAVIGATION', icon: 'navigation' },
    { id: 'SECURITY', label: 'SECURITY & SYSTEM', icon: 'shield' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Live Keypress Tester */}
      <div 
        style={{
          padding: '16px 20px',
          background: 'rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(0, 255, 65, 0.25)',
          borderRadius: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--primary-container, #00ff41)', fontSize: '22px' }}>
            keyboard
          </span>
          <div>
            <div className="text-body-bold" style={{ fontSize: '13px' }}>INTERACTIVE SHORTCUT TESTER</div>
            <div className="text-label-mono-xs color-muted">Press any key combination on your keyboard to test recognition</div>
          </div>
        </div>

        <div 
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '14px',
            fontWeight: 700,
            padding: '6px 14px',
            background: 'rgba(0, 255, 65, 0.1)',
            border: '1px solid var(--primary-container, #00ff41)',
            borderRadius: '4px',
            color: 'var(--primary-container, #00ff41)',
            letterSpacing: '0.05em'
          }}
        >
          {lastKeyPressed}
        </div>
      </div>

      {/* Shortcuts Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {categories.map((cat) => {
          const items = SHORTCUTS.filter((s) => s.category === cat.id);
          return (
            <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary-container, #00ff41)' }}>
                  {cat.icon}
                </span>
                <span className="text-label-mono-sm color-muted" style={{ fontWeight: 600 }}>{cat.label}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '10px' }}>
                {items.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      borderRadius: '4px',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="text-body" style={{ fontWeight: 600, fontSize: '13px' }}>{item.label}</span>
                      <span className="text-label-mono-xs color-muted">{item.description}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      {item.keyCombo.map((k, idx) => (
                        <kbd
                          key={idx}
                          style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '3px',
                            padding: '3px 8px',
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#fff',
                            boxShadow: '0 2px 0 rgba(0,0,0,0.4)'
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
