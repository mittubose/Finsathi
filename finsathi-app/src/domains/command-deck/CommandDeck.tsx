import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { useCommandStore } from '../../shared/hooks/useCommandStore';
import { useToast } from '../../shared/ui/Toast';
import { formatINR, toPaise } from '../../shared/lib/currency';
import { TaxEngineService, type TaxComputationInput } from '../tax/domain/TaxEngineService';
import { CapitalLedgerService, type RawTrade } from '../trades/domain/CapitalLedgerService';
import { ObligationRadarService, type ObligationItem } from '../obligations/domain/ObligationRadarService';
import { parseLocalFinancialIntent, verifyFinancialDocument } from '../../shared/lib/localAi';
import { useNavigate } from 'react-router-dom';
import './CommandDeck.css';

export function CommandDeck() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { open: openCommandPalette } = useCommandStore();
  const {
    currentFY,
    incomeItems,
    expenseItems,
    tradeItems,
    reminders,
    updateReminder,
    addExpense,
    addIncome,
  } = useAppStore();

  const [cmdInput, setCmdInput] = useState('');
  const [isVerifyingFile, setIsVerifyingFile] = useState(false);
  const [selectedObIndex, setSelectedObIndex] = useState(0);

  // 1. Compute Tax Telemetry (Quadrant 1)
  const taxSummary = useMemo(() => {
    const totalIncomePaise = incomeItems.reduce((acc, i) => acc + (i.amountPaise || 0), 0);
    const basicPaise = Math.floor(totalIncomePaise * 0.45);
    const hraPaise = Math.floor(totalIncomePaise * 0.25);
    const specialAllowancePaise = Math.floor(totalIncomePaise * 0.30);

    const input: TaxComputationInput = {
      salary: {
        basicPaise,
        hraPaise,
        specialAllowancePaise,
        otherEarningsPaise: 0,
        employerPfPaise: 0,
        professionTaxPaise: 2500_00,
      },
      deductions: {
        section80C_paise: 150000_00,
        section80D_paise: 25000_00,
        section80CCD1B_paise: 50000_00,
        section24b_paise: 0,
        section80TTA_paise: 10000_00,
        otherDeductionsPaise: 0,
      },
      tdsPaidPaise: 0,
    };

    const comparison = TaxEngineService.compareRegimes(input);
    const advanceTax = TaxEngineService.calculateAdvanceTaxAssessment(
      comparison.netTaxPayablePaise,
      [0, 0, 0, 0]
    );

    return { comparison, advanceTax };
  }, [incomeItems]);

  // 2. Compute Capital Gains Telemetry (Quadrant 2)
  const capitalGains = useMemo(() => {
    const rawTrades: RawTrade[] = (tradeItems || []).map((t, idx) => ({
      id: t.id || `trade_${idx}`,
      symbol: t.instrument || 'EQUITY',
      side: 'BUY',
      date: t.buyDate ? new Date(t.buyDate).toISOString().split('T')[0] : '2024-04-01',
      qty: t.qty || 1,
      pricePaise: t.buyPricePaise || 0,
      chargesPaise: t.chargesPaise || 0,
    }));

    return CapitalLedgerService.computeCapitalGainsSummary(rawTrades);
  }, [tradeItems]);

  // 3. Compute 30-Day Obligation Radar & Free Cash (Quadrant 3)
  const { obligationsList, freeCashAnalysis } = useMemo(() => {
    const items: ObligationItem[] = (reminders || []).map((r) => ({
      id: r.id,
      name: r.title,
      category: (r.category as any) || 'utility',
      amountPaise: r.amountPaise || 0,
      dueDate: r.nextDue || r.createdAt,
      isPaid: r.status === 'paid',
    }));

    // Estimate monthly net salary from total annual income
    const totalIncomePaise = incomeItems.reduce((acc, i) => acc + (i.amountPaise || 0), 0);
    const monthlyNetSalary = totalIncomePaise > 0 ? Math.floor(totalIncomePaise / 12) : 150000_00;

    const freeCash = ObligationRadarService.computeFreeCashAfterCommitments(monthlyNetSalary, items);
    return { obligationsList: items, freeCashAnalysis: freeCash };
  }, [reminders, incomeItems]);

  // 4. Monthly Bucket Snapshots (Quadrant 4)
  const bucketSnapshot = useMemo(() => {
    const nowMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const thisMonthExpenses = (expenseItems || []).filter(e => e.date && e.date.startsWith(nowMonth));

    const ccTotal = thisMonthExpenses
      .filter(e => /card|credit|hdfc|icici|amex/i.test(e.merchant || '') || e.category === 'Bills')
      .reduce((s, e) => s + e.amountPaise, 0);

    const upiTotal = thisMonthExpenses
      .filter(e => !/card|credit|hdfc|icici|amex/i.test(e.merchant || ''))
      .reduce((s, e) => s + e.amountPaise, 0);

    const fixedObligations = obligationsList
      .filter(o => o.dueDate.startsWith(nowMonth))
      .reduce((s, o) => s + o.amountPaise, 0);

    return ObligationRadarService.createMonthlySnapshot(nowMonth, ccTotal, upiTotal, fixedObligations, 0);
  }, [expenseItems, obligationsList]);

  // Fast command execution
  const handleExecuteCmd = (e: React.FormEvent) => {
    e.preventDefault();
    const query = cmdInput.trim();
    if (!query) return;

    const parsed = parseLocalFinancialIntent(query);
    if (parsed) {
      if (parsed.intent === 'add_expense' && parsed.data) {
        addExpense({
          id: `exp_${Date.now()}`,
          type: 'expense',
          category: parsed.data.category,
          amountPaise: parsed.data.amountPaise,
          date: parsed.data.date,
          merchant: parsed.data.merchant,
          notes: parsed.data.notes,
          tags: ['command-bar'],
          isRecurring: false,
          createdAt: new Date().toISOString(),
        });
        toast(`Recorded expense: ${formatINR(parsed.data.amountPaise)} (${parsed.data.merchant})`, 'success');
        setCmdInput('');
        return;
      }
      if (parsed.intent === 'add_income' && parsed.data) {
        addIncome({
          id: `inc_${Date.now()}`,
          type: 'income',
          head: parsed.data.head,
          amountPaise: parsed.data.amountPaise,
          source: parsed.data.source,
          fy: currentFY,
          isTaxable: true,
          notes: parsed.data.notes,
          tags: ['command-bar'],
          date: parsed.data.date,
          createdAt: new Date().toISOString(),
        });
        toast(`Recorded income: ${formatINR(parsed.data.amountPaise)} (${parsed.data.source})`, 'success');
        setCmdInput('');
        return;
      }
    }

    // Default route to AI Assistant
    navigate(`/assistant`);
  };

  // Toggle paid status
  const handleTogglePaid = (ob: ObligationItem) => {
    updateReminder(ob.id, {
      status: ob.isPaid ? 'upcoming' : 'paid',
    });
    toast(`Marked "${ob.name}" as ${ob.isPaid ? 'UPCOMING' : 'PAID'}`, 'info');
  };

  // Keyboard Navigation: J/K or ArrowUp/ArrowDown to select, Space or P to toggle paid
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (!obligationsList || obligationsList.length === 0) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedObIndex((prev) => Math.min(obligationsList.length - 1, prev + 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedObIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        const current = obligationsList[selectedObIndex];
        if (current) {
          handleTogglePaid(current);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [obligationsList, selectedObIndex]);

  // File OCR drop handler
  const handleFileDrop = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsVerifyingFile(true);
    try {
      const rep = await verifyFinancialDocument(file);
      toast(`OCR Verified ${rep.totalRecords} records from ${file.name}`, 'success');
      navigate('/assistant');
    } catch (err: any) {
      toast(`Document parse failed: ${err.message}`, 'error');
    } finally {
      setIsVerifyingFile(false);
    }
  };

  const ltcgPct = Math.min(100, Math.round((capitalGains.ltcgExemptionUsedPaise / 125000_00) * 100));

  return (
    <div className="command-deck">
      {/* Header */}
      <div className="deck-header">
        <div className="deck-title-row">
          <span className="deck-pulse-dot" />
          <h1 className="text-headline-md" style={{ margin: 0 }}>FINSATHI_COMMAND_DECK</h1>
          <span className="text-label-mono-sm color-muted">FY {currentFY} · VAULT INSTRUMENTATION</span>
        </div>

        <div className="deck-badges">
          <span className="deck-pill deck-pill--green">100% ON-DEVICE</span>
          <span className="deck-pill">ZERO CLOUD LEAK</span>
          <span className="deck-pill deck-pill--green">DDD ENGINES ACTIVE</span>
        </div>
      </div>

      {/* 4-Quadrant Command Grid */}
      <div className="deck-grid">
        {/* Quadrant 1: FY Tax Telemetry */}
        <div className="deck-card">
          <div className="deck-card-header">
            <div className="deck-card-title">
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary-container)' }}>
                account_balance
              </span>
              <span>QUADRANT_1: FY_TAX_TELEMETRY</span>
              <span className="deck-source-badge" title="Under Section 115BAC + FY 25-26 Standard Deduction ₹75,000 + Sec 87A Marginal Relief">
                [ASSUMPTION: STD_DED_75K | 87A_RELIEF]
              </span>
            </div>
            <span className={`deck-pill ${taxSummary.advanceTax.advanceTaxPayable ? 'deck-pill--amber' : 'deck-pill--green'}`}>
              {taxSummary.advanceTax.advanceTaxPayable ? 'ADV_TAX_DUE' : 'TAX_CLEAR'}
            </span>
          </div>

          <div className="deck-card-body">
            <div className="deck-stat-grid">
              <div className="deck-stat-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-label-mono-xs color-muted">NEW REGIME EST TAX</span>
                  <span className="deck-source-badge" title="Budget 2024 / FY 25-26 Slabs">[SLABS_FY26]</span>
                </div>
                <span className="deck-stat-val color-positive">
                  {formatINR(taxSummary.comparison.newRegime.totalTaxPaise)}
                </span>
                <span className="text-label-mono-xs color-muted">
                  Eff. Rate: {taxSummary.comparison.newRegime.effectiveTaxRatePct}%
                </span>
              </div>

              <div className="deck-stat-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-label-mono-xs color-muted">RECOMMENDED REGIME</span>
                  <span className="deck-source-badge" title="Deterministic comparison: New vs Old">[OPTIMIZER]</span>
                </div>
                <span className="deck-stat-val" style={{ color: 'var(--primary-container)' }}>
                  {taxSummary.comparison.recommendedRegime.toUpperCase()} REGIME
                </span>
                <span className="text-label-mono-xs color-muted">
                  Saves: {formatINR(taxSummary.comparison.savingsPaise)}
                </span>
              </div>
            </div>

            {taxSummary.comparison.deductionBreakevenDeltaPaise > 0 && (
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid var(--primary-container)', borderRadius: '3px' }}>
                <div className="text-label-mono-xs color-muted">DEDUCTION BREAKEVEN DELTA</div>
                <div className="text-body" style={{ fontSize: '12px', marginTop: '2px' }}>
                  Need <strong>{formatINR(taxSummary.comparison.deductionBreakevenDeltaPaise)}</strong> in additional deductions for Old Regime to beat New Regime.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
              <span className="text-label-mono-xs color-muted">Standard Deduction Applied: ₹75,000</span>
              <button 
                className="settings-action-btn"
                onClick={() => navigate('/tax')}
                style={{ fontSize: '11px', padding: '3px 8px' }}
              >
                OPEN TAX ENGINE →
              </button>
            </div>
          </div>
        </div>

        {/* Quadrant 2: Equity & Capital Gains Gauge */}
        <div className="deck-card">
          <div className="deck-card-header">
            <div className="deck-card-title">
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary-container)' }}>
                query_stats
              </span>
              <span>QUADRANT_2: CAPITAL_GAINS_GAUGE</span>
              <span className="deck-source-badge" title="Strict Chronological FIFO lot matching">[SRC: FIFO_TRADEBOOK]</span>
            </div>
            <span className="deck-pill deck-pill--green">
              {formatINR(capitalGains.ltcgExemptionRemainingPaise)} HARVESTABLE
            </span>
          </div>

          <div className="deck-card-body">
            {/* ₹1.25L LTCG Exemption Segmented Progress Bar */}
            <div className="deck-bar-wrap">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'monospace' }}>
                <span className="color-muted">
                  ₹1.25L ANNUAL LTCG EXEMPTION 
                  <span className="deck-source-badge" style={{ marginLeft: '6px' }} title="Budget 2024 Section 112A">[SEC_112A]</span>
                </span>
                <span className="color-positive">{formatINR(capitalGains.ltcgExemptionUsedPaise)} / ₹1,25,000 ({ltcgPct}%)</span>
              </div>
              <div className="deck-segmented-bar">
                <div className="deck-segmented-fill" style={{ width: `${ltcgPct}%` }} />
              </div>
            </div>

            <div className="deck-stat-grid" style={{ marginTop: '6px' }}>
              <div className="deck-stat-box">
                <span className="text-label-mono-xs color-muted">REALIZED STCG (20%)</span>
                <span className="deck-stat-val">
                  {formatINR(capitalGains.netStcgPaise)}
                </span>
                <span className="text-label-mono-xs color-muted">Tax: {formatINR(capitalGains.stcgTaxPaise)}</span>
              </div>

              <div className="deck-stat-box">
                <span className="text-label-mono-xs color-muted">REALIZED LTCG (12.5%)</span>
                <span className="deck-stat-val">
                  {formatINR(capitalGains.netLtcgPaise)}
                </span>
                <span className="text-label-mono-xs color-muted">Tax: {formatINR(capitalGains.ltcgTaxPaise)}</span>
              </div>
            </div>

            <div style={{ padding: '8px 12px', background: 'rgba(0, 255, 65, 0.04)', border: '1px solid rgba(0, 255, 65, 0.2)', borderRadius: '4px' }}>
              <div className="text-label-mono-xs color-positive">⚡ TAX-LOSS HARVESTING RADAR</div>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                You have {formatINR(capitalGains.ltcgExemptionRemainingPaise)} of tax-free LTCG headroom remaining before March 31.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
              <span className="text-label-mono-xs color-muted">FIFO Lot Matcher: ACTIVE</span>
              <button 
                className="settings-action-btn"
                onClick={() => navigate('/trades')}
                style={{ fontSize: '11px', padding: '3px 8px' }}
              >
                OPEN TRADES JOURNAL →
              </button>
            </div>
          </div>
        </div>

        {/* Quadrant 3: 30-Day Obligation Radar */}
        <div className="deck-card">
          <div className="deck-card-header">
            <div className="deck-card-title">
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary-container)' }}>
                notifications_active
              </span>
              <span>QUADRANT_3: 30_DAY_OBLIGATION_RADAR</span>
              <span className="deck-source-badge" title="Navigate with J/K or Up/Down arrows · Press Space or P to mark as paid">
                [J/K NAV · SPACE/P PAID]
              </span>
            </div>
            <span className={`deck-pill ${freeCashAnalysis.isSafeForTradingDeploy ? 'deck-pill--green' : 'deck-pill--amber'}`}>
              {freeCashAnalysis.isSafeForTradingDeploy ? 'TRADING LIQUIDITY: SAFE' : 'LIQUIDITY: TIGHT'}
            </span>
          </div>

          <div className="deck-card-body">
            {/* Free Cash After Commitments Metric */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="text-label-mono-xs color-muted">FREE CASH AFTER COMMITMENTS</span>
                  <span className="deck-source-badge" title="Calculated as: Monthly Net Salary - SIPs - Fixed Bills - CC Statements">[FORMULA: SALARY - DUES]</span>
                </div>
                <div className="deck-stat-val color-positive" style={{ fontSize: '16px', marginTop: '2px' }}>
                  {formatINR(freeCashAnalysis.freeCashAfterCommitmentsPaise)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="text-label-mono-xs color-muted">BURN RATE</div>
                <div className="text-body-bold" style={{ fontSize: '13px' }}>
                  {freeCashAnalysis.burnRatePercentage}% of salary
                </div>
              </div>
            </div>

            {/* Obligation Items Monospace List with Keyboard Indicator */}
            <div className="deck-ob-list">
              {obligationsList.length === 0 ? (
                <div className="text-label-mono-xs color-muted" style={{ padding: '12px 0', textAlign: 'center' }}>
                  No upcoming obligations registered.
                </div>
              ) : (
                obligationsList.slice(0, 5).map((ob, idx) => {
                  const urgency = ObligationRadarService.getUrgencyTier(ob.dueDate, ob.isPaid);
                  const isSelected = idx === selectedObIndex;
                  return (
                    <div 
                      key={ob.id} 
                      className={`deck-ob-row ${ob.isPaid ? 'deck-ob-row--paid' : ''} ${isSelected ? 'deck-ob-row--selected' : ''}`}
                      onClick={() => setSelectedObIndex(idx)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '10px', color: isSelected ? 'var(--primary-container)' : 'transparent', width: '10px' }}>
                          ▶
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePaid(ob);
                          }}
                          style={{
                            background: ob.isPaid ? 'var(--primary-container)' : 'transparent',
                            border: '1px solid rgba(255,255,255,0.3)',
                            width: '14px',
                            height: '14px',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        />
                        <span style={{ color: '#fff', fontWeight: 600 }}>{ob.name}</span>
                        <span className={`deck-ob-tag deck-ob-tag--${urgency.toLowerCase()}`}>{urgency}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="color-muted">{ob.dueDate}</span>
                        <span style={{ fontWeight: 700, color: 'var(--primary-container)' }}>{formatINR(ob.amountPaise)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
              <span className="text-label-mono-xs color-muted">{obligationsList.filter(o => !o.isPaid).length} Pending Bills & SIPs</span>
              <button 
                className="settings-action-btn"
                onClick={() => navigate('/planning')}
                style={{ fontSize: '11px', padding: '3px 8px' }}
              >
                MANAGE BILLS →
              </button>
            </div>
          </div>
        </div>

        {/* Quadrant 4: Monthly Buckets & Persistent Command Bar */}
        <div className="deck-card">
          <div className="deck-card-header">
            <div className="deck-card-title">
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary-container)' }}>
                terminal
              </span>
              <span>QUADRANT_4: BUCKETS_&_COMMAND_BAR</span>
              <span className="deck-source-badge" title="Macro monthly statements aggregation replacing micro logging">
                [SRC: STATEMENT_BUCKETS]
              </span>
            </div>
            <span className="deck-pill deck-pill--green">MACRO SNAPSHOTS</span>
          </div>

          <div className="deck-card-body">
            {/* Monthly Bucket Snapshots */}
            <div>
              <div className="text-label-mono-xs color-muted" style={{ marginBottom: '6px' }}>
                CURRENT MONTH SNAPSHOT ({bucketSnapshot.month})
              </div>
              <div className="deck-bucket-grid">
                <div className="deck-bucket-card">
                  <span className="text-label-mono-xs color-muted">CREDIT CARDS</span>
                  <span className="text-body-bold" style={{ fontSize: '13px' }}>
                    {formatINR(bucketSnapshot.creditCardStatementPaise)}
                  </span>
                </div>
                <div className="deck-bucket-card">
                  <span className="text-label-mono-xs color-muted">UPI OUTFLOWS</span>
                  <span className="text-body-bold" style={{ fontSize: '13px' }}>
                    {formatINR(bucketSnapshot.upiOutflowsPaise)}
                  </span>
                </div>
                <div className="deck-bucket-card">
                  <span className="text-label-mono-xs color-muted">FIXED DUES</span>
                  <span className="text-body-bold" style={{ fontSize: '13px' }}>
                    {formatINR(bucketSnapshot.fixedObligationsPaise)}
                  </span>
                </div>
              </div>
            </div>

            {/* Persistent Command Input Bar */}
            <form onSubmit={handleExecuteCmd} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <div className="text-label-mono-xs color-muted">NATURAL LANGUAGE FINANCIAL INPUT</div>
              <div className="deck-cmd-bar">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary-container)' }}>
                  keyboard
                </span>
                <input
                  className="deck-cmd-input"
                  value={cmdInput}
                  onChange={(e) => setCmdInput(e.target.value)}
                  placeholder="e.g. 'Coffee 150', 'Salary 20LPA', 'Plan my day'..."
                />
                <button type="submit" className="settings-action-btn" style={{ fontSize: '10px', padding: '2px 8px' }}>
                  RUN
                </button>
              </div>
            </form>

            {/* OCR Dropzone */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined icon-sm" style={{ color: 'var(--primary-container)' }}>
                  document_scanner
                </span>
                <span className="text-label-mono-xs color-muted">
                  {isVerifyingFile ? 'PARSING WITH IN-BROWSER OCR...' : 'Drop or attach bank statement / receipt PDF'}
                </span>
              </div>
              <label className="settings-action-btn" style={{ fontSize: '10px', padding: '2px 8px', cursor: 'pointer', margin: 0 }}>
                UPLOAD
                <input type="file" onChange={handleFileDrop} style={{ display: 'none' }} accept=".pdf,.png,.jpg,.jpeg" />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
              <span className="text-label-mono-xs color-muted">Press ⌘K or / anytime for search</span>
              <button 
                className="settings-action-btn"
                onClick={() => navigate('/assistant')}
                style={{ fontSize: '11px', padding: '3px 8px' }}
              >
                OPEN AI ASSISTANT →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
