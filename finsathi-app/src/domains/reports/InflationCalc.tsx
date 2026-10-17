import { useState, useMemo } from 'react';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { formatINR, formatINRCompact } from '../../shared/lib/currency';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import './InflationCalc.css';

// RBI/CSO CPI data approximations by category (FY 2024-25 estimates)
const CATEGORY_CPI: Record<string, { rate: number; icon: string; label: string }> = {
  food:       { rate: 7.5,  icon: 'restaurant',       label: 'Food & Dining' },
  housing:    { rate: 4.5,  icon: 'home',              label: 'Housing & Rent' },
  transport:  { rate: 6.0,  icon: 'directions_car',    label: 'Transport & Fuel' },
  healthcare: { rate: 5.8,  icon: 'health_and_safety', label: 'Healthcare' },
  education:  { rate: 8.2,  icon: 'school',            label: 'Education' },
  utilities:  { rate: 4.2,  icon: 'bolt',              label: 'Utilities' },
  shopping:   { rate: 3.8,  icon: 'shopping_bag',      label: 'Shopping & Apparel' },
  entertainment: { rate: 4.0, icon: 'movie',           label: 'Entertainment' },
  other:      { rate: 5.0,  icon: 'more_horiz',        label: 'Other' },
};

// Map expense categories to CPI categories
function mapToCPI(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes('food') || lower.includes('dining') || lower.includes('restaurant') || lower.includes('grocery')) return 'food';
  if (lower.includes('rent') || lower.includes('hous')) return 'housing';
  if (lower.includes('transport') || lower.includes('fuel') || lower.includes('cab') || lower.includes('petrol') || lower.includes('car')) return 'transport';
  if (lower.includes('health') || lower.includes('medical') || lower.includes('pharma') || lower.includes('doctor')) return 'healthcare';
  if (lower.includes('school') || lower.includes('edu') || lower.includes('tuition') || lower.includes('course')) return 'education';
  if (lower.includes('electric') || lower.includes('water') || lower.includes('gas') || lower.includes('util')) return 'utilities';
  if (lower.includes('shop') || lower.includes('cloth') || lower.includes('apparel')) return 'shopping';
  if (lower.includes('movie') || lower.includes('stream') || lower.includes('entertain') || lower.includes('ott')) return 'entertainment';
  return 'other';
}

export function InflationCalc() {
  const { expenseItems } = useAppStore();
  const [projectionYears, setProjectionYears] = useState(5);

  // Compute personal inflation from actual spending
  const spendingByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenseItems) {
      const cpi = mapToCPI(e.category);
      map.set(cpi, (map.get(cpi) || 0) + e.amountPaise);
    }
    return map;
  }, [expenseItems]);

  const totalSpend = useMemo(() => {
    let total = 0;
    spendingByCategory.forEach((v) => { total += v; });
    return total;
  }, [spendingByCategory]);

  // Weighted personal inflation rate
  const personalInflationRate = useMemo(() => {
    if (totalSpend === 0) return 5.5; // Default headline CPI
    let weightedSum = 0;
    spendingByCategory.forEach((spend, cat) => {
      const weight = spend / totalSpend;
      const rate = CATEGORY_CPI[cat]?.rate || 5.0;
      weightedSum += weight * rate;
    });
    return Math.round(weightedSum * 10) / 10;
  }, [spendingByCategory, totalSpend]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    return Object.entries(CATEGORY_CPI).map(([key, meta]) => {
      const spend = spendingByCategory.get(key) || 0;
      const weight = totalSpend > 0 ? Math.round((spend / totalSpend) * 1000) / 10 : 0;
      return { key, spend, weight, ...meta };
    }).filter((c) => c.spend > 0 || totalSpend === 0).sort((a, b) => b.spend - a.spend);
  }, [spendingByCategory, totalSpend]);

  // Project future cost of living
  const projection = useMemo(() => {
    const base = totalSpend > 0 ? totalSpend : 100000_00; // ₹1L default for demo
    const years = Array.from({ length: projectionYears }, (_, i) => {
      const year = i + 1;
      const future = Math.round(base * Math.pow(1 + personalInflationRate / 100, year));
      const increase = future - base;
      return { year, future, increase, increasePercent: Math.round((future / base - 1) * 100) };
    });
    return years;
  }, [totalSpend, personalInflationRate, projectionYears]);

  // Headline CPI for comparison
  const headlineCPI = 5.4;
  const diff = Math.round((personalInflationRate - headlineCPI) * 10) / 10;
  const isHigher = diff > 0;

  const hasData = totalSpend > 0;

  return (
    <div className="infl-calc">
      <div className="infl-header">
        <div>
          <h1 className="text-headline-md">INFLATION_CALC</h1>
          <span className="text-label-mono color-muted">PERSONAL INFLATION vs HEADLINE CPI</span>
        </div>
        <div className="infl-source">
          <span className="text-label-mono-sm color-muted">SOURCE: RBI/CSO · FY 2024-25</span>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="infl-hero-grid">
        <div className="glass-surface-elevated infl-hero-card">
          <div className="infl-hero-label">YOUR_INFLATION_RATE</div>
          <div className={`infl-hero-value ${personalInflationRate > headlineCPI ? 'color-negative' : 'color-positive'}`}>
            {personalInflationRate}%
          </div>
          <div className="infl-hero-sub">Weighted avg from {hasData ? 'your spending' : 'national avg'}</div>
        </div>
        <div className="glass-surface infl-hero-card">
          <div className="infl-hero-label">HEADLINE_CPI</div>
          <div className="infl-hero-value color-muted">{headlineCPI}%</div>
          <div className="infl-hero-sub">All India CPI · Official</div>
        </div>
        <div className="glass-surface infl-hero-card">
          <div className="infl-hero-label">PERSONAL_PREMIUM</div>
          <div className={`infl-hero-value ${isHigher ? 'color-negative' : 'color-positive'}`}>
            {isHigher ? '+' : ''}{diff}%
          </div>
          <div className="infl-hero-sub">{isHigher ? 'You face higher inflation' : 'You beat the headline'}</div>
        </div>
        <div className="glass-surface infl-hero-card">
          <div className="infl-hero-label">COST_IN_{projectionYears}Y</div>
          <div className="infl-hero-value">
            {hasData ? <CurrencyValue paise={projection[projection.length - 1]?.future || 0} compact /> : `+${Math.round(Math.pow(1 + personalInflationRate/100, projectionYears) * 100 - 100)}%`}
          </div>
          <div className="infl-hero-sub">At current inflation rate</div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="glass-surface infl-breakdown">
        <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <span className="text-label-mono color-subtle">CATEGORY_INFLATION</span>
          <span className="text-label-mono-sm color-muted">BASED ON {hasData ? 'YOUR SPENDING' : 'NATIONAL WEIGHTS'}</span>
        </div>
        <div className="infl-table-header">
          <span>CATEGORY</span>
          <span>RATE</span>
          <span>WEIGHT</span>
          <span>CONTRIBUTION</span>
        </div>
        {(hasData ? categoryBreakdown : Object.entries(CATEGORY_CPI).map(([key, meta]) => ({
          key, spend: 0, weight: 0, ...meta
        }))).map((cat) => {
          const contribution = hasData
            ? Math.round((cat.weight / 100) * cat.rate * 10) / 10
            : cat.rate * 0.1;
          const maxBar = personalInflationRate || 10;
          return (
            <div key={cat.key} className="glass-row infl-cat-row">
              <div className="infl-cat-info">
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', fontVariationSettings: "'wght' 200" }}>
                  {cat.icon}
                </span>
                <span className="text-body" style={{ fontSize: '11px' }}>{cat.label}</span>
              </div>
              <div className="infl-cat-rate">
                <span className={`text-data-display ${cat.rate >= 7 ? 'color-negative' : cat.rate >= 5 ? 'color-warning' : 'color-positive'}`} style={{ fontSize: '11px' }}>
                  {cat.rate}%
                </span>
              </div>
              <div className="infl-cat-weight">
                <div className="infl-mini-bar">
                  <div className="infl-mini-bar-fill" style={{ width: `${Math.min(100, cat.weight)}%` }} />
                </div>
                <span className="text-label-mono-sm color-muted">{cat.weight > 0 ? `${cat.weight}%` : '—'}</span>
              </div>
              <div className="infl-cat-contrib">
                <span className="text-data-display" style={{ fontSize: '11px' }}>{cat.weight > 0 ? `${contribution}%` : '—'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Projection */}
      <div className="glass-surface infl-projection">
        <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <span className="text-label-mono color-subtle">COST_OF_LIVING_PROJECTION</span>
          <div className="infl-proj-years">
            {[3, 5, 10, 20].map((y) => (
              <button
                key={y}
                className={`infl-year-btn ${projectionYears === y ? 'active' : ''}`}
                onClick={() => setProjectionYears(y)}
              >
                {y}Y
              </button>
            ))}
          </div>
        </div>
        <div className="infl-proj-grid">
          {projection.map((p) => (
            <div key={p.year} className="infl-proj-card">
              <div className="infl-proj-year">YEAR {p.year}</div>
              {hasData ? (
                <>
                  <div className="infl-proj-value"><CurrencyValue paise={p.future} compact /></div>
                  <div className="infl-proj-increase color-negative">+<CurrencyValue paise={p.increase} compact /></div>
                </>
              ) : (
                <>
                  <div className="infl-proj-value">+{p.increasePercent}%</div>
                  <div className="infl-proj-increase color-muted">more expensive</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Budget Suggestion */}
      {hasData && (
        <div className="glass-surface infl-suggestion">
          <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <span className="text-label-mono color-subtle">BUDGET_ADJUSTMENT</span>
          </div>
          <div className="infl-suggest-body">
            <span className="text-label-mono-sm color-muted">
              To maintain your current lifestyle in {projectionYears} years, you need to earn
            </span>
            <span className="text-headline-md color-positive" style={{ margin: '4px 0' }}>
              <CurrencyValue paise={projection[projection.length - 1]?.future || 0} />
            </span>
            <span className="text-label-mono-sm color-muted">
              vs your current annual spend of <CurrencyValue paise={totalSpend} /> · at {personalInflationRate}% personal inflation
            </span>
          </div>
        </div>
      )}

      <div className="infl-disclaimer">
        <span className="text-label-mono-sm color-muted">↳ CPI DATA: RBI MONETARY POLICY REPORT + CSO ESTIMATES · NOT REAL-TIME</span>
        <span className="text-label-mono-sm color-muted">↳ ACTUAL INFLATION VARIES BY GEOGRAPHY, BRAND, AND LIFESTYLE</span>
      </div>
    </div>
  );
}
