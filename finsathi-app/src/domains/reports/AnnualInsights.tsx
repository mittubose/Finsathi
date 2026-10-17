import React, { useMemo } from 'react';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { formatINR, formatINRCompact } from '../../shared/lib/currency';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import './AnnualInsights.css';

export function AnnualInsights() {
  const { incomeItems, expenseItems, tradeItems } = useAppStore();

  const monthlyData = useMemo(() => {
    const buckets = new Map<string, { income: number; expense: number; trades: number }>();
    
    // Process Income
    incomeItems.forEach(i => {
      const month = i.date.slice(0, 7);
      if (!buckets.has(month)) buckets.set(month, { income: 0, expense: 0, trades: 0 });
      buckets.get(month)!.income += i.amountPaise;
    });

    // Process Expenses
    expenseItems.forEach(e => {
      const month = e.date.slice(0, 7);
      if (!buckets.has(month)) buckets.set(month, { income: 0, expense: 0, trades: 0 });
      buckets.get(month)!.expense += e.amountPaise;
    });

    // Process Trades (Realized PnL)
    tradeItems.forEach(t => {
      const month = t.sellDate.slice(0, 7);
      if (!buckets.has(month)) buckets.set(month, { income: 0, expense: 0, trades: 0 });
      buckets.get(month)!.trades += t.realizedPnlPaise;
    });

    return Array.from(buckets.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [incomeItems, expenseItems, tradeItems]);

  const insights = useMemo(() => {
    if (monthlyData.length === 0) return null;

    const withSavings = monthlyData.map(([month, data]) => ({
      month,
      ...data,
      savings: data.income + data.trades - data.expense,
      savingsRate: data.income > 0 ? ((data.income + data.trades - data.expense) / (data.income + data.trades)) * 100 : 0
    }));

    const bestMonth = [...withSavings].sort((a, b) => b.savings - a.savings)[0];
    const expensiveMonth = [...withSavings].sort((a, b) => b.expense - a.expense)[0];
    const avgSavings = withSavings.reduce((acc, curr) => acc + curr.savings, 0) / withSavings.length;

    return { bestMonth, expensiveMonth, avgSavings, count: withSavings.length };
  }, [monthlyData]);

  if (!insights) return null;

  return (
    <div className="insights-page animate-in">
      <header className="insights-header">
        <h1 className="text-headline-md">FISCAL_PERFORMANCE_INSIGHTS</h1>
        <p className="text-label-mono-sm color-muted">PEAK ANALYSIS · {insights.count} MONTHS TRACKED</p>
      </header>

      <div className="insights-grid">
        <div className="glass-surface insight-hero-card best">
          <div className="insight-hero-icon">
            <span className="material-symbols-outlined icon-lg">workspace_premium</span>
          </div>
          <div className="insight-hero-main">
            <span className="text-label-mono-sm color-muted">HIGHEST_SAVINGS_MONTH</span>
            <h2 className="text-headline-lg color-positive">{insights.bestMonth.month}</h2>
            <div className="insight-hero-val">
              <CurrencyValue paise={insights.bestMonth.savings} />
            </div>
          </div>
          <div className="insight-hero-footer">
            <span className="text-label-mono-sm">{insights.bestMonth.savingsRate.toFixed(1)}% SAVINGS RATE</span>
          </div>
        </div>

        <div className="glass-surface insight-hero-card expensive">
          <div className="insight-hero-icon">
            <span className="material-symbols-outlined icon-lg">receipt_long</span>
          </div>
          <div className="insight-hero-main">
            <span className="text-label-mono-sm color-muted">MOST_EXPENSIVE_MONTH</span>
            <h2 className="text-headline-lg color-negative">{insights.expensiveMonth.month}</h2>
            <div className="insight-hero-val">
              <CurrencyValue paise={insights.expensiveMonth.expense} />
            </div>
          </div>
          <div className="insight-hero-footer">
            <span className="text-label-mono-sm">OUTFLOW PEAKED HERE</span>
          </div>
        </div>

        <div className="glass-surface insight-hero-card avg">
          <div className="insight-hero-icon">
            <span className="material-symbols-outlined icon-lg">analytics</span>
          </div>
          <div className="insight-hero-main">
            <span className="text-label-mono-sm color-muted">AVG_MONTHLY_ACCUMULATION</span>
            <h2 className="text-headline-lg">
              <CurrencyValue paise={insights.avgSavings} compact />
            </h2>
            <div className="insight-hero-val" style={{ fontSize: '14px', marginTop: '4px' }}>Net Surplus Velocity</div>
          </div>
        </div>
      </div>

      <div className="glass-surface insights-timeline">
        <div className="glass-card-header">
          <span className="text-label-mono">MONTHLY_EFFICIENCY_TRACKER</span>
        </div>
        <div className="timeline-list">
          {monthlyData.slice(0, 6).map(([month, data]) => {
            const savings = data.income + data.trades - data.expense;
            const isPositive = savings > 0;
            return (
              <div key={month} className="timeline-row glass-row">
                <div className="timeline-month">
                  <span className="text-body-bold">{month}</span>
                </div>
                <div className="timeline-chart">
                  <div className="timeline-bar-bg">
                    <div 
                      className={`timeline-bar-fill ${isPositive ? 'positive' : 'negative'}`} 
                      style={{ width: `${Math.min(100, (Math.abs(savings) / (insights.bestMonth.savings || 1)) * 100)}%` }} 
                    />
                  </div>
                </div>
                <div className="timeline-value">
                  <span className={`text-data-display ${isPositive ? 'color-positive' : 'color-negative'}`}>
                    <CurrencyValue paise={savings} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
