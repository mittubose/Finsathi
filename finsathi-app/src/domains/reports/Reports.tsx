import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ReportInsights } from './ReportInsights';
import { formatINR, formatINRCompact } from '../../shared/lib/currency';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { computeTax, computePortfolioGains } from '../tax/engine';
import type { SalaryInput, DeductionInput, TaxInput, TradeEntry } from '../tax/engine';
import { advanceTaxDates } from '../../shared/lib/dates';
import { MultiYearReport } from './MultiYearReport';
import { Skeleton, CardSkeleton } from '../../shared/ui/Skeleton';
import './Reports.css';

export function Reports() {
  const { incomeItems, expenseItems, tradeItems, currentFY } = useAppStore();
  const [reportView, setReportView] = useState<'current' | 'historical'>('current');
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, [reportView]);

  const totalIncome = useMemo(() => incomeItems.reduce((sum, i) => sum + i.amountPaise, 0), [incomeItems]);
  const totalExpenses = useMemo(() => expenseItems.reduce((sum, i) => sum + i.amountPaise, 0), [expenseItems]);

  const expByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenseItems) {
      map.set(e.category, (map.get(e.category) || 0) + e.amountPaise);
    }
    return Array.from(map.entries())
      .map(([cat, amt]) => ({ category: cat, amountPaise: amt, pct: totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0 }))
      .sort((a, b) => b.amountPaise - a.amountPaise);
  }, [expenseItems, totalExpenses]);

  const incByHead = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of incomeItems) {
      map.set(i.head, (map.get(i.head) || 0) + i.amountPaise);
    }
    return Array.from(map.entries())
      .map(([head, amt]) => ({ head, amountPaise: amt, pct: totalIncome > 0 ? Math.round((amt / totalIncome) * 100) : 0 }))
      .sort((a, b) => b.amountPaise - a.amountPaise);
  }, [incomeItems, totalIncome]);

  const monthlyData = useMemo(() => {
    const months: { month: string; income: number; expense: number }[] = [];
    const monthMap = new Map<string, { income: number; expense: number }>();

    for (const i of incomeItems) {
      const key = i.date.substring(0, 7);
      const entry = monthMap.get(key) || { income: 0, expense: 0 };
      entry.income += i.amountPaise;
      monthMap.set(key, entry);
    }
    for (const e of expenseItems) {
      const key = e.date.substring(0, 7);
      const entry = monthMap.get(key) || { income: 0, expense: 0 };
      entry.expense += e.amountPaise;
      monthMap.set(key, entry);
    }

    const sorted = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [key, val] of sorted) {
      const [y, m] = key.split('-');
      const label = new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }).toUpperCase();
      months.push({ month: label, ...val });
    }
    return months;
  }, [incomeItems, expenseItems]);

  const taxSummary = useMemo(() => {
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
    const input: TaxInput = { salary, deductions, tdsDeductedPaise: 0, fy: currentFY };
    return computeTax(input, 'new');
  }, [totalIncome, currentFY]);

  const tradingSummary = useMemo(() => {
    if (tradeItems.length === 0) return null;
    const trades: TradeEntry[] = tradeItems.map((t) => ({
      instrument: t.instrument, buyDate: new Date(t.buyDate), sellDate: new Date(t.sellDate),
      qty: t.qty, buyPricePaise: t.buyPricePaise, sellPricePaise: t.sellPricePaise, chargesPaise: t.chargesPaise,
    }));
    return computePortfolioGains(trades);
  }, [tradeItems]);

  const advTax = advanceTaxDates(currentFY);
  const now = new Date();

  const maxExp = expByCategory.length > 0 ? expByCategory[0].amountPaise : 1;
  const maxInc = incByHead.length > 0 ? incByHead[0].amountPaise : 1;
  const maxMonth = monthlyData.reduce((m, d) => Math.max(m, d.income, d.expense), 1);

  const hasData = totalIncome > 0 || totalExpenses > 0 || tradeItems.length > 0;

  return (
    <div className="reports">
      <div className="reports-header">
        <div>
          <h1 className="text-headline-md">REPORTS_CENTER</h1>
          <p className="text-label-mono-sm color-muted">SYSTEM_ANALYTICS_V4</p>
        </div>
        <div className="reports-tabs">
          <button 
            className={`reports-tab ${reportView === 'current' ? 'active' : ''}`}
            onClick={() => setReportView('current')}
          >
            CURRENT_FY
          </button>
          <button 
            className={`reports-tab ${reportView === 'historical' ? 'active' : ''}`}
            onClick={() => setReportView('historical')}
          >
            MULTI_YEAR
          </button>
        </div>
      </div>

      {reportView === 'historical' ? (
        <MultiYearReport />
      ) : isLoading ? (
        <div className="reports-grid">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <React.Fragment>
          <div className="reports-fy-indicator glass-surface">
            <span className="text-label-mono-sm color-muted">ACTIVE_VIEWPORT:</span>
            <span className="text-label-mono color-positive">FY {currentFY}</span>
          </div>

          <ReportInsights 
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            savingsRate={totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0}
            taxLiability={taxSummary ? taxSummary.totalTaxPaise : 0}
          />

          {!hasData ? (
            <div className="reports-empty glass-surface">
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'rgba(255,255,255,0.12)' }}>summarize</span>
              <span className="text-label-mono color-muted" style={{ marginTop: '12px' }}>NO_DATA_FOR_REPORTS</span>
              <span className="text-body color-muted" style={{ marginTop: '4px', fontSize: '12px' }}>
                Add income, expenses, or trades to generate reports
              </span>
            </div>
          ) : (
            <div className="reports-grid">
              {/* Summary Row */}
              <motion.div 
                className="reports-summary glass-surface"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <span className="text-label-mono color-subtle">FY_SUMMARY</span>
                </div>
                <div className="reports-summary-body">
                  {[
                    { label: 'TOTAL_INCOME', value: totalIncome, color: 'color-positive' },
                    { label: 'TOTAL_EXPENSES', value: totalExpenses, color: '' },
                    { label: 'NET_SAVINGS', value: totalIncome - totalExpenses, color: totalIncome - totalExpenses >= 0 ? 'color-positive' : 'color-negative' },
                    { label: 'SAVINGS_RATE', value: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0, isPct: true },
                    { label: 'EST_TAX', value: taxSummary ? taxSummary.totalTaxPaise : 0, color: 'color-negative' },
                    { label: 'TRADING_TAX', value: tradingSummary ? tradingSummary.netTaxPaise : 0, color: 'color-negative' },
                  ].map((item, i) => (
                    <motion.div 
                      key={item.label}
                      className="reports-summary-item"
                      whileHover={{ scale: 1.02, x: 5 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    >
                      <span className="text-label-mono-sm color-muted">{item.label}</span>
                      <span className={`text-headline-md ${item.color}`}>
                        {item.isPct ? `${item.value}%` : <CurrencyValue paise={item.value} compact />}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Expense Breakdown */}
              {expByCategory.length > 0 && (
                <motion.div 
                  className="reports-card glass-surface"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <div className="glass-card-header">
                    <span className="text-label-mono color-subtle">EXPENSE_BREAKDOWN</span>
                    <span className="text-label-mono-sm color-muted">{expByCategory.length} CATEGORIES</span>
                  </div>
                  <div className="reports-bar-chart">
                    {expByCategory.map((c, i) => (
                      <motion.div 
                        key={c.category} 
                        className="reports-bar-row"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + (i * 0.05) }}
                        whileHover={{ x: 8 }}
                      >
                        <span className="reports-bar-label text-label-mono-sm color-muted">{c.category.toUpperCase()}</span>
                        <div className="reports-bar-track">
                          <motion.div
                            className="reports-bar-fill reports-bar-fill--expense"
                            initial={{ width: 0 }}
                            animate={{ width: `${(c.amountPaise / maxExp) * 100}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 + (i * 0.05) }}
                          />
                        </div>
                        <span className="reports-bar-value text-data-display" style={{ fontSize: '10px' }}>
                          <CurrencyValue paise={c.amountPaise} compact />
                        </span>
                        <span className="reports-bar-pct text-label-mono-sm color-muted">{c.pct}%</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Income Breakdown */}
              {incByHead.length > 0 && (
                <motion.div 
                  className="reports-card glass-surface"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <div className="glass-card-header">
                    <span className="text-label-mono color-subtle">INCOME_BREAKDOWN</span>
                  </div>
                  <div className="reports-bar-chart">
                    {incByHead.map((h, i) => (
                      <motion.div 
                        key={h.head} 
                        className="reports-bar-row"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + (i * 0.05) }}
                        whileHover={{ x: -8 }}
                      >
                        <span className="reports-bar-label text-label-mono-sm color-muted">{h.head.toUpperCase()}</span>
                        <div className="reports-bar-track">
                          <motion.div
                            className="reports-bar-fill reports-bar-fill--income"
                            initial={{ width: 0 }}
                            animate={{ width: `${(h.amountPaise / maxInc) * 100}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 + (i * 0.05) }}
                          />
                        </div>
                        <span className="reports-bar-value text-data-display" style={{ fontSize: '10px' }}>
                          <CurrencyValue paise={h.amountPaise} compact />
                        </span>
                        <span className="reports-bar-pct text-label-mono-sm color-muted">{h.pct}%</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Monthly Trend */}
              {monthlyData.length > 0 && (
                <motion.div 
                  className="reports-card glass-surface" 
                  style={{ gridColumn: '1 / -1' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  <div className="glass-card-header">
                    <span className="text-label-mono color-subtle">MONTHLY_TREND</span>
                  </div>
                  <div className="reports-monthly-chart">
                    {monthlyData.map((m, i) => (
                      <div key={m.month} className="reports-monthly-col">
                        <div className="reports-monthly-bars">
                          <motion.div
                            className="reports-monthly-bar reports-monthly-bar--income"
                            initial={{ height: 0 }}
                            animate={{ height: `${(m.income / maxMonth) * 100}%` }}
                            transition={{ duration: 1, delay: 0.5 + (i * 0.05), ease: "circOut" }}
                            title={`Income: ${formatINR(m.income)}`}
                          />
                          <motion.div
                            className="reports-monthly-bar reports-monthly-bar--expense"
                            initial={{ height: 0 }}
                            animate={{ height: `${(m.expense / maxMonth) * 100}%` }}
                            transition={{ duration: 1, delay: 0.6 + (i * 0.05), ease: "circOut" }}
                            title={`Expense: ${formatINR(m.expense)}`}
                          />
                        </div>
                        <span className="text-label-mono-sm color-muted" style={{ marginTop: '4px' }}>{m.month}</span>
                      </div>
                    ))}
                  </div>
                  <div className="reports-legend">
                    <span className="reports-legend-item"><span className="reports-legend-dot reports-legend-dot--income" /> INCOME</span>
                    <span className="reports-legend-item"><span className="reports-legend-dot reports-legend-dot--expense" /> EXPENSE</span>
                  </div>
                </motion.div>
              )}

              {/* Advance Tax Timeline */}
              <div className="reports-card glass-surface" style={{ gridColumn: '1 / -1' }}>
                <div className="glass-card-header">
                  <span className="text-label-mono color-subtle">ADVANCE_TAX_TIMELINE</span>
                  <span className="text-label-mono-sm color-muted">FY {currentFY}</span>
                </div>
                <div className="reports-timeline">
                  {advTax.map((q) => {
                    const isPast = q.date < now;
                    const isNext = !isPast && advTax.filter((aq) => aq.date < now).length === advTax.indexOf(q) - 1;
                    return (
                      <div key={q.quarter} className={`reports-timeline-item ${isPast ? 'reports-timeline-item--past' : ''}`}>
                        <div className={`reports-timeline-dot ${isPast ? 'past' : isNext ? 'next' : ''}`} />
                        <div>
                          <span className="text-label-mono" style={{ fontSize: '11px' }}>{q.quarter}</span>
                          <span className="text-label-mono-sm color-muted">
                            {q.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-label-mono-sm color-muted">{q.pct}% DUE</span>
                        <span className="text-data-display" style={{ fontSize: '11px' }}>
                          <CurrencyValue paise={taxSummary ? Math.floor(taxSummary.totalTaxPaise * q.pct / 100) : 0} compact />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </React.Fragment>
      )}
    </div>
  );
}
