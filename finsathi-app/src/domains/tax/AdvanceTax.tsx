import { useState, useMemo } from 'react';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { formatINR, toPaise, formatINRCompact } from '../../shared/lib/currency';
import { computePortfolioGains } from '../tax/engine';
import { computeAdvanceTax } from '../tax/advTaxEngine';
import type { TaxInput, TradeEntry } from '../tax/engine';
import './AdvanceTax.css';

export function AdvanceTax() {
  const { incomeItems, tradeItems, currentFY } = useAppStore();

  // Simplified: estimate salary from income items
  const totalIncome = useMemo(() => incomeItems.reduce((s, i) => s + i.amountPaise, 0), [incomeItems]);

  // TDS paid
  const [tdsPaid, setTdsPaid] = useState(0);
  const [q1Paid, setQ1Paid] = useState(0);
  const [q2Paid, setQ2Paid] = useState(0);
  const [q3Paid, setQ3Paid] = useState(0);
  const [q4Paid, setQ4Paid] = useState(0);

  // Trade tax
  const tradeTax = useMemo(() => {
    if (tradeItems.length === 0) return 0;
    const trades: TradeEntry[] = tradeItems.map((t) => ({
      instrument: t.instrument, buyDate: new Date(t.buyDate), sellDate: new Date(t.sellDate),
      qty: t.qty, buyPricePaise: t.buyPricePaise, sellPricePaise: t.sellPricePaise, chargesPaise: t.chargesPaise,
    }));
    const gains = computePortfolioGains(trades);
    return gains.netTaxPaise;
  }, [tradeItems]);

  // Build tax input from total income
  const taxInput: TaxInput = useMemo(() => ({
    salary: {
      basicPaise: Math.floor(totalIncome * 0.4), hraPaise: Math.floor(totalIncome * 0.2),
      specialAllowancePaise: Math.floor(totalIncome * 0.3), conveyancePaise: 0, ltaPaise: 0,
      bonusPaise: 0, otherTaxablePaise: Math.floor(totalIncome * 0.1),
      employerPfPaise: 0, professionTaxPaise: 0,
    },
    deductions: {
      section80C_paise: 0, section80D_paise: 0, section80E_paise: 0,
      section80TTA_paise: 0, homeLoanInterestPaise: 0, nps80CCD_paise: 0, otherDeductionsPaise: 0,
    },
    tdsDeductedPaise: 0, fy: currentFY,
  }), [totalIncome, currentFY]);

  const result = useMemo(() => {
    return computeAdvanceTax(
      taxInput, tradeTax, toPaise(tdsPaid),
      [toPaise(q1Paid), toPaise(q2Paid), toPaise(q3Paid), toPaise(q4Paid)],
      currentFY
    );
  }, [taxInput, tradeTax, tdsPaid, q1Paid, q2Paid, q3Paid, q4Paid, currentFY]);

  return (
    <div className="adv-tax">
      <div className="adv-tax-header">
        <h1 className="text-headline-md">ADVANCE_TAX</h1>
        <span className="text-label-mono color-muted">FY {currentFY} · QUARTERLY SCHEDULE</span>
      </div>

      {/* Summary */}
      <div className="adv-tax-summary">
        <div className="adv-tax-stat glass-surface">
          <div className="glass-card-header"><span className="text-label-mono-sm color-muted">EST_ANNUAL_TAX</span></div>
          <div className="adv-tax-stat-body">
            <span className="text-headline-md">{formatINRCompact(result.totalEstimatedTaxPaise)}</span>
            <span className="text-label-mono-sm color-muted">{result.regime.toUpperCase()} REGIME</span>
          </div>
        </div>
        <div className="adv-tax-stat glass-surface">
          <div className="glass-card-header"><span className="text-label-mono-sm color-muted">NET_ADVANCE_TAX</span></div>
          <div className="adv-tax-stat-body">
            <span className={`text-headline-md ${result.netAdvanceTaxPaise > 0 ? 'color-negative' : 'color-positive'}`}>
              {formatINRCompact(result.netAdvanceTaxPaise)}
            </span>
            <span className="text-label-mono-sm color-muted">AFTER TDS</span>
          </div>
        </div>
        <div className="adv-tax-stat glass-surface">
          <div className="glass-card-header"><span className="text-label-mono-sm color-muted">STATUS</span></div>
          <div className="adv-tax-stat-body">
            <span className={`text-headline-md ${result.shouldPayAdvanceTax ? 'color-warning' : 'color-positive'}`}>
              {result.shouldPayAdvanceTax ? 'REQUIRED' : 'NOT_REQ'}
            </span>
            <span className="text-label-mono-sm color-muted">
              {result.shouldPayAdvanceTax ? 'Net tax > ₹10K' : 'Net tax < ₹10K'}
            </span>
          </div>
        </div>
        <div className="adv-tax-stat glass-surface">
          <div className="glass-card-header"><span className="text-label-mono-sm color-muted">PENALTY_EST</span></div>
          <div className="adv-tax-stat-body">
            <span className={`text-headline-md ${result.totalPenaltyPaise > 0 ? 'color-negative' : 'color-muted'}`}>
              {result.totalPenaltyPaise > 0 ? formatINRCompact(result.totalPenaltyPaise) : '₹0'}
            </span>
            <span className="text-label-mono-sm color-muted">
              {result.penalty234CPaise > 0 ? `234C: ${formatINRCompact(result.penalty234CPaise)}` : ''}
              {result.penalty234BPaise > 0 ? ` · 234B: ${formatINRCompact(result.penalty234BPaise)}` : ''}
              {result.totalPenaltyPaise === 0 ? 'NO INTEREST' : ''}
            </span>
          </div>
        </div>
      </div>

      {result.form10IEARequired && (
        <div className="glass-surface" style={{ padding: '12px 16px', marginBottom: '16px', borderLeft: '3px solid var(--warning)', background: 'rgba(234, 179, 8, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--warning)', fontSize: '20px' }}>notification_important</span>
            <span className="text-body" style={{ fontWeight: 600, color: 'var(--warning)' }}>FORM 10-IEA COMPLIANCE REQUIRED</span>
          </div>
          <p className="text-label-mono-sm color-muted" style={{ marginTop: '4px', lineHeight: 1.5 }}>
            Because you have business/trading income (F&O or Intraday) and the Old Regime is recommended, you must e-file Form 10-IEA on the IT portal on or before the due date (July 31) to exercise this regime choice. Otherwise, assessment defaults to Section 115BAC New Regime.
          </p>
        </div>
      )}

      {/* TDS Input */}
      <div className="glass-surface adv-tax-tds-section">
        <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <span className="text-label-mono color-subtle">PAYMENTS</span>
        </div>
        <div className="adv-tax-payments-grid">
          <div className="adv-tax-pay-field">
            <label className="text-label-mono-sm color-muted">TDS_DEDUCTED (₹)</label>
            <input className="adv-tax-input" type="number" value={tdsPaid || ''} onChange={(e) => setTdsPaid(Number(e.target.value) || 0)} placeholder="0" />
          </div>
          <div className="adv-tax-pay-field">
            <label className="text-label-mono-sm color-muted">Q1_PAID (₹)</label>
            <input className="adv-tax-input" type="number" value={q1Paid || ''} onChange={(e) => setQ1Paid(Number(e.target.value) || 0)} placeholder="0" />
          </div>
          <div className="adv-tax-pay-field">
            <label className="text-label-mono-sm color-muted">Q2_PAID (₹)</label>
            <input className="adv-tax-input" type="number" value={q2Paid || ''} onChange={(e) => setQ2Paid(Number(e.target.value) || 0)} placeholder="0" />
          </div>
          <div className="adv-tax-pay-field">
            <label className="text-label-mono-sm color-muted">Q3_PAID (₹)</label>
            <input className="adv-tax-input" type="number" value={q3Paid || ''} onChange={(e) => setQ3Paid(Number(e.target.value) || 0)} placeholder="0" />
          </div>
          <div className="adv-tax-pay-field">
            <label className="text-label-mono-sm color-muted">Q4_PAID (₹)</label>
            <input className="adv-tax-input" type="number" value={q4Paid || ''} onChange={(e) => setQ4Paid(Number(e.target.value) || 0)} placeholder="0" />
          </div>
        </div>
      </div>

      {/* Quarter Timeline */}
      <div className="glass-surface adv-tax-timeline">
        <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <span className="text-label-mono color-subtle">QUARTERLY_SCHEDULE</span>
          {result.nextDue && (
            <span className="text-label-mono-sm color-warning">
              NEXT: {result.nextDue.quarter} · {result.nextDue.dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }).toUpperCase()}
            </span>
          )}
        </div>

        {/* Table Header */}
        <div className="adv-tax-table-header">
          <span>QUARTER</span>
          <span>DUE DATE</span>
          <span>CUM %</span>
          <span>INSTALLMENT</span>
          <span>PAID</span>
          <span>SHORTFALL</span>
          <span>PENALTY</span>
          <span>STATUS</span>
        </div>

        {result.quarters.map((q) => (
          <div key={q.quarter} className={`glass-row adv-tax-row ${q.isOverdue ? 'adv-tax-row--overdue' : ''}`}>
            <div className="adv-tax-cell">
              <span className="text-body" style={{ fontWeight: 600 }}>{q.quarter}</span>
            </div>
            <div className="adv-tax-cell">
              <span className="text-label-mono-sm">
                {q.dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }).toUpperCase()}
              </span>
            </div>
            <div className="adv-tax-cell">
              <span className="text-data-display" style={{ fontSize: '11px' }}>{q.cumulativePct}%</span>
            </div>
            <div className="adv-tax-cell">
              <span className="text-data-display" style={{ fontSize: '11px' }}>{formatINR(q.installmentPaise)}</span>
            </div>
            <div className="adv-tax-cell">
              <span className={`text-data-display ${q.paidPaise > 0 ? 'color-positive' : 'color-muted'}`} style={{ fontSize: '11px' }}>
                {q.paidPaise > 0 ? formatINR(q.paidPaise) : '—'}
              </span>
            </div>
            <div className="adv-tax-cell">
              <span className={`text-data-display ${q.shortfallPaise > 0 ? 'color-negative' : 'color-muted'}`} style={{ fontSize: '11px' }}>
                {q.shortfallPaise > 0 ? formatINR(q.shortfallPaise) : '—'}
              </span>
            </div>
            <div className="adv-tax-cell">
              <span className={`text-data-display ${q.penaltyEstPaise > 0 ? 'color-negative' : 'color-muted'}`} style={{ fontSize: '11px' }}>
                {q.penaltyEstPaise > 0 ? formatINR(q.penaltyEstPaise) : '—'}
              </span>
            </div>
            <div className="adv-tax-cell">
              {q.isPast ? (
                q.isOverdue ? (
                  <span className="adv-tax-badge adv-tax-badge--overdue">OVERDUE</span>
                ) : (
                  <span className="adv-tax-badge adv-tax-badge--done">DONE</span>
                )
              ) : (
                <span className="adv-tax-badge adv-tax-badge--pending">PENDING</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="adv-tax-notes">
        <div className="text-label-mono-sm color-muted">↳ ADVANCE TAX IS PAYABLE IF NET TAX LIABILITY EXCEEDS ₹10,000</div>
        <div className="text-label-mono-sm color-muted">↳ INTEREST U/S 234C: 1% PER MONTH ON SHORTFALL</div>
        <div className="text-label-mono-sm color-muted">↳ INTEREST U/S 234B: 1% PER MONTH IF &lt;90% OF TAX PAID BY MAR 31</div>
        <div className="text-label-mono-sm color-muted">↳ THIS IS AN ESTIMATE. CONSULT A CA FOR ACCURATE COMPUTATION</div>
      </div>
    </div>
  );
}
