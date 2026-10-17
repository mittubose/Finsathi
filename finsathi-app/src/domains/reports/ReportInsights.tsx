import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import './ReportInsights.css';

interface Insight {
  id: string;
  type: 'positive' | 'warning' | 'info';
  label: string;
  value: string | number;
  description: string;
  icon: string;
}

interface ReportInsightsProps {
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  taxLiability: number;
}

export function ReportInsights({ totalIncome, totalExpenses, savingsRate, taxLiability }: ReportInsightsProps) {
  const insights: Insight[] = React.useMemo(() => {
    const list: Insight[] = [];

    // Savings Rate Insight
    if (savingsRate > 40) {
      list.push({
        id: 'savings-high',
        type: 'positive',
        label: 'EFFICIENCY_OPTIMIZED',
        value: `${savingsRate}%`,
        description: 'Your savings velocity is in the top decile. Accumulation phase is accelerating.',
        icon: 'verified_user'
      });
    } else if (savingsRate < 15 && totalIncome > 0) {
      list.push({
        id: 'savings-low',
        type: 'warning',
        label: 'LIQUIDITY_DRAIN',
        value: `${savingsRate}%`,
        description: 'Operating margins are tight. Recommend auditing non-essential outflows.',
        icon: 'warning'
      });
    }

    // Tax Insight
    if (taxLiability > totalIncome * 0.2) {
      list.push({
        id: 'tax-high',
        type: 'warning',
        label: 'FISCAL_FRICTION',
        value: 'HIGH',
        description: 'Projected tax liability exceeds 20% of gross. Review deduction eligibility.',
        icon: 'account_balance'
      });
    }

    // General Stability
    if (totalIncome > totalExpenses * 2) {
      list.push({
        id: 'stability',
        type: 'info',
        label: 'RESERVE_STRENGTH',
        value: 'STABLE',
        description: 'Income-to-expense ratio indicates strong structural stability.',
        icon: 'shield'
      });
    }

    return list;
  }, [totalIncome, totalExpenses, savingsRate, taxLiability]);

  if (insights.length === 0) return null;

  return (
    <section className="report-insights">
      <div className="glass-card-header" style={{ marginBottom: '16px' }}>
        <span className="text-label-mono color-subtle">INTELLIGENCE_REPORT</span>
        <span className="text-label-mono-sm color-muted">V4.2.0-INSIGHTS</span>
      </div>
      
      <div className="insights-scroller">
        <AnimatePresence mode="popLayout">
          {insights.map((insight, idx) => (
            <motion.div
              key={insight.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ 
                type: "spring", 
                stiffness: 300, 
                damping: 25, 
                delay: idx * 0.1 
              }}
              className={`insight-card glass-surface ${insight.type}`}
            >
              <div className="insight-icon-wrap">
                <span className="material-symbols-outlined">{insight.icon}</span>
              </div>
              <div className="insight-content">
                <div className="insight-header">
                  <span className="text-label-mono-sm insight-label">{insight.label}</span>
                  <span className="text-data-display insight-value">{insight.value}</span>
                </div>
                <p className="text-body insight-desc">{insight.description}</p>
              </div>
              <div className="insight-glow" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
