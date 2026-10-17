import { useMemo } from 'react';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { formatINR, formatINRCompact } from '../../shared/lib/currency';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { relativeTime } from '../../shared/lib/dates';
import { computeTax, computePortfolioGains } from '../tax/engine';
import type { SalaryInput, DeductionInput, TaxInput } from '../tax/engine';
import { CashFlowProjection } from './CashFlowProjection';
import { Skeleton, CardSkeleton } from '../../shared/ui/Skeleton';
import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { usePlanningStore } from '../../shared/hooks/usePlanningStore';
import { useRiskStore } from '../../shared/hooks/useRiskStore';
import { useFamilyStore } from '../../shared/hooks/useFamilyStore';
import { useProfileStore } from '../../shared/hooks/useProfileStore';
import { useWidgetStore } from '../../shared/widgets/useWidgetStore';
import { WidgetRenderer } from '../../shared/widgets/WidgetRenderer';
import { ZeroStageOnboarding } from '../../shared/ui/ZeroStageOnboarding';
import { WhatsNewModal } from '../../shared/ui/WhatsNewModal';
import { APP_VERSION } from '../../shared/lib/versioning';
import { DueRecurringBanner } from '../recurring/DueRecurringBanner';
import { AccountManagerModal } from '../auth/AccountManagerModal';
import { CommandDeck } from '../command-deck/CommandDeck';
import { BarChart, Bar, ResponsiveContainer, Tooltip } from 'recharts';
import './Dashboard.css';

export function Dashboard() {
  const { incomeItems, expenseItems, tradeItems, reminders, currentFY } = useAppStore();
  const { loans, buckets } = usePlanningStore();
  const { policies } = useRiskStore();
  const { cashflows } = useFamilyStore();
  const { widgets } = useWidgetStore();
  const { getActiveProfile, markVersionSeen } = useProfileStore();
  const activeProfile = getActiveProfile();

  const [isLoading, setIsLoading] = useState(true);
  const [dashboardMode, setDashboardMode] = useState<'command-deck' | 'modular' | 'classic'>('command-deck');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showAccountVault, setShowAccountVault] = useState(false);
  
  // New State for UI controls
  const [savingsTimeline, setSavingsTimeline] = useState<'month' | 'year' | 'all'>('month');
  const [isTaxAnnualized, setIsTaxAnnualized] = useState(true);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);

  useEffect(() => {
    // If user has not completed onboarding for this profile, trigger zero-stage preference selection
    if (activeProfile && activeProfile.hasCompletedOnboarding === false) {
      setShowOnboarding(true);
    }
  }, [activeProfile.id, activeProfile.hasCompletedOnboarding]);

  const hasNewUpdate = activeProfile.lastSeenVersion && activeProfile.lastSeenVersion !== APP_VERSION;

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const savingsCats = ['Savings', 'SIP', 'RD'];

  // All-time savings for Net Worth snapshot
  const allTimeSavings = useMemo(() => {
    return expenseItems
      .filter(e => savingsCats.includes(e.category))
      .reduce((sum, e) => sum + e.amountPaise, 0);
  }, [expenseItems]);

  const { totalIncome, totalExpenses, totalSavings, savingsBreakdown } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    let sav = 0;
    const breakdown: Record<string, number> = {};
    
    const now = new Date();
    const currMonth = now.getMonth();
    const currYear = now.getFullYear();

    incomeItems.forEach(i => {
      const iDate = new Date(i.date);
      let include = true;
      if (savingsTimeline === 'month') {
        include = iDate.getMonth() === currMonth && iDate.getFullYear() === currYear;
      } else if (savingsTimeline === 'year') {
        include = i.fy === currentFY;
      }
      if (include) {
        inc += i.amountPaise;
      }
    });

    expenseItems.forEach(e => {
      const eDate = new Date(e.date);
      let include = true;
      if (savingsTimeline === 'month') {
        include = eDate.getMonth() === currMonth && eDate.getFullYear() === currYear;
      } else if (savingsTimeline === 'year') {
        const month = eDate.getMonth();
        const year = eDate.getFullYear();
        const startYear = month >= 3 ? year : year - 1;
        const fy = `${startYear}-${String(startYear + 1).slice(2)}`;
        include = fy === currentFY;
      }

      if (include) {
        if (savingsCats.includes(e.category)) {
          sav += e.amountPaise;
          breakdown[e.category] = (breakdown[e.category] || 0) + e.amountPaise;
        } else {
          exp += e.amountPaise;
        }
      }
    });

    return { 
      totalIncome: inc,
      totalExpenses: exp, 
      totalSavings: sav, 
      savingsBreakdown: Object.entries(breakdown).sort((a, b) => b[1] - a[1]) 
    };
  }, [incomeItems, expenseItems, savingsTimeline, currentFY]);

  const netDisposable = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

  // New Metrics
  const totalDebt = loans.reduce((acc, l) => acc + l.principalAmountPaise, 0);
  // Only count active investments (not sold)
  const totalInvested = tradeItems
    .filter(t => !t.sellDate || t.sellPricePaise === 0)
    .reduce((acc, t) => acc + (t.qty * t.buyPricePaise), 0);
  const netWorth = allTimeSavings + totalInvested - totalDebt;

  // Detailed drilldown data for Net Disposable Income
  const drilldownData = useMemo(() => {
    const incomeHeads: Record<string, number> = {};
    const expenseCats: Record<string, number> = {};

    const now = new Date();
    const currMonth = now.getMonth();
    const currYear = now.getFullYear();

    incomeItems.forEach(i => {
      const iDate = new Date(i.date);
      let include = true;
      if (savingsTimeline === 'month') {
        include = iDate.getMonth() === currMonth && iDate.getFullYear() === currYear;
      } else if (savingsTimeline === 'year') {
        include = i.fy === currentFY;
      }
      if (include) {
        incomeHeads[i.head] = (incomeHeads[i.head] || 0) + i.amountPaise;
      }
    });

    expenseItems.forEach(e => {
      const eDate = new Date(e.date);
      let include = true;
      if (savingsTimeline === 'month') {
        include = eDate.getMonth() === currMonth && eDate.getFullYear() === currYear;
      } else if (savingsTimeline === 'year') {
        const month = eDate.getMonth();
        const year = eDate.getFullYear();
        const startYear = month >= 3 ? year : year - 1;
        const fy = `${startYear}-${String(startYear + 1).slice(2)}`;
        include = fy === currentFY;
      }
      if (include && !savingsCats.includes(e.category)) {
        expenseCats[e.category] = (expenseCats[e.category] || 0) + e.amountPaise;
      }
    });

    return {
      incomeBreakdown: Object.entries(incomeHeads).sort((a, b) => b[1] - a[1]),
      expenseBreakdown: Object.entries(expenseCats).sort((a, b) => b[1] - a[1]),
    };
  }, [incomeItems, expenseItems, savingsTimeline, currentFY]);

  // Savings trend over the last 6 months for mini chart
  const monthlySavingsTrend = useMemo(() => {
    const trend: Record<string, number> = {};
    const now = new Date();
    const monthsList: { key: string; label: string }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
      trend[key] = 0;
      monthsList.push({ key, label });
    }

    expenseItems.forEach(e => {
      if (savingsCats.includes(e.category)) {
        const d = new Date(e.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (key in trend) {
          trend[key] += e.amountPaise;
        }
      }
    });

    return monthsList.map(m => ({
      name: m.label,
      amount: trend[m.key] / 100 // Convert to Rupees for rendering
    }));
  }, [expenseItems]);

  // Upcoming Notifications Engine
  const upcomingRenewals = policies.filter(p => {
    const diff = new Date(p.renewalDate).getTime() - new Date().getTime();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000; // Next 30 days
  });

  const upcomingCashflows = cashflows.filter(c => {
    if (!c.expectedDate) return false;
    const diff = new Date(c.expectedDate).getTime() - new Date().getTime();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  });

  // Quick tax estimate from income items
  const taxEstimate = useMemo(() => {
    const fyIncomes = incomeItems.filter(i => i.fy === currentFY);
    const fyTotalIncome = fyIncomes.reduce((sum, i) => sum + i.amountPaise, 0);

    if (fyTotalIncome === 0) return null;

    const now = new Date();
    const currMonth = now.getMonth();
    const currYear = now.getFullYear();
    const currMonthIncome = incomeItems
      .filter(i => new Date(i.date).getMonth() === currMonth && new Date(i.date).getFullYear() === currYear)
      .reduce((sum, i) => sum + i.amountPaise, 0);

    const effectiveIncome = isTaxAnnualized 
      ? (currMonthIncome > 0 ? currMonthIncome * 12 : fyTotalIncome)
      : fyTotalIncome;
    
    const salaryInput: SalaryInput = {
      basicPaise: Math.floor(effectiveIncome * 0.4),
      hraPaise: Math.floor(effectiveIncome * 0.2),
      specialAllowancePaise: Math.floor(effectiveIncome * 0.3),
      conveyancePaise: 0,
      ltaPaise: 0,
      bonusPaise: 0,
      otherTaxablePaise: Math.floor(effectiveIncome * 0.1),
      employerPfPaise: 0,
      professionTaxPaise: 0,
    };
    const deductions: DeductionInput = {
      section80C_paise: 0, section80D_paise: 0, section80E_paise: 0,
      section80TTA_paise: 0, homeLoanInterestPaise: 0, nps80CCD_paise: 0,
      otherDeductionsPaise: 0,
    };
    const input: TaxInput = { salary: salaryInput, deductions, tdsDeductedPaise: 0, fy: currentFY };
    return computeTax(input, 'new');
  }, [incomeItems, currentFY, isTaxAnnualized]);

  // Trading P&L
  const tradingPnL = useMemo(() => {
    if (tradeItems.length === 0) return null;
    const trades = tradeItems.map((t) => ({
      instrument: t.instrument,
      buyDate: new Date(t.buyDate),
      sellDate: new Date(t.sellDate),
      qty: t.qty,
      buyPricePaise: t.buyPricePaise,
      sellPricePaise: t.sellPricePaise,
      chargesPaise: t.chargesPaise,
    }));
    return computePortfolioGains(trades);
  }, [tradeItems]);

  const recentTransactions = useMemo(() => {
    const all = [
      ...incomeItems.map((i) => ({ ...i, sortDate: i.date })),
      ...expenseItems.map((i) => ({ ...i, sortDate: i.date })),
      ...tradeItems.map((i) => ({ ...i, type: 'trade' as const, sortDate: i.sellDate })),
    ];
    return all.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()).slice(0, 6);
  }, [incomeItems, expenseItems, tradeItems]);

  const overdueReminders = reminders.filter(
    (r) => r.status === 'overdue' || (r.status === 'upcoming' && new Date(r.nextDue) <= new Date())
  );

  return (
    <div className="dashboard">
      {isLoading ? (
        <div className="dashboard-skeleton">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <>
          {/* Software Update Notification Banner */}
          {hasNewUpdate && (
            <div
              style={{
                background: 'linear-gradient(90deg, rgba(0,255,65,0.08) 0%, rgba(0,0,0,0.6) 100%)',
                border: '1px solid rgba(0,255,65,0.3)',
                borderRadius: '3px',
                padding: '10px 14px',
                marginBottom: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00ff41', boxShadow: '0 0 8px #00ff41' }} />
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#00ff41', fontWeight: 700 }}>
                  UPDATE AVAILABLE (v{APP_VERSION}):
                </span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
                  Modular Widgets, Local AI MCP, and Trade Pipelines added.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowWhatsNew(true)}
                  style={{
                    background: 'var(--primary-container, #00ff41)',
                    color: '#000',
                    border: 'none',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    cursor: 'pointer',
                    borderRadius: '2px',
                  }}
                >
                  WHAT'S NEW (v{APP_VERSION}) →
                </button>
                <button
                  onClick={() => markVersionSeen(activeProfile.id, APP_VERSION)}
                  style={{
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    borderRadius: '2px',
                  }}
                >
                  DISMISS
                </button>
              </div>
            </div>
          )}

          {/* Due Recurring Commitments Banner */}
          <DueRecurringBanner />

          {/* Dashboard Mode Switcher */}
          <div className="dashboard-view-switcher" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '3px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px' }}>
              <button
                className={`dashboard-switch-btn ${dashboardMode === 'command-deck' ? 'active' : ''}`}
                onClick={() => setDashboardMode('command-deck')}
                style={{
                  background: dashboardMode === 'command-deck' ? 'var(--primary-container, #00ff41)' : 'transparent',
                  color: dashboardMode === 'command-deck' ? '#000' : 'rgba(255,255,255,0.6)',
                  border: 'none',
                  padding: '4px 10px',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderRadius: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span className="material-symbols-outlined icon-xs" style={{ fontSize: '14px' }}>space_dashboard</span>
                COMMAND DECK (PRD v2)
              </button>
              <button
                className={`dashboard-switch-btn ${dashboardMode === 'modular' ? 'active' : ''}`}
                onClick={() => setDashboardMode('modular')}
                style={{
                  background: dashboardMode === 'modular' ? 'var(--primary-container, #00ff41)' : 'transparent',
                  color: dashboardMode === 'modular' ? '#000' : 'rgba(255,255,255,0.6)',
                  border: 'none',
                  padding: '4px 10px',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderRadius: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span className="material-symbols-outlined icon-xs" style={{ fontSize: '14px' }}>dashboard_customize</span>
                MODULAR WORKFLOW
              </button>
              <button
                className={`dashboard-switch-btn ${dashboardMode === 'classic' ? 'active' : ''}`}
                onClick={() => setDashboardMode('classic')}
                style={{
                  background: dashboardMode === 'classic' ? 'var(--primary-container, #00ff41)' : 'transparent',
                  color: dashboardMode === 'classic' ? '#000' : 'rgba(255,255,255,0.6)',
                  border: 'none',
                  padding: '4px 10px',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderRadius: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span className="material-symbols-outlined icon-xs" style={{ fontSize: '14px' }}>grid_view</span>
                ANALYTICS GRID
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => setShowAccountVault(true)}
                style={{
                  background: 'rgba(0, 230, 118, 0.1)',
                  color: 'var(--brand-primary, #00e676)',
                  border: '1px solid rgba(0, 230, 118, 0.3)',
                  borderRadius: '3px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span className="material-symbols-outlined icon-xs" style={{ fontSize: '14px' }}>shield</span>
                ACCOUNT VAULT & RECOVERY
              </button>

              <NavLink to="/settings" style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--primary-container)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="material-symbols-outlined icon-xs" style={{ fontSize: '14px' }}>tune</span>
                <span>CONFIGURE WIDGETS →</span>
              </NavLink>
            </div>
          </div>

          {dashboardMode === 'command-deck' ? (
            <CommandDeck />
          ) : dashboardMode === 'modular' ? (
            <div className="modular-widgets-stack" style={{ width: '100%' }}>
              {widgets
                .filter((w) => w.enabled)
                .sort((a, b) => a.order - b.order)
                .map((w) => (
                  <WidgetRenderer key={w.id} widget={w} />
                ))}

              {/* Gradual Disclosure: Discover More Modules Card */}
              <div
                style={{
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.01)',
                  padding: '16px',
                  borderRadius: '3px',
                  marginTop: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary-container)' }}>
                      add_circle_outline
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>
                      Discover & Add More Modules
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                    Looking for Stock Trades, Salary Slips, or Tax Optimizers? Add them anytime or change your persona.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setShowOnboarding(true)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fff',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      borderRadius: '2px',
                    }}
                  >
                    CHANGE PERSONA ↺
                  </button>
                  <NavLink
                    to="/settings"
                    style={{
                      background: 'var(--primary-container, #00ff41)',
                      color: '#000',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      textDecoration: 'none',
                      borderRadius: '2px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    MANAGE WIDGETS →
                  </NavLink>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Hero Section */}
              <section 
                className="dashboard-hero glass-surface widget-hover" 
                onClick={() => setIsDrilldownOpen(true)} 
                style={{ cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}
              >
                <div className="dashboard-hero-content">
              <div>
                <h1 className="text-label-mono color-subtle" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  NET_DISPOSABLE_INCOME
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--primary-container)' }}>info</span>
                </h1>
                <div className="text-headline-lg" style={{ marginTop: '4px' }}>
                  <CurrencyValue paise={totalIncome > 0 ? netDisposable : 0} />
                </div>
                {totalIncome > 0 && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <div className="text-label-mono-sm color-muted">IN <span className="color-positive"><CurrencyValue paise={totalIncome} compact /></span></div>
                    <div className="text-label-mono-sm color-muted">OUT <span className="color-negative"><CurrencyValue paise={totalExpenses} compact /></span></div>
                  </div>
                )}
              </div>
              {totalIncome > 0 && (
                <div className="dashboard-hero-badge">
                  <span className="material-symbols-outlined icon-xs color-positive">
                    {netDisposable >= 0 ? 'trending_up' : 'trending_down'}
                  </span>
                  <span className="text-label-mono-sm color-positive">FY {currentFY}</span>
                </div>
              )}
            </div>

            {/* Segmented Progress Bar */}
            {totalIncome > 0 && (
              <div className="dashboard-progress">
                <div className="dashboard-progress-labels">
                  <span className="text-label-mono-sm color-muted">SAVINGS_RATIO</span>
                  <span className="text-label-mono-sm color-muted">{savingsRate}%</span>
                </div>
                <div className="dashboard-progress-bar">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div
                      key={i}
                      className={`dashboard-progress-segment ${
                        i < Math.round(savingsRate / 10) ? 'active' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Bento Grid */}
          <section className="dashboard-grid">
            <CashFlowProjection />

        {/* Net Worth Snapshot */}
        <div className="glass-surface dashboard-widget" style={{ gridColumn: 'span 2' }}>
          <div className="glass-card-header">
            <h2 className="text-label-mono color-positive">NET_WORTH_SNAPSHOT</h2>
            <span className="material-symbols-outlined icon-xs color-positive" style={{ fontVariationSettings: "'wght' 200" }}>account_balance_wallet</span>
          </div>
          <div className="dashboard-widget-body" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="text-headline-lg color-positive">
                <CurrencyValue paise={netWorth} />
              </div>
              <div className="text-label-mono-sm color-muted" style={{ marginTop: '4px' }}>Assets - Liabilities</div>
            </div>
            <div className="dashboard-kv-list" style={{ minWidth: '150px' }}>
              <div className="dashboard-kv">
                <span className="color-muted">LIQUID_SAVINGS</span>
                <span className="color-positive"><CurrencyValue paise={allTimeSavings} compact /></span>
              </div>
              <div className="dashboard-kv">
                <span className="color-muted">INVESTMENTS</span>
                <span className="color-positive"><CurrencyValue paise={totalInvested} compact /></span>
              </div>
              <div className="dashboard-kv">
                <span className="color-muted">TOTAL_DEBT</span>
                <span className="color-error"><CurrencyValue paise={totalDebt} compact /></span>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Notifications Engine */}
        {(upcomingRenewals.length > 0 || upcomingCashflows.length > 0) && (
          <div className="glass-surface dashboard-widget" style={{ gridColumn: 'span 2', borderColor: 'var(--warning)' }}>
            <div className="glass-card-header">
              <h2 className="text-label-mono color-warning">UPCOMING_NOTIFICATIONS</h2>
              <span className="material-symbols-outlined icon-xs color-warning" style={{ fontVariationSettings: "'wght' 200" }}>notifications_active</span>
            </div>
            <div className="dashboard-widget-body" style={{ gap: '8px' }}>
              {upcomingRenewals.map(p => (
                <div key={p.id} className="glass-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,170,0,0.1)' }}>
                  <span className="text-body-sm">{p.provider} ({p.type}) Renewal</span>
                  <span className="text-label-mono-sm color-warning">
                    <CurrencyValue paise={p.annualPremiumPaise} /> due {new Date(p.renewalDate).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {upcomingCashflows.map(c => (
                <div key={c.id} className="glass-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,170,0,0.1)' }}>
                  <span className="text-body-sm">{c.label} ({c.type})</span>
                  <span className="text-label-mono-sm color-warning">
                    <CurrencyValue paise={c.expectedAmountPaise} /> expected {new Date(c.expectedDate!).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trading P&L Widget */}

        {/* Trading P&L Widget */}
        <div className="glass-surface dashboard-widget">
          <div className="glass-card-header">
            <h2 className="text-label-mono color-subtle">TRADING_PNL</h2>
            <span className="material-symbols-outlined icon-xs color-muted" style={{ fontVariationSettings: "'wght' 200" }}>monitoring</span>
          </div>
          <div className="dashboard-widget-body">
            <div className="text-headline-md">
              <CurrencyValue 
                paise={tradingPnL ? (tradingPnL.totalSTCGPaise + tradingPnL.totalLTCGPaise - tradingPnL.totalSTCLPaise - tradingPnL.totalLTCLPaise) : 0} 
                compact 
              />
            </div>
            <div className="dashboard-kv-list">
              <div className="dashboard-kv">
                <span className="color-muted">STCG</span>
                <CurrencyValue paise={tradingPnL ? tradingPnL.totalSTCGPaise : 0} compact />
              </div>
              <div className="dashboard-kv">
                <span className="color-muted">LTCG</span>
                <CurrencyValue paise={tradingPnL ? tradingPnL.totalLTCGPaise : 0} compact />
              </div>
              <div className="dashboard-kv">
                <span className="color-muted">TAX_EST</span>
                <CurrencyValue paise={tradingPnL ? tradingPnL.netTaxPaise : 0} compact />
              </div>
            </div>
          </div>
        </div>

        {/* Savings Bucket Widget */}
        <div className="glass-surface dashboard-widget">
          <div className="glass-card-header" style={{ alignItems: 'flex-start' }}>
            <div>
              <h2 className="text-label-mono color-positive">SAVINGS_BUCKET</h2>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button className={`text-label-mono-xs ${savingsTimeline === 'month' ? 'color-positive' : 'color-muted'}`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setSavingsTimeline('month')}>1M</button>
                <button className={`text-label-mono-xs ${savingsTimeline === 'year' ? 'color-positive' : 'color-muted'}`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setSavingsTimeline('year')}>1Y</button>
                <button className={`text-label-mono-xs ${savingsTimeline === 'all' ? 'color-positive' : 'color-muted'}`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setSavingsTimeline('all')}>ALL</button>
              </div>
            </div>
            <span className="material-symbols-outlined icon-xs color-positive" style={{ fontVariationSettings: "'wght' 200" }}>savings</span>
          </div>
          <div className="dashboard-widget-body">
            <div className="text-label-mono-sm color-muted" style={{ marginBottom: '4px' }}>TOTAL_CONTRIBUTIONS</div>
            <div className="text-headline-md color-positive">
              <CurrencyValue paise={totalSavings} compact />
            </div>

            {/* Sparkline trend of last 6 months */}
            <div style={{ width: '100%', height: '40px', marginTop: '10px', marginBottom: '4px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySavingsTrend}>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="glass-surface-elevated" style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontFamily: 'var(--font-headline)' }}>
                            <span className="color-muted">{payload[0].payload.name}:</span> <span className="color-positive">₹{payload[0].value?.toLocaleString()}</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="amount" fill="var(--primary-container)" opacity={0.6} radius={[1, 1, 0, 0]} barSize={8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="dashboard-kv-list" style={{ marginTop: '4px' }}>
              {savingsBreakdown.length > 0 ? savingsBreakdown.map(([cat, amt]) => (
                <div key={cat} className="dashboard-kv">
                  <span className="color-muted">{cat.toUpperCase()}</span>
                  <CurrencyValue paise={amt} compact />
                </div>
              )) : (
                <span className="text-label-mono-sm color-muted">NO_SAVINGS_LOGGED</span>
              )}
            </div>
          </div>
        </div>

        {/* Savings Rate Widget */}
        <div className="glass-surface dashboard-widget">
          <div className="glass-card-header">
            <h2 className="text-label-mono color-subtle">SAVINGS_RATE</h2>
            <span className="material-symbols-outlined icon-xs color-muted" style={{ fontVariationSettings: "'wght' 200" }}>donut_large</span>
          </div>
          <div className="dashboard-widget-body" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <div className="dashboard-gauge">
              <svg viewBox="0 0 80 80" className="dashboard-gauge-svg">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke="var(--primary-container)"
                  strokeWidth="2"
                  strokeDasharray={`${(savingsRate / 100) * 213.6} 213.6`}
                  strokeDashoffset="0"
                  transform="rotate(-90 40 40)"
                  opacity="0.8"
                />
              </svg>
              <div className="dashboard-gauge-value">
                <span className="text-headline-md">{savingsRate}%</span>
                <span className="text-label-mono-sm color-muted" style={{ marginTop: '2px' }}>MONTHLY</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tax Estimator Widget */}
        <div className="glass-surface dashboard-widget">
          <div className="glass-card-header">
            <h2 className="text-label-mono color-subtle">TAX_ESTIMATOR</h2>
            <button 
              className={`text-label-mono-xs ${isTaxAnnualized ? 'color-positive' : 'color-muted'}`} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }} 
              onClick={() => setIsTaxAnnualized(!isTaxAnnualized)}
            >
              {isTaxAnnualized ? 'ANNUALIZED' : 'ACTUAL'}
            </button>
          </div>
          <div className="dashboard-widget-body">
            <div className="text-label-mono-sm color-muted" style={{ marginBottom: '4px' }}>EST_LIABILITY_FY</div>
            <div className="text-headline-md color-negative">
              <CurrencyValue paise={taxEstimate ? taxEstimate.totalTaxPaise : 0} />
            </div>
            <div className="dashboard-kv-list" style={{ marginTop: 'auto' }}>
              <div className="dashboard-kv">
                <span className="color-muted">EFFECTIVE_RATE</span>
                <span>{taxEstimate ? `${taxEstimate.effectiveRate}%` : '0%'}</span>
              </div>
              <div className="dashboard-kv">
                <span className="color-muted">REGIME</span>
                <span className="color-positive">NEW</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="dashboard-actions">
        {[
          { icon: 'add_circle', label: 'ADD_INCOME', path: '/ledger?add=income' },
          { icon: 'remove_circle', label: 'ADD_EXPENSE', path: '/ledger?add=expense' },
          { icon: 'candlestick_chart', label: 'ADD_TRADE', path: '/trades?add=true' },
          { icon: 'upload_file', label: 'IMPORT', path: '/imports' },
          { icon: 'notifications', label: 'REMINDER', path: '/reminders?add=true' },
        ].map((action) => (
          <a key={action.label} href={action.path} className="dashboard-action-btn glass-surface">
            <span className="material-symbols-outlined color-positive" style={{ fontSize: '16px' }}>{action.icon}</span>
            <span className="text-label-mono-sm">{action.label}</span>
          </a>
        ))}
      </section>

      {/* Recent Activity */}
      <section className="glass-surface dashboard-activity">
        <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <h2 className="text-label-mono color-subtle">RECENT_ACTIVITY</h2>
          <a href="/ledger" className="text-label-mono-sm color-muted" style={{ textDecoration: 'none' }}>VIEW_ALL</a>
        </div>
        <div className="dashboard-activity-list">
          {recentTransactions.length === 0 ? (
            <div className="dashboard-empty">
              <span className="material-symbols-outlined color-muted" style={{ fontSize: '32px', marginBottom: '8px' }}>inbox</span>
              <span className="text-label-mono color-muted">NO_TRANSACTIONS_YET</span>
              <span className="text-body color-muted" style={{ marginTop: '4px', fontSize: '12px' }}>
                Add your first income or expense to get started
              </span>
            </div>
          ) : (
            recentTransactions.map((tx) => {
              const isIncome = tx.type === 'income';
              const isTrade = tx.type === 'trade';
              const amount = isTrade
                ? (tx as any).realizedPnlPaise
                : (tx as any).amountPaise;
              const label = isTrade
                ? (tx as any).instrument
                : isIncome
                ? (tx as any).source || (tx as any).head
                : (tx as any).merchant || (tx as any).category;
              const icon = isIncome ? 'payments' : isTrade ? 'candlestick_chart' : 'shopping_cart';
              const dateStr = isTrade ? (tx as any).sellDate : (tx as any).date;

              return (
                <div key={tx.id} className="glass-row dashboard-activity-row">
                  <div className="dashboard-activity-left">
                    <div className="dashboard-activity-icon">
                      <span className="material-symbols-outlined icon-xs color-subtle" style={{ fontVariationSettings: "'wght' 200" }}>
                        {icon}
                      </span>
                    </div>
                    <div>
                      <div className="text-body truncate">{label}</div>
                      <div className="text-label-mono-sm color-muted">
                        {tx.type.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className={`text-data-display ${isIncome || (isTrade && amount > 0) ? 'color-positive' : ''}`} style={{ fontSize: '12px' }}>
                      {isIncome || (isTrade && amount > 0) ? '+' : '-'}
                      <CurrencyValue paise={Math.abs(amount)} />
                    </div>
                    <div className="text-label-mono-sm color-muted" style={{ marginTop: '2px' }}>
                      {relativeTime(new Date(dateStr))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Overdue Reminders */}
      {overdueReminders.length > 0 && (
        <section className="glass-surface" style={{ padding: '12px' }}>
          <div className="text-label-mono color-warning" style={{ marginBottom: '8px' }}>
            ⚠ {overdueReminders.length} OVERDUE REMINDER{overdueReminders.length > 1 ? 'S' : ''}
          </div>
          {overdueReminders.slice(0, 3).map((r) => (
            <div key={r.id} className="glass-row" style={{ padding: '8px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-body">{r.title}</span>
              <span className="text-data-display color-warning" style={{ fontSize: '12px' }}>
                {r.amountPaise ? <CurrencyValue paise={r.amountPaise} /> : 'CONFIRM_AMT'}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* Net Disposable Income Drilldown Modal */}
      {isDrilldownOpen && (
        <div className="salary-modal-overlay" onClick={() => setIsDrilldownOpen(false)}>
          <div className="glass-surface-elevated salary-modal premium-modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="glass-card-header">
              <span className="text-label-mono color-subtle">NET_DISPOSABLE_INCOME_BREAKDOWN</span>
              <button className="modal-close" onClick={() => setIsDrilldownOpen(false)}>×</button>
            </div>
            <div className="salary-modal-body" style={{ display: 'grid', gap: '20px', maxHeight: '450px', overflowY: 'auto', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-label-mono-sm color-muted">TIMEFRAME</span>
                <span className="text-label-mono-sm color-positive">
                  {savingsTimeline.toUpperCase()} ({savingsTimeline === 'year' ? `FY ${currentFY}` : savingsTimeline === 'month' ? 'CURRENT MONTH' : 'ALL TIME'})
                </span>
              </div>
              
              <div>
                <h3 className="text-label-mono-sm color-positive" style={{ marginBottom: '10px' }}>INCOME_SOURCES</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {drilldownData.incomeBreakdown.length > 0 ? drilldownData.incomeBreakdown.map(([head, val]) => (
                    <div key={head} className="glass-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px' }}>
                      <span className="text-body-sm" style={{ textTransform: 'uppercase' }}>{head}</span>
                      <span className="text-data-display color-positive" style={{ fontSize: '12px' }}><CurrencyValue paise={val} /></span>
                    </div>
                  )) : (
                    <span className="text-label-mono-xs color-muted">NO_INCOME_RECORDED</span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-label-mono-sm color-negative" style={{ marginBottom: '10px' }}>OPERATIONAL_EXPENSES</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {drilldownData.expenseBreakdown.length > 0 ? drilldownData.expenseBreakdown.map(([cat, val]) => (
                    <div key={cat} className="glass-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px' }}>
                      <span className="text-body-sm" style={{ textTransform: 'uppercase' }}>{cat}</span>
                      <span className="text-data-display color-negative" style={{ fontSize: '12px' }}><CurrencyValue paise={val} /></span>
                    </div>
                  )) : (
                    <span className="text-label-mono-xs color-muted">NO_EXPENSES_RECORDED</span>
                  )}
                </div>
              </div>
            </div>
            <div className="salary-modal-actions-premium" style={{ marginTop: '20px', padding: '0 20px 20px 20px' }}>
              <button className="salary-btn-cancel" onClick={() => setIsDrilldownOpen(false)} style={{ width: '100%' }}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
            </>
          )}
        </>
      )}

      {/* Onboarding Preference Selection */}
      <ZeroStageOnboarding 
        isOpen={showOnboarding} 
        onClose={() => setShowOnboarding(false)} 
      />

      {/* Software Update & Feature Notification Modal */}
      <WhatsNewModal 
        isOpen={showWhatsNew} 
        onClose={() => setShowWhatsNew(false)} 
      />

      {/* Account Vault & Data Recovery Modal */}
      <AccountManagerModal
        isOpen={showAccountVault}
        onClose={() => setShowAccountVault(false)}
      />
    </div>
  );
}
