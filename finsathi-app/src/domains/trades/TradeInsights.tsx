import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { formatINR } from '../../shared/lib/currency';
import './TradeInsights.css';

interface TradeInsightsProps {
  onSelectMonth?: (monthIndex: number, year: number) => void;
}

const containerany = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemany = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 }
  }
};

export function TradeInsights({ onSelectMonth }: TradeInsightsProps) {
  const { tradeItems } = useAppStore();
  
  // Filter state
  const [filterYear, setFilterYear] = useState('all');
  const [filterQuarter, setFilterQuarter] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');

  const years = useMemo(() => {
    const y = new Set<string>();
    tradeItems.forEach(t => y.add(new Date(t.sellDate).getFullYear().toString()));
    return Array.from(y).sort().reverse();
  }, [tradeItems]);

  const filteredItems = useMemo(() => {
    return tradeItems.filter(t => {
      const d = new Date(t.sellDate);
      if (filterYear !== 'all' && d.getFullYear().toString() !== filterYear) return false;
      if (filterMonth !== 'all' && d.getMonth().toString() !== filterMonth) return false;
      if (filterQuarter !== 'all') {
        const q = Math.floor(d.getMonth() / 3) + 1;
        if (q.toString() !== filterQuarter) return false;
      }
      return true;
    });
  }, [tradeItems, filterYear, filterMonth, filterQuarter]);

  const metrics = useMemo(() => {
    if (filteredItems.length === 0) return null;

    const wins = filteredItems.filter(t => t.realizedPnlPaise > 0);
    const losses = filteredItems.filter(t => t.realizedPnlPaise < 0);
    
    const winRate = Math.round((wins.length / filteredItems.length) * 100);
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.realizedPnlPaise, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.realizedPnlPaise, 0) / losses.length) : 1;
    const profitFactor = avgLoss > 0 ? (wins.reduce((s, t) => s + t.realizedPnlPaise, 0) / Math.abs(losses.reduce((s, t) => s + t.realizedPnlPaise, 0) || 1)) : 0;
    const riskReward = avgWin / avgLoss;
    
    const calcBreakdown = (type: string) => {
      const items = filteredItems.filter(t => t.classification === type);
      const net = items.reduce((s, t) => s + t.realizedPnlPaise, 0);
      const w = items.filter(t => t.realizedPnlPaise > 0).length;
      const wr = items.length > 0 ? Math.round((w / items.length) * 100) : 0;
      return { net, wr, count: items.length };
    };

    const stcg = calcBreakdown('STCG');
    const ltcg = calcBreakdown('LTCG');
    const intraday = calcBreakdown('INTRADAY');

    const rrScore = Math.min(riskReward / 3, 1) * 100;
    const score = Math.round((winRate * 0.6) + (rrScore * 0.4));

    const monthMap = new Map<string, number>();
    filteredItems.forEach(t => {
      const d = new Date(t.sellDate);
      const monthKey = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).toUpperCase();
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + t.realizedPnlPaise);
    });

    const monthEntries = Array.from(monthMap.entries()).sort((a, b) => b[1] - a[1]);
    const bestMonth = monthEntries[0];
    const worstMonth = monthEntries[monthEntries.length - 1];

    return {
      score, winRate, profitFactor,
      stcg, ltcg, intraday,
      bestMonth: bestMonth ? { label: bestMonth[0], val: bestMonth[1] } : null,
      worstMonth: worstMonth ? { label: worstMonth[0], val: worstMonth[1] } : null,
    };
  }, [filteredItems]);

  if (tradeItems.length === 0) {
    return (
      <div className="glass-surface insights-empty">
        <span className="material-symbols-outlined icon-xl color-muted">analytics</span>
        <p className="text-label-mono color-muted">ADD_TRADES_TO_SEE_INSIGHTS</p>
      </div>
    );
  }

  return (
    <div className="trade-insights">
      {/* Internal Filters */}
      <motion.div 
        className="insights-filters glass-surface"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="filter-group">
          <label className="text-label-mono-sm color-muted">YEAR</label>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="insights-select">
            <option value="all">ALL_YEARS</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="text-label-mono-sm color-muted">QUARTER</label>
          <select value={filterQuarter} onChange={e => setFilterQuarter(e.target.value)} className="insights-select">
            <option value="all">ALL_QUARTERS</option>
            <option value="1">Q1 (APR-JUN)</option>
            <option value="2">Q2 (JUL-SEP)</option>
            <option value="3">Q3 (OCT-DEC)</option>
            <option value="4">Q4 (JAN-MAR)</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="text-label-mono-sm color-muted">MONTH</label>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="insights-select">
            <option value="all">ALL_MONTHS</option>
            {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map((m, i) => (
              <option key={m} value={i.toString()}>{m}</option>
            ))}
          </select>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {!metrics ? (
          <motion.div 
            key="empty"
            className="glass-surface insights-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="material-symbols-outlined icon-xl color-muted">filter_list_off</span>
            <p className="text-label-mono color-muted">NO_DATA_MATCHES_FILTERS</p>
          </motion.div>
        ) : (
          <motion.div 
            key="grid"
            className="insights-grid"
            variants={containerany}
            initial="hidden"
            animate="visible"
          >
            {/* Left Column: Score & Summary */}
            <motion.div variants={itemany} className="glass-surface insight-card score-card">
              <div className="insight-header">
                <span className="text-label-mono-sm color-subtle">STRATEGY_PERFORMANCE</span>
              </div>
              <div className="score-display-compact">
                <span className="text-headline-lg">{metrics.score}</span>
                <span className="text-label-mono-sm color-muted">INSIGHT_SCORE</span>
              </div>
              <div className="insights-mini-stats">
                <div className="mini-stat">
                  <span className="text-label-mono-sm color-muted">WIN_RATE</span>
                  <span className="text-headline-sm">{metrics.winRate}%</span>
                </div>
                <div className="mini-stat">
                  <span className="text-label-mono-sm color-muted">P_FACTOR</span>
                  <span className="text-headline-sm">{metrics.profitFactor.toFixed(2)}x</span>
                </div>
              </div>
            </motion.div>

            {/* Middle Column: Detailed Breakdowns */}
            <div className="insights-breakdown-row">
              {[
                { label: 'STCG', data: metrics.stcg },
                { label: 'LTCG', data: metrics.ltcg },
                { label: 'INTRADAY', data: metrics.intraday }
              ].map((b, idx) => (
                <motion.div key={b.label} variants={itemany} className="glass-surface breakdown-card">
                  <span className="text-label-mono-sm color-subtle">{b.label}</span>
                  <div className={`text-headline-sm ${b.data.net >= 0 ? 'color-positive' : 'color-negative'}`}>
                    {formatINR(b.data.net)}
                  </div>
                  <div className="breakdown-meta">
                    <span className={`text-label-mono-sm ${b.data.wr >= 50 ? 'color-positive' : 'color-warning'}`}>{b.data.wr}% WR</span>
                    <span className="dot-divider" />
                    <span className="text-label-mono-sm color-muted">{b.data.count} TRADES</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Right Column: Extremes */}
            <motion.div variants={itemany} className="glass-surface peak-card">
              <div className="glass-card-header">
                <span className="text-label-mono-sm color-subtle">TEMPORAL_EXTREMES</span>
              </div>
              <div className="peak-list">
                <div className="peak-item">
                  <div className="peak-meta">
                    <span className="text-label-mono-sm color-muted">BEST_MONTH</span>
                    <span className="text-body-bold" style={{ fontSize: '12px' }}>{metrics.bestMonth?.label || 'N/A'}</span>
                  </div>
                  <span className="text-data-display color-positive">+{formatINR(metrics.bestMonth?.val || 0)}</span>
                </div>
                <div className="peak-item">
                  <div className="peak-meta">
                    <span className="text-label-mono-sm color-muted">WORST_MONTH</span>
                    <span className="text-body-bold" style={{ fontSize: '12px' }}>{metrics.worstMonth?.label || 'N/A'}</span>
                  </div>
                  <span className="text-data-display color-negative">{formatINR(metrics.worstMonth?.val || 0)}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
