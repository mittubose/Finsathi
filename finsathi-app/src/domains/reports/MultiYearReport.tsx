import { useMemo } from 'react';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { formatINRCompact } from '../../shared/lib/currency';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { computeTax, computePortfolioGains } from '../tax/engine';
import type { TradeEntry } from '../tax/engine';
import './MultiYearReport.css';

export function MultiYearReport() {
  const { incomeItems, expenseItems, tradeItems } = useAppStore();

  const fyData = useMemo(() => {
    const years = new Set<string>();
    incomeItems.forEach(i => years.add(i.fy));
    expenseItems.forEach(e => {
      const year = new Date(e.date).getFullYear();
      const month = new Date(e.date).getMonth();
      const fy = month >= 3 ? `${year}-${(year + 1).toString().slice(2)}` : `${year - 1}-${year.toString().slice(2)}`;
      years.add(fy);
    });
    tradeItems.forEach(t => {
      const year = new Date(t.sellDate).getFullYear();
      const month = new Date(t.sellDate).getMonth();
      const fy = month >= 3 ? `${year}-${(year + 1).toString().slice(2)}` : `${year - 1}-${year.toString().slice(2)}`;
      years.add(fy);
    });

    const sortedYears = Array.from(years).sort().reverse();
    
    return sortedYears.map(fy => {
      const yearInc = incomeItems.filter(i => i.fy === fy);
      const yearExp = expenseItems.filter(e => {
        const d = new Date(e.date);
        const y = d.getFullYear();
        const m = d.getMonth();
        const efy = m >= 3 ? `${y}-${(y + 1).toString().slice(2)}` : `${y - 1}-${y.toString().slice(2)}`;
        return efy === fy;
      });
      const yearTrades = tradeItems.filter(t => {
        const d = new Date(t.sellDate);
        const y = d.getFullYear();
        const m = d.getMonth();
        const tfy = m >= 3 ? `${y}-${(y + 1).toString().slice(2)}` : `${y - 1}-${y.toString().slice(2)}`;
        return tfy === fy;
      });

      const totalInc = yearInc.reduce((sum, i) => sum + i.amountPaise, 0);
      const totalExp = yearExp.reduce((sum, e) => sum + e.amountPaise, 0);
      
      const portfolioGains = yearTrades.length > 0 ? computePortfolioGains(yearTrades.map(t => ({
        instrument: t.instrument, buyDate: new Date(t.buyDate), sellDate: new Date(t.sellDate),
        qty: t.qty, buyPricePaise: t.buyPricePaise, sellPricePaise: t.sellPricePaise, chargesPaise: t.chargesPaise
      }))) : null;

      const salaryTax = totalInc > 0 ? computeTax({
        salary: { 
          basicPaise: Math.floor(totalInc * 0.4), hraPaise: Math.floor(totalInc * 0.2), 
          specialAllowancePaise: Math.floor(totalInc * 0.3), otherTaxablePaise: Math.floor(totalInc * 0.1),
          conveyancePaise: 0, ltaPaise: 0, bonusPaise: 0, employerPfPaise: 0, professionTaxPaise: 0
        },
        deductions: { section80C_paise: 0, section80D_paise: 0, section80E_paise: 0, section80TTA_paise: 0, homeLoanInterestPaise: 0, nps80CCD_paise: 0, otherDeductionsPaise: 0 },
        tdsDeductedPaise: 0, fy
      }, 'new').totalTaxPaise : 0;

      const tradingTax = portfolioGains ? portfolioGains.netTaxPaise : 0;

      return {
        fy,
        income: totalInc,
        expense: totalExp,
        savings: totalInc - totalExp,
        tax: salaryTax + tradingTax,
        savingsRate: totalInc > 0 ? Math.round(((totalInc - totalExp) / totalInc) * 100) : 0
      };
    });
  }, [incomeItems, expenseItems, tradeItems]);

  const maxVal = Math.max(...fyData.map(d => Math.max(d.income, d.expense)), 1);

  return (
    <div className="multi-year animate-in">
      {/* Comparison Table */}
      <div className="glass-surface my-table">
        <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <span className="text-label-mono color-subtle">SIDE_BY_SIDE_COMPARISON</span>
          <span className="text-label-mono-sm color-muted">{fyData.length} YEARS_TRACKED</span>
        </div>
        <div className="my-table-grid">
          <div className="my-table-header">
            <span>FINANCIAL_YEAR</span>
            <span>TOTAL_INCOME</span>
            <span>TOTAL_EXPENSE</span>
            <span>EST_TAX_LIABILITY</span>
            <span>NET_SAVINGS</span>
            <span>RATE</span>
          </div>
          {fyData.map(d => (
            <div key={d.fy} className="glass-row my-table-row">
              <span className="text-label-mono color-positive">FY {d.fy}</span>
              <span className="text-data-display"><CurrencyValue paise={d.income} compact /></span>
              <span className="text-data-display"><CurrencyValue paise={d.expense} compact /></span>
              <span className="text-data-display color-negative"><CurrencyValue paise={d.tax} compact /></span>
              <span className={`text-data-display ${d.savings >= 0 ? 'color-positive' : 'color-negative'}`}>
                <CurrencyValue paise={d.savings} compact />
              </span>
              <span className="text-label-mono-sm color-muted">{d.savingsRate}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Historical Trends */}
      <div className="my-trends-grid">
        <div className="glass-surface my-trend-card">
          <div className="glass-card-header">
            <span className="text-label-mono color-subtle">INCOME_VS_EXPENSE_TREND</span>
          </div>
          <div className="my-trend-chart">
            {fyData.slice().reverse().map(d => (
              <div key={d.fy} className="my-trend-col">
                <div className="my-trend-bars">
                  <div 
                    className="my-trend-bar income" 
                    style={{ height: `${(d.income / maxVal) * 100}%` }}
                    title={`FY ${d.fy} Income: ${formatINRCompact(d.income)}`}
                  />
                  <div 
                    className="my-trend-bar expense" 
                    style={{ height: `${(d.expense / maxVal) * 100}%` }}
                    title={`FY ${d.fy} Expense: ${formatINRCompact(d.expense)}`}
                  />
                </div>
                <span className="text-label-mono-sm color-muted">FY {d.fy.split('-')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-surface my-trend-card">
          <div className="glass-card-header">
            <span className="text-label-mono color-subtle">SAVINGS_RATE_VELOCITY</span>
          </div>
          <div className="my-velocity-list">
            {fyData.map((d, i) => {
              const prev = fyData[i + 1];
              const diff = prev ? d.savingsRate - prev.savingsRate : 0;
              return (
                <div key={d.fy} className="glass-row my-velocity-row">
                  <span className="text-label-mono-sm color-muted">FY {d.fy}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <div className="my-rate-track">
                      <div className="my-rate-fill" style={{ width: `${Math.max(0, d.savingsRate)}%` }} />
                    </div>
                    <span className="text-data-display" style={{ width: '30px' }}>{d.savingsRate}%</span>
                  </div>
                  {prev && (
                    <span className={`text-label-mono-sm ${diff >= 0 ? 'color-positive' : 'color-negative'}`}>
                      {diff >= 0 ? '↑' : '↓'} {Math.abs(diff)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
