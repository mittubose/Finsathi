import React, { useState, useMemo } from 'react';

interface FaqItem {
  id: string;
  category: 'recurring' | 'accounts' | 'strategy8020' | 'tax' | 'hosting' | 'ai';
  question: string;
  answer: string;
  tips?: string[];
}

const FAQ_DATA: FaqItem[] = [
  {
    id: 'rec_ledger_missing',
    category: 'recurring',
    question: 'Why are my recurring expenses not showing up in my transaction ledger?',
    answer: 'In FinSathi, recurring rules act as scheduled financial commitments (like blueprints). They do not clutter your transaction ledger until their scheduled due date arrives. Once due, you can click "Post All to Ledger" on the top banner or trigger them manually from the Recurring screen. This guarantees your ledger only contains verified actual outflows.',
    tips: [
      'Check the top banner on your Dashboard to see all commitments due today.',
      'Use the "Due Recurring" processor to post all due expenses with a single click.',
      'If you recently created recurring rules on another profile, run the "Deep Recovery Scan" in Account Vault.'
    ]
  },
  {
    id: 'rec_auto_due',
    category: 'recurring',
    question: 'How do I automate recurring expenses so I never miss a bill?',
    answer: 'Navigate to Recurring or Bill Reminders and set up your cadence (monthly, quarterly, yearly) along with the due date and lead alert days (e.g. 3 days before). FinSathi will calculate your 14-day upcoming bill pressure and safe-to-spend allowance automatically.',
    tips: [
      'Link your recurring salary income directly to the Salary Slip module for automated take-home adjustments.'
    ]
  },
  {
    id: 'acc_isolation',
    category: 'accounts',
    question: 'How does multi-account / profile data separation work on my laptop?',
    answer: 'FinSathi uses hardware-isolated state handoffs. Each profile (Master Admin, Individual, Family, Business) has its own cryptographic snapshot stored in isolated IndexedDB tables (finsathi_db_profile_{id}) and namespaced storage keys. When you switch profiles, FinSathi safely captures the current in-memory state and hydrates the target profile with zero data bleeding.',
    tips: [
      'Master Admin can administer system configuration, while Individual profiles track personal portfolios.',
      'Profiles have separate ledgers, trade books, recurring rules, and tax schedules.'
    ]
  },
  {
    id: 'acc_recovery',
    category: 'accounts',
    question: 'How do I recover lost or missing data for an individual account?',
    answer: 'Open Settings or click the Account Vault button on your Dashboard. You have two instant recovery options: (1) "Deep Orphaned Data Recovery Scan", which inspects all browser caches and restores any unlinked recurring rules or transactions; (2) "Rolling Snapshot Vault", which preserves the last 5 full state checkpoints allowing 1-click rollback.',
    tips: [
      'Always export a periodic encrypted JSON backup before major operating system updates.',
      'Snapshots are taken automatically before profile switching and can also be created manually.'
    ]
  },
  {
    id: 'strategy_8020',
    category: 'strategy8020',
    question: 'What is the 80/20 Rule for personal finance?',
    answer: 'The Pareto principle in personal finance states that 80% of your long-term financial security comes from getting 20% of the foundational decisions right, rather than obsessing over tracking small daily coffees. These core pillars are: (1) 6-month liquid emergency fund, (2) Pure Term Insurance covering 10x-20x income, (3) Personal Health Cover separate from employer, (4) Automated broad-market index SIPs, and (5) Tax optimization.',
    tips: [
      'Never mix investment with insurance: avoid ULIPs and traditional endowment policies.',
      'Complete the interactive 8-point Health Checklist in your Account Vault to measure your readiness.'
    ]
  },
  {
    id: 'tax_regimes',
    category: 'tax',
    question: 'Should I choose the New Tax Regime (Section 115BAC) or Old Regime in FY 2024-25 / 2025-26?',
    answer: 'Under the default New Regime (Section 115BAC), taxable income up to ₹3,00,000 has 0% tax, and with the rebate under Section 87A, individuals earning up to ₹7,00,000 pay zero tax (with ₹75,000 standard deduction for salaried individuals in FY25-26). The Old Regime is only beneficial if your total deductions (80C ₹1.5L + 80D health ₹25k-₹50k + HRA + Home Loan interest Section 24b ₹2L) exceed ₹3.75L-₹4.25L depending on income bracket.',
    tips: [
      'Use the Tax Optimizer widget to simulate both regimes with your exact salary components.',
      'If you have F&O or business income, Form 10-IEA must be filed before the due date to opt into Old Regime.'
    ]
  },
  {
    id: 'tax_itr3_fno',
    category: 'tax',
    question: 'How are Equity, Mutual Funds, and F&O Trading reported in ITR-3?',
    answer: 'Equity delivery trades held for less than 12 months are Short-Term Capital Gains (STCG, taxed at 20% under Section 111A post-Finance Act 2024). Equity held >12 months is LTCG (12.5% beyond ₹1.25 Lakh exemption under Section 112A). Futures & Options (F&O) trading is legally classified as Non-Speculative Business Income and must be declared under Schedule BP in ITR-3 with turnover computed per the ICAI guidance note.',
    tips: [
      'FinSathi automatically segregates delivery trades into Schedule CG and derivative trades into Schedule BP.'
    ]
  },
  {
    id: 'hosting_security',
    category: 'hosting',
    question: 'How do I host FinSathi on my private laptop and access it securely from mobile?',
    answer: 'Run the unified server on your laptop: `node server/mcp-server.mjs`. It binds to your local Wi-Fi IP on port 3001. Open Settings -> Server Wizard to scan the pairing QR code with your mobile camera. The QR code embeds your private authentication token (`x-finsathi-token`), pairing your phone instantly over your home network without sending a single byte to any external cloud.',
    tips: [
      'The server features a built-in Anti-Ping Flood Shield that temporarily bans aggressive port scanners (>120 req/min).',
      'The Vite production build in dist/ is served directly from the same single port 3001.'
    ]
  },
  {
    id: 'ai_offline',
    category: 'ai',
    question: 'Can the FinSathi AI Copilot work 100% offline without sending data to the cloud?',
    answer: 'Yes! FinSathi contains a dual-layer local intelligence engine: (1) A native instant intent parser running in browser memory (0ms latency) that can update your salary structure, query tax history, set bill reminders, and verify spreadsheets. (2) Seamless integration with local Ollama (`http://127.0.0.1:11434`) for natural reasoning with zero internet connection.',
    tips: [
      'Try typing: "update salary to 20LPA", "how much tax I paid last year", "set reminder for HDFC 25000 due 25th", or "plan my day".',
      'Attach any CSV or Excel bank statement via the 📎 button to verify credits, debits, and duplicate charges.'
    ]
  }
];

export function PersonalFinanceFAQ() {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<'all' | FaqItem['category']>('all');
  const [expandedId, setExpandedId] = useState<string | null>('rec_ledger_missing');

  const categories = [
    { id: 'all', label: 'All Topics', icon: 'apps' },
    { id: 'recurring', label: 'Recurring & Bills', icon: 'schedule' },
    { id: 'accounts', label: 'Accounts & Recovery', icon: 'security' },
    { id: 'strategy8020', label: '80/20 Strategy', icon: 'psychology' },
    { id: 'tax', label: 'Indian Tax & ITR-3', icon: 'account_balance' },
    { id: 'hosting', label: 'Laptop Hosting', icon: 'dns' },
    { id: 'ai', label: 'Local AI Copilot', icon: 'smart_toy' },
  ];

  const filtered = useMemo(() => {
    return FAQ_DATA.filter((item) => {
      const matchesCat = selectedCat === 'all' || item.category === selectedCat;
      const q = search.toLowerCase();
      const matchesSearch = !q || 
        item.question.toLowerCase().includes(q) || 
        item.answer.toLowerCase().includes(q) ||
        (item.tips && item.tips.some(t => t.toLowerCase().includes(q)));
      return matchesCat && matchesSearch;
    });
  }, [search, selectedCat]);

  return (
    <div style={{
      background: 'var(--surface-color, #12141a)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '16px',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary, #00e676)' }}>
              help_center
            </span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Personal Finance & Architecture FAQ
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Guidance on account isolation, recurring cashflows, data recovery, and tax strategy.
          </p>
        </div>

        {/* Search Input */}
        <div style={{
          position: 'relative',
          minWidth: '260px'
        }}>
          <span className="material-symbols-outlined" style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '18px',
            color: 'var(--text-secondary)'
          }}>
            search
          </span>
          <input
            type="text"
            placeholder="Search questions or tax terms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '13px'
            }}
          />
        </div>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id as any)}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: 'none',
              background: selectedCat === cat.id ? 'var(--brand-primary, #00e676)' : 'rgba(255, 255, 255, 0.05)',
              color: selectedCat === cat.id ? '#000' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* FAQ Accordion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            No matching questions found for "{search}".
          </div>
        ) : (
          filtered.map(item => {
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: isExpanded ? '1px solid rgba(0, 230, 118, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  transition: 'border 0.2s ease'
                }}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <span>{item.question}</span>
                  <span className="material-symbols-outlined" style={{
                    fontSize: '20px',
                    color: isExpanded ? 'var(--brand-primary, #00e676)' : 'var(--text-secondary)',
                    transform: isExpanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease'
                  }}>
                    expand_more
                  </span>
                </button>

                {isExpanded && (
                  <div style={{
                    padding: '0 18px 16px 18px',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    color: 'var(--text-secondary)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                    paddingTop: '12px'
                  }}>
                    <div>{item.answer}</div>
                    {item.tips && item.tips.length > 0 && (
                      <div style={{
                        marginTop: '12px',
                        padding: '10px 14px',
                        background: 'rgba(0, 230, 118, 0.06)',
                        borderLeft: '3px solid var(--brand-primary, #00e676)',
                        borderRadius: '0 6px 6px 0'
                      }}>
                        <div style={{ fontWeight: 600, color: 'var(--brand-primary, #00e676)', marginBottom: '4px', fontSize: '12px' }}>
                          Key Actionable Tips:
                        </div>
                        {item.tips.map((tip, i) => (
                          <div key={i} style={{ fontSize: '12px', color: 'var(--text-primary)', marginTop: '2px' }}>
                            • {tip}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
