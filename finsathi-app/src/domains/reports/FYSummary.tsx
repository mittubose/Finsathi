import { useMemo, useRef } from 'react';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { formatINR, toPaise, toRupees } from '../../shared/lib/currency';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { compareRegimes, computePortfolioGains } from '../tax/engine';
import type { SalaryInput, DeductionInput, TaxInput, TradeEntry } from '../tax/engine';
import './FYSummary.css';

export function FYSummary() {
  const { incomeItems, expenseItems, tradeItems, currentFY } = useAppStore();
  const printRef = useRef<HTMLDivElement>(null);

  const isItemInFY = (dateStr: string, fy: string) => {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-indexed
    const itemFY = m >= 3 ? `${y}-${(y + 1) % 100}` : `${y - 1}-${y % 100}`;
    return itemFY === fy;
  };

  const filteredIncomes = useMemo(() => incomeItems.filter(i => isItemInFY(i.date, currentFY)), [incomeItems, currentFY]);
  const filteredExpenses = useMemo(() => expenseItems.filter(e => isItemInFY(e.date, currentFY)), [expenseItems, currentFY]);
  const filteredTrades = useMemo(() => tradeItems.filter(t => isItemInFY(t.sellDate, currentFY)), [tradeItems, currentFY]);

  const totalIncome = useMemo(() => filteredIncomes.reduce((s, i) => s + i.amountPaise, 0), [filteredIncomes]);
  const totalExpenses = useMemo(() => filteredExpenses.reduce((s, i) => s + i.amountPaise, 0), [filteredExpenses]);

  // Income by head
  const incByHead = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of filteredIncomes) { map.set(i.head, (map.get(i.head) || 0) + i.amountPaise); }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredIncomes]);

  // Expense by category
  const expByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filteredExpenses) { map.set(e.category, (map.get(e.category) || 0) + e.amountPaise); }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  // Tax estimate
  const taxResult = useMemo(() => {
    if (totalIncome === 0) return null;
    const salary: SalaryInput = {
      basicPaise: Math.floor(totalIncome * 0.4), hraPaise: Math.floor(totalIncome * 0.2),
      specialAllowancePaise: Math.floor(totalIncome * 0.3), conveyancePaise: 0, ltaPaise: 0,
      bonusPaise: 0, otherTaxablePaise: Math.floor(totalIncome * 0.1),
      employerPfPaise: 0, professionTaxPaise: 0,
    };
    const deductions: DeductionInput = {
      section80C_paise: 0, section80D_paise: 0, section80E_paise: 0,
      section80TTA_paise: 0, homeLoanInterestPaise: 0, nps80CCD_paise: 0, otherDeductionsPaise: 0,
    };
    return compareRegimes({ salary, deductions, tdsDeductedPaise: 0, fy: currentFY });
  }, [totalIncome, currentFY]);

  // Capital gains
  const gains = useMemo(() => {
    if (filteredTrades.length === 0) return null;
    const trades: TradeEntry[] = filteredTrades.map((t) => ({
      instrument: t.instrument, buyDate: new Date(t.buyDate), sellDate: new Date(t.sellDate),
      qty: t.qty, buyPricePaise: t.buyPricePaise, sellPricePaise: t.sellPricePaise, chargesPaise: t.chargesPaise,
    }));
    return computePortfolioGains(trades);
  }, [filteredTrades]);

  // Trade table
  const tradesSorted = useMemo(() =>
    [...filteredTrades].sort((a, b) => new Date(a.sellDate).getTime() - new Date(b.sellDate).getTime()),
    [filteredTrades]
  );

  const handleExportCSV = () => {
    const lines: string[] = [];
    lines.push('FY Tax Summary - ' + currentFY);
    lines.push('');
    lines.push('--- INCOME ---');
    lines.push('Head,Amount');
    for (const [head, amt] of incByHead) { lines.push(`${head},${toRupees(amt)}`); }
    lines.push(`Total Income,${toRupees(totalIncome)}`);
    lines.push('');
    lines.push('--- EXPENSES ---');
    lines.push('Category,Amount');
    for (const [cat, amt] of expByCategory) { lines.push(`${cat},${toRupees(amt)}`); }
    lines.push(`Total Expenses,${toRupees(totalExpenses)}`);
    lines.push('');
    lines.push('--- CAPITAL GAINS ---');
    lines.push('Instrument,Buy Date,Sell Date,Qty,Buy Price,Sell Price,P&L,Classification');
    for (const t of tradesSorted) {
      lines.push(`${t.instrument},${t.buyDate},${t.sellDate},${t.qty},${toRupees(t.buyPricePaise)},${toRupees(t.sellPricePaise)},${toRupees(t.realizedPnlPaise)},${t.classification}`);
    }
    if (gains) {
      lines.push(`Total STCG,${toRupees(gains.totalSTCGPaise)}`);
      lines.push(`Total LTCG,${toRupees(gains.totalLTCGPaise)}`);
      lines.push(`STCG Tax,${toRupees(gains.stcgTaxPaise)}`);
      lines.push(`LTCG Tax,${toRupees(gains.ltcgTaxPaise)}`);
    }
    lines.push('');
    lines.push('--- TAX SUMMARY ---');
    if (taxResult) {
      lines.push(`Recommended Regime,${taxResult.recommendation}`);
      lines.push(`New Regime Tax,${toRupees(taxResult.newRegime.totalTaxPaise)}`);
      lines.push(`Old Regime Tax,${toRupees(taxResult.oldRegime.totalTaxPaise)}`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FinSathi-FY-${currentFY}-Summary.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const hasData = totalIncome > 0 || totalExpenses > 0 || tradeItems.length > 0;

  return (
    <div className="fy-summary" ref={printRef}>
      <div className="fy-summary-header">
        <div>
          <h1 className="text-headline-md">FY_TAX_SUMMARY</h1>
          <span className="text-label-mono color-muted">FINANCIAL YEAR {currentFY}</span>
        </div>
        {hasData && (
          <div className="fy-summary-actions">
            <button className="fy-export-btn" onClick={handleExportCSV}>
              <span className="material-symbols-outlined icon-sm" style={{ fontVariationSettings: "'wght' 300" }}>download</span>
              CSV
            </button>
            <button className="fy-export-btn" onClick={handlePrint}>
              <span className="material-symbols-outlined icon-sm" style={{ fontVariationSettings: "'wght' 300" }}>print</span>
              PRINT
            </button>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="glass-surface fy-empty">
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'rgba(255,255,255,0.12)' }}>summarize</span>
          <span className="text-label-mono color-muted" style={{ marginTop: '12px' }}>NO_DATA</span>
          <span className="text-body color-muted" style={{ marginTop: '4px', fontSize: '12px' }}>Add income, expenses, or trades to generate FY summary</span>
        </div>
      ) : (
        <>
          {/* Income Section */}
          <div className="glass-surface fy-section">
            <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <span className="text-label-mono color-subtle">INCOME_SUMMARY</span>
              <span className="text-data-display color-positive" style={{ fontSize: '12px' }}>
                <CurrencyValue paise={totalIncome} />
              </span>
            </div>
            <div className="fy-section-body">
              {incByHead.map(([head, amt]) => (
                <div key={head} className="fy-row">
                  <span className="text-label-mono-sm color-muted">{head.toUpperCase()}</span>
                  <span className="text-data-display" style={{ fontSize: '11px' }}>
                    <CurrencyValue paise={amt} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Expense Section */}
          <div className="glass-surface fy-section">
            <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <span className="text-label-mono color-subtle">EXPENSE_SUMMARY</span>
              <span className="text-data-display" style={{ fontSize: '12px' }}>
                <CurrencyValue paise={totalExpenses} />
              </span>
            </div>
            <div className="fy-section-body">
              {expByCategory.map(([cat, amt]) => (
                <div key={cat} className="fy-row">
                  <span className="text-label-mono-sm color-muted">{cat.toUpperCase()}</span>
                  <span className="text-data-display" style={{ fontSize: '11px' }}>
                    <CurrencyValue paise={amt} />
                  </span>
                </div>
              ))}
              <div className="fy-divider" />
              <div className="fy-row">
                <span className="text-label-mono color-subtle">NET_SAVINGS</span>
                <span className={`text-data-display ${totalIncome - totalExpenses >= 0 ? 'color-positive' : 'color-negative'}`} style={{ fontSize: '12px' }}>
                  <CurrencyValue paise={totalIncome - totalExpenses} />
                </span>
              </div>
            </div>
          </div>

          {/* Capital Gains Section */}
          {tradesSorted.length > 0 && (
            <div className="glass-surface fy-section">
              <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
                <span className="text-label-mono color-subtle">CAPITAL_GAINS_LEDGER</span>
                <span className="text-label-mono-sm color-muted">{tradesSorted.length} TRADES</span>
              </div>
              <div className="fy-trades-header">
                <span>INSTRUMENT</span>
                <span>BUY</span>
                <span>SELL</span>
                <span>QTY</span>
                <span>P&L</span>
                <span>TYPE</span>
              </div>
              {tradesSorted.map((t) => (
                <div key={t.id} className="glass-row fy-trade-row">
                  <span className="text-body" style={{ fontWeight: 500 }}>{t.instrument}</span>
                  <span className="text-label-mono-sm color-muted"><CurrencyValue paise={t.buyPricePaise} /></span>
                  <span className="text-label-mono-sm color-muted"><CurrencyValue paise={t.sellPricePaise} /></span>
                  <span className="text-label-mono-sm">{t.qty}</span>
                  <span className={`text-data-display ${t.realizedPnlPaise >= 0 ? 'color-positive' : 'color-negative'}`} style={{ fontSize: '11px' }}>
                    <CurrencyValue paise={t.realizedPnlPaise} sign />
                  </span>
                  <span className={`text-label-mono-sm ${t.classification === 'LTCG' ? 'color-positive' : 'color-warning'}`}>{t.classification}</span>
                </div>
              ))}
              {gains && (
                <div className="fy-section-body" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="fy-row">
                    <span className="text-label-mono-sm color-muted">STCG (SHORT TERM)</span>
                    <span className="text-data-display" style={{ fontSize: '11px' }}><CurrencyValue paise={gains.totalSTCGPaise} /></span>
                  </div>
                  <div className="fy-row">
                    <span className="text-label-mono-sm color-muted">LTCG (LONG TERM)</span>
                    <span className="text-data-display" style={{ fontSize: '11px' }}><CurrencyValue paise={gains.totalLTCGPaise} /></span>
                  </div>
                  <div className="fy-row">
                    <span className="text-label-mono-sm color-muted">STCG TAX @20%</span>
                    <span className="text-data-display color-negative" style={{ fontSize: '11px' }}><CurrencyValue paise={gains.stcgTaxPaise} /></span>
                  </div>
                  <div className="fy-row">
                    <span className="text-label-mono-sm color-muted">LTCG TAX @12.5%</span>
                    <span className="text-data-display color-negative" style={{ fontSize: '11px' }}><CurrencyValue paise={gains.ltcgTaxPaise} /></span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tax Computation */}
          {taxResult && (
            <div className="glass-surface fy-section">
              <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
                <span className="text-label-mono color-subtle">TAX_COMPUTATION</span>
                <span className={`text-label-mono-sm ${taxResult.recommendation === 'new' ? 'color-positive' : 'color-warning'}`}>
                  RECOMMENDED: {taxResult.recommendation.toUpperCase()}
                </span>
              </div>
              <div className="fy-tax-compare">
                <div className="fy-tax-col">
                  <div className="text-label-mono-sm color-positive" style={{ marginBottom: '6px' }}>NEW REGIME</div>
                  <div className="fy-row">
                    <span className="text-label-mono-sm color-muted">TAXABLE INCOME</span>
                    <span className="text-data-display" style={{ fontSize: '11px' }}><CurrencyValue paise={taxResult.newRegime.taxableIncomePaise} /></span>
                  </div>
                  <div className="fy-row">
                    <span className="text-label-mono-sm color-muted">TAX</span>
                    <span className="text-data-display color-negative" style={{ fontSize: '11px' }}><CurrencyValue paise={taxResult.newRegime.totalTaxPaise} /></span>
                  </div>
                  <div className="fy-row">
                    <span className="text-label-mono-sm color-muted">EFF. RATE</span>
                    <span className="text-data-display" style={{ fontSize: '11px' }}>{taxResult.newRegime.effectiveRate}%</span>
                  </div>
                </div>
                <div className="fy-tax-divider" />
                <div className="fy-tax-col">
                  <div className="text-label-mono-sm color-warning" style={{ marginBottom: '6px' }}>OLD REGIME</div>
                  <div className="fy-row">
                    <span className="text-label-mono-sm color-muted">TAXABLE INCOME</span>
                    <span className="text-data-display" style={{ fontSize: '11px' }}><CurrencyValue paise={taxResult.oldRegime.taxableIncomePaise} /></span>
                  </div>
                  <div className="fy-row">
                    <span className="text-label-mono-sm color-muted">TAX</span>
                    <span className="text-data-display color-negative" style={{ fontSize: '11px' }}><CurrencyValue paise={taxResult.oldRegime.totalTaxPaise} /></span>
                  </div>
                  <div className="fy-row">
                    <span className="text-label-mono-sm color-muted">EFF. RATE</span>
                    <span className="text-data-display" style={{ fontSize: '11px' }}>{taxResult.oldRegime.effectiveRate}%</span>
                  </div>
                </div>
              </div>
              <div className="fy-section-body" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="fy-row" style={{ paddingTop: '4px' }}>
                  <span className="text-label-mono color-subtle">TOTAL TAX (SALARY + CAPITAL GAINS)</span>
                  <span className="text-headline-md color-negative">
                    <CurrencyValue 
                      paise={(taxResult.recommendation === 'new' ? taxResult.newRegime.totalTaxPaise : taxResult.oldRegime.totalTaxPaise) + (gains?.netTaxPaise || 0)} 
                    />
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="fy-disclaimer">
            <span className="text-label-mono-sm color-muted">↳ GENERATED BY FINSATHI · NOT A LEGAL DOCUMENT</span>
            <span className="text-label-mono-sm color-muted">↳ VERIFY ALL FIGURES WITH A CHARTERED ACCOUNTANT BEFORE FILING</span>
            <span className="text-label-mono-sm color-muted">↳ GENERATED: {new Date().toLocaleString('en-IN')}</span>
          </div>
        </>
      )}
    </div>
  );
}
