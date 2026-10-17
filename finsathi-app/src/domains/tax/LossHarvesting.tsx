import React, { useState, useMemo } from 'react';
import { useAppStore, type TradeItem } from '../../shared/hooks/useAppStore';
import { useHoldingsStore, type DailyHolding } from '../../shared/hooks/useHoldingsStore';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { toPaise } from '../../shared/lib/currency';

export function LossHarvesting() {
  const { tradeItems, addTrade } = useAppStore();
  const { holdings, addHolding, updateHolding, deleteHolding, resetToDefaultHoldings } = useHoldingsStore();

  // State for Modals & Forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<DailyHolding | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'loss' | 'profit'; holding: DailyHolding } | null>(null);
  
  // Form Fields
  const [symbol, setSymbol] = useState('');
  const [qty, setQty] = useState(100);
  const [avgBuyPriceRupees, setAvgBuyPriceRupees] = useState(500);
  const [currentPriceRupees, setCurrentPriceRupees] = useState(450);
  const [peRatio, setPeRatio] = useState(25.0);
  const [roce, setRoce] = useState(15.0);
  const [medianPE5Y, setMedianPE5Y] = useState(20.0);
  const [holdingType, setHoldingType] = useState<'ST' | 'LT'>('ST');
  const [assetType, setAssetType] = useState<'equity' | 'mf'>('equity');

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAdvanceTaxDetails, setShowAdvanceTaxDetails] = useState(false);

  // 1. Calculate Realized Capital Gains (from trade history ledger)
  const stcgTrades = tradeItems.filter(t => t.classification === 'STCG');
  const ltcgTrades = tradeItems.filter(t => t.classification === 'LTCG');

  const stcgGains = stcgTrades.filter(t => t.realizedPnlPaise > 0).reduce((acc, t) => acc + t.realizedPnlPaise, 0);
  const stcgLosses = stcgTrades.filter(t => t.realizedPnlPaise < 0).reduce((acc, t) => acc + Math.abs(t.realizedPnlPaise), 0);
  
  const ltcgGains = ltcgTrades.filter(t => t.realizedPnlPaise > 0).reduce((acc, t) => acc + t.realizedPnlPaise, 0);
  const ltcgLosses = ltcgTrades.filter(t => t.realizedPnlPaise < 0).reduce((acc, t) => acc + Math.abs(t.realizedPnlPaise), 0);

  const netLtcg = ltcgGains - ltcgLosses;

  // Realized tax saved through current offsets in history
  const stcgTaxSaved = stcgLosses > 0 ? Math.floor(Math.min(stcgLosses, stcgGains) * 20 / 100) : 0;
  const ltcgTaxSaved = ltcgLosses > 0 ? Math.floor(Math.min(ltcgLosses, ltcgGains) * 12.5 / 100) : 0;
  const realizedTaxSavedYtd = stcgTaxSaved + ltcgTaxSaved;

  // Calculate current month's realized tax saved for the Monthly Pace line
  const currentMonthTaxSaved = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const cmTrades = tradeItems.filter(t => {
      const sellDate = new Date(t.sellDate);
      return sellDate.getMonth() === currentMonth && sellDate.getFullYear() === currentYear;
    });
    const cmStcg = cmTrades.filter(t => t.classification === 'STCG');
    const cmLtcg = cmTrades.filter(t => t.classification === 'LTCG');
    const cmStG = cmStcg.filter(t => t.realizedPnlPaise > 0).reduce((acc, t) => acc + t.realizedPnlPaise, 0);
    const cmStL = cmStcg.filter(t => t.realizedPnlPaise < 0).reduce((acc, t) => acc + Math.abs(t.realizedPnlPaise), 0);
    const cmLtG = cmLtcg.filter(t => t.realizedPnlPaise > 0).reduce((acc, t) => acc + t.realizedPnlPaise, 0);
    const cmLtL = cmLtcg.filter(t => t.realizedPnlPaise < 0).reduce((acc, t) => acc + Math.abs(t.realizedPnlPaise), 0);
    const cmStSaved = cmStL > 0 ? Math.floor(Math.min(cmStL, cmStG) * 20 / 100) : 0;
    const cmLtSaved = cmLtL > 0 ? Math.floor(Math.min(cmLtL, cmLtG) * 12.5 / 100) : 0;
    return cmStSaved + cmLtSaved;
  }, [tradeItems]);

  // 2. Continuous Advance Tax Deadlines Calculator (Section 234B/C avoidance)
  const advanceTaxDeadlines = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    const deadlines = [
      { name: '1st Installment (15%)', date: new Date(currentYear, 5, 15), pct: 15 },
      { name: '2nd Installment (45%)', date: new Date(currentYear, 8, 15), pct: 45 },
      { name: '3rd Installment (75%)', date: new Date(currentYear, 11, 15), pct: 75 },
      { name: '4th Installment (100%)', date: new Date(currentYear, 2, 15), pct: 100 },
    ];
    
    const parsed = deadlines.map(d => {
      let dDate = d.date;
      if (d.name.includes('4th') && now.getMonth() >= 3) {
        // Past March of this year, next March is next calendar year
        dDate = new Date(currentYear + 1, 2, 15);
      } else if (!d.name.includes('4th') && dDate.getTime() < now.getTime()) {
        // Past this installment for this year, sets to next year
        dDate = new Date(currentYear + 1, dDate.getMonth(), 15);
      }
      return { ...d, date: dDate };
    });
    
    parsed.sort((a, b) => a.date.getTime() - b.date.getTime());
    const next = parsed.find(p => p.date.getTime() > now.getTime()) || parsed[0];
    const diffMs = next.date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    return {
      all: parsed,
      next: {
        ...next,
        daysRemaining: diffDays,
        formattedDate: next.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      }
    };
  }, []);

  // 3. Unrealized Losses Scan (Loss Harvesting Opportunities)
  const harvestingOpportunities = useMemo(() => {
    return holdings
      .map(h => {
        const unrealizedPnlPaise = (h.currentMarketPricePaise - h.avgBuyPricePaise) * h.qty;
        const potentialTaxSavedPaise = unrealizedPnlPaise < 0 
          ? Math.floor(Math.abs(unrealizedPnlPaise) * (h.holdingType === 'ST' ? 20 : 12.5) / 100)
          : 0;
        
        return {
          holding: h,
          unrealizedPnlPaise,
          potentialTaxSavedPaise
        };
      })
      .filter(opp => opp.unrealizedPnlPaise < 0)
      .sort((a, b) => b.potentialTaxSavedPaise - a.potentialTaxSavedPaise);
  }, [holdings]);

  // Total potential tax savings from open loss positions
  const totalPotentialSavedPaise = harvestingOpportunities.reduce((acc, opp) => acc + opp.potentialTaxSavedPaise, 0);

  // 4. Strategic Exits (ROC 18 under 40 rule validation)
  const strategicExits = useMemo(() => {
    return holdings
      .map(h => {
        const unrealizedPnlPaise = (h.currentMarketPricePaise - h.avgBuyPricePaise) * h.qty;
        // Violates business efficiency and premium valuation: ROCE < 18% AND PE > 40
        const isViolated = h.roce < 18 && h.peRatio > 40;
        
        return {
          holding: h,
          unrealizedPnlPaise,
          isViolated
        };
      })
      .filter(item => item.isViolated)
      .sort((a, b) => b.unrealizedPnlPaise - a.unrealizedPnlPaise); // Sort by highest gains to capture maximum booking potential
  }, [holdings]);

  // Exemption filled metric (LTCG ₹1.25L exemption target)
  const ltcgExemptionLimit = 12500000; // ₹1,25,000 in paise
  const ltcgExemptionFilled = Math.min(Math.max(0, netLtcg), ltcgExemptionLimit);
  const ltcgExemptionPercentage = Math.floor((ltcgExemptionFilled / ltcgExemptionLimit) * 100);

  // Total tax-saving progress tracker (Target: ₹55,625 = 5,562,500 paise)
  const annualSavedTargetPaise = 5562500; // ₹55,625
  const taxSavedProgressPercentage = Math.min(100, Math.floor((realizedTaxSavedYtd / annualSavedTargetPaise) * 100));

  // Handler: Add Holding
  const handleAddHoldingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim() || qty <= 0 || avgBuyPriceRupees <= 0 || currentPriceRupees <= 0) return;

    const newHolding: DailyHolding = {
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      symbol: symbol.toUpperCase().trim(),
      qty: Number(qty),
      avgBuyPricePaise: toPaise(avgBuyPriceRupees),
      currentMarketPricePaise: toPaise(currentPriceRupees),
      peRatio: Number(peRatio),
      roce: Number(roce),
      medianPE5Y: Number(medianPE5Y),
      holdingType,
      assetType,
      lastUpdated: new Date().toISOString(),
    };

    addHolding(newHolding);
    setShowAddModal(false);
    triggerNotification(`Holding for ${newHolding.symbol} successfully added.`);
  };

  // Handler: Edit Holding
  const handleEditClick = (h: DailyHolding) => {
    setEditingHolding(h);
    setSymbol(h.symbol);
    setQty(h.qty);
    setAvgBuyPriceRupees(h.avgBuyPricePaise / 100);
    setCurrentPriceRupees(h.currentMarketPricePaise / 100);
    setPeRatio(h.peRatio);
    setRoce(h.roce);
    setMedianPE5Y(h.medianPE5Y);
    setHoldingType(h.holdingType);
    setAssetType(h.assetType);
    setShowEditModal(true);
  };

  const handleEditHoldingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHolding) return;

    updateHolding(editingHolding.id, {
      symbol: symbol.toUpperCase().trim(),
      qty: Number(qty),
      avgBuyPricePaise: toPaise(avgBuyPriceRupees),
      currentMarketPricePaise: toPaise(currentPriceRupees),
      peRatio: Number(peRatio),
      roce: Number(roce),
      medianPE5Y: Number(medianPE5Y),
      holdingType,
      assetType,
    });

    setShowEditModal(false);
    setEditingHolding(null);
    triggerNotification(`Holding parameters for ${symbol} updated successfully.`);
  };

  // Handler: Simulated Transaction execution (Book Loss / Gain)
  const handleExecuteSimulatedTrade = () => {
    if (!confirmAction) return;

    const { type, holding } = confirmAction;
    const unrealizedPnlPaise = (holding.currentMarketPricePaise - holding.avgBuyPricePaise) * holding.qty;

    // Simulate adding trade ledger transaction
    const mockTrade: TradeItem = {
      id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'trade',
      accountId: 'default',
      instrument: holding.symbol,
      buyDate: holding.holdingType === 'ST' 
        ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 3 months ago
        : new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 13 months ago
      sellDate: new Date().toISOString().split('T')[0],
      qty: holding.qty,
      buyPricePaise: holding.avgBuyPricePaise,
      sellPricePaise: holding.currentMarketPricePaise,
      chargesPaise: 0,
      assetType: holding.assetType,
      classification: holding.holdingType === 'ST' ? 'STCG' : 'LTCG',
      realizedPnlPaise: unrealizedPnlPaise,
      notes: type === 'loss' 
        ? `Simulated tax loss harvesting execution for ${holding.symbol}`
        : `Simulated strategic value exit (ROC 18/40) for ${holding.symbol}`,
      createdAt: new Date().toISOString(),
    };

    // Log the trade in the main app store
    addTrade(mockTrade);
    // Delete holding from the holdings store
    deleteHolding(holding.id);
    setConfirmAction(null);

    const amountRupees = Math.abs(unrealizedPnlPaise) / 100;
    triggerNotification(
      type === 'loss'
        ? `Harvested ₹${amountRupees.toLocaleString('en-IN')} in capital losses from ${holding.symbol}. Your tax estimates have been adjusted.`
        : `Booked strategic exit for ${holding.symbol}. Realized P&L: ₹${(unrealizedPnlPaise / 100).toLocaleString('en-IN')}.`
    );
  };

  const triggerNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const openAddModal = () => {
    setSymbol('');
    setQty(100);
    setAvgBuyPriceRupees(500);
    setCurrentPriceRupees(450);
    setPeRatio(25.0);
    setRoce(15.0);
    setMedianPE5Y(20.0);
    setHoldingType('ST');
    setAssetType('equity');
    setShowAddModal(true);
  };

  return (
    <div className="loss-harvesting animate-in" style={{ padding: '24px', display: 'grid', gap: '24px' }}>
      
      {/* Dynamic Success Toast */}
      {successMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: 'rgba(0, 255, 65, 0.12)',
          border: '1px solid var(--primary-container)',
          color: 'var(--primary-container)',
          borderRadius: '8px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 1050,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          maxWidth: '450px',
          animation: 'animate-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both'
        }}>
          <span className="material-symbols-outlined icon-positive">check_circle</span>
          <span className="text-body-sm font-medium">{successMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="ledger-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div className="header-meta">
          <h1 className="text-headline-md tracking-tighter">TAX_LOSS_HARVESTING // PORTFOLIO OPTIMIZER</h1>
          <div className="status-line">
            <span className="pulse-dot" style={{ background: 'var(--primary-container)' }}></span>
            <span className="text-label-mono color-muted">CONTINUOUS TAX-SAVING & VALUE EXITS SYSTEM</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="salary-btn-secondary" 
            onClick={resetToDefaultHoldings}
            style={{ 
              border: '1px solid rgba(255, 255, 255, 0.1)', 
              borderRadius: '6px', 
              padding: '8px 16px', 
              fontSize: '11px', 
              fontFamily: 'var(--font-headline)', 
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}
          >
            RESET_SEEDED_HOLDINGS
          </button>
          <button 
            className="salary-btn-primary" 
            onClick={openAddModal}
            style={{ 
              background: 'var(--primary-container)', 
              color: '#000',
              borderRadius: '6px', 
              padding: '8px 16px', 
              fontSize: '11px', 
              fontWeight: 600,
              fontFamily: 'var(--font-headline)', 
              letterSpacing: '1px',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
            ADD_POSITION
          </button>
        </div>
      </header>

      {/* Overview & Targets Dashboard Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        
        {/* YTD Target vs Actual Card */}
        <div className="glass-surface" style={{ borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="text-label-mono color-muted">TAX-SAVED TARGET vs ACTUAL (YTD)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="text-headline-lg" style={{ color: 'var(--primary-container)' }}>
              <CurrencyValue paise={realizedTaxSavedYtd} />
            </span>
            <span className="text-label-mono-sm color-muted">
              TARGET: <CurrencyValue paise={annualSavedTargetPaise} compact />
            </span>
          </div>
          
          {/* Progress Bar */}
          <div>
            <div className="planning-progress-bar" style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
              <div 
                className="planning-progress-fill" 
                style={{ 
                  width: `${taxSavedProgressPercentage}%`, 
                  height: '100%', 
                  background: 'var(--primary-container)', 
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }}
              ></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }} className="text-label-mono-sm">
              <span style={{ color: 'var(--primary-container)' }}>{taxSavedProgressPercentage}% OF TARGET MET</span>
              <span className="color-muted">₹{(annualSavedTargetPaise / 100 - realizedTaxSavedYtd / 100).toLocaleString('en-IN')} TO GO</span>
            </div>
          </div>
        </div>

        {/* LTCG exemption goal card */}
        <div className="glass-surface" style={{ borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="text-label-mono color-muted">LTCG ₹1.25L TAX-FREE EXEMPTION (YTD)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="text-headline-lg" style={{ color: netLtcg >= ltcgExemptionLimit ? 'var(--secondary-container)' : 'var(--primary-container)' }}>
              <CurrencyValue paise={ltcgExemptionFilled} />
            </span>
            <span className="text-label-mono-sm color-muted">
              LIMIT: ₹1.25 Lakh
            </span>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="planning-progress-bar" style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
              <div 
                className="planning-progress-fill" 
                style={{ 
                  width: `${ltcgExemptionPercentage}%`, 
                  height: '100%', 
                  background: netLtcg >= ltcgExemptionLimit ? 'var(--secondary-container)' : 'var(--primary-container)', 
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }}
              ></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }} className="text-label-mono-sm">
              <span>{ltcgExemptionPercentage}% OF TAX-FREE GAINS FILLED</span>
              <span className="color-muted">
                {netLtcg > ltcgExemptionLimit 
                  ? `Taxable LTCG: ₹${((netLtcg - ltcgExemptionLimit) / 100).toLocaleString('en-IN')}`
                  : `Remaining Limit: ₹${((ltcgExemptionLimit - ltcgExemptionFilled) / 100).toLocaleString('en-IN')}`
                }
              </span>
            </div>
          </div>
        </div>

        {/* Monthly Target Pace Card */}
        <div className="glass-surface" style={{ borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="text-label-mono color-muted">MONTHLY HARVESTING GOAL (MAY)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="text-headline-lg" style={{ color: currentMonthTaxSaved >= 463500 ? 'var(--primary-container)' : 'var(--secondary-container)' }}>
              <CurrencyValue paise={currentMonthTaxSaved} />
            </span>
            <span className="text-label-mono-sm color-muted">
              GOAL: ₹4,635
            </span>
          </div>

          <div>
            <div className="planning-progress-bar" style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
              <div 
                className="planning-progress-fill" 
                style={{ 
                  width: `${Math.min(100, Math.floor((currentMonthTaxSaved / 463500) * 100))}%`, 
                  height: '100%', 
                  background: currentMonthTaxSaved >= 463500 ? 'var(--primary-container)' : 'var(--secondary-container)', 
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }}
              ></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }} className="text-label-mono-sm">
              <span>{Math.min(100, Math.floor((currentMonthTaxSaved / 463500) * 100))}% MONTHLY PACE FILLED</span>
              <span className="color-muted">
                {currentMonthTaxSaved >= 463500 ? '🟢 Pace Target Met!' : '🟡 Behind Month Pace'}
              </span>
            </div>
          </div>
        </div>

        {/* Potential Saved Open Losses */}
        <div className="glass-surface" style={{ borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid var(--primary-container)' }}>
          <div className="text-label-mono color-muted">HARVESTABLE TAX SAVINGS (UNREALIZED)</div>
          <div className="text-headline-lg" style={{ color: 'var(--primary-container)' }}>
            <CurrencyValue paise={totalPotentialSavedPaise} />
          </div>
          <div className="text-body-sm color-subtle">
            Available to harvest immediately from {harvestingOpportunities.length} underwater positions.
          </div>
        </div>

      </div>

      {/* Dynamic Execution Timing & Advance Tax Calendar */}
      <div className="glass-surface-elevated" style={{ borderRadius: '12px', padding: '20px' }}>
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setShowAdvanceTaxDetails(!showAdvanceTaxDetails)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-symbols-outlined color-info" style={{ fontVariationSettings: "'wght' 200", fontSize: '22px' }}>calendar_month</span>
            <div>
              <span className="text-label-mono color-subtle">ADVANCE TAX HARVESTING ALIGNMENT</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span className="text-body-sm font-medium">Next Deadline: <strong className="color-warning">{advanceTaxDeadlines.next.name}</strong> on {advanceTaxDeadlines.next.formattedDate}</span>
                <span className="salary-pill font-mono" style={{ background: 'rgba(255, 178, 17, 0.12)', color: 'var(--secondary-container)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px' }}>
                  {advanceTaxDeadlines.next.daysRemaining} DAYS REMAINING
                </span>
              </div>
            </div>
          </div>
          <span className="material-symbols-outlined color-muted" style={{ transform: showAdvanceTaxDetails ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            expand_more
          </span>
        </div>

        {showAdvanceTaxDetails && (
          <div style={{ marginTop: '20px', padding: '16px 0 0 0', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {advanceTaxDeadlines.all.map((d, idx) => {
                const isNext = d.name === advanceTaxDeadlines.next.name;
                return (
                  <div 
                    key={idx} 
                    style={{ 
                      background: isNext ? 'rgba(0, 255, 65, 0.04)' : 'rgba(255,255,255,0.02)', 
                      border: isNext ? '1px solid var(--primary-container)' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px', 
                      padding: '12px' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span className="text-label-mono-sm font-semibold" style={{ color: isNext ? 'var(--primary-container)' : 'rgba(255,255,255,0.4)' }}>
                        {d.name.split(' ')[0]} {d.name.split(' ')[1]}
                      </span>
                      <span className="text-label-mono-xs" style={{ background: isNext ? 'rgba(0, 255, 65, 0.1)' : 'rgba(255,255,255,0.04)', color: isNext ? 'var(--primary-container)' : 'rgba(255,255,255,0.3)', padding: '1px 6px', borderRadius: '3px' }}>
                        {d.pct}% DUE
                      </span>
                    </div>
                    <div className="text-body-sm font-medium">{d.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                    <div className="text-label-mono-xs color-muted" style={{ marginTop: '4px' }}>
                      {isNext ? '⚠️ HARVEST NOW TO REDUCE OUTFLOW' : 'MONITOR POSITIONS'}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={{ background: 'rgba(130, 204, 255, 0.06)', borderLeft: '3px solid var(--color-info, #82ccff)', padding: '12px 14px', borderRadius: '4px' }} className="text-body-sm color-subtle">
              <strong style={{ color: '#82ccff' }}>💡 Why align with advance tax quarterly deadlines?</strong>
              <p style={{ marginTop: '4px', fontSize: '12px', lineHeight: '1.4' }}>
                Under Section 234B & 234C of the Income Tax Act, taxpayers who realize substantial capital gains must pay estimated advance taxes in quarterly installments. By continuously harvesting unrealized losses immediately prior to these installment dates (June 15, Sept 15, Dec 15, March 15), you reduce your net realized gains in real-time, thereby decreasing the required advance tax payment and avoiding interest penalties.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Analysis Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        
        {/* Harvesting Opportunities Candidate List */}
        <div className="glass-surface-elevated" style={{ borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <span className="material-symbols-outlined color-positive" style={{ fontSize: '22px', fontVariationSettings: "'wght' 200" }}>trending_down</span>
            <div>
              <span className="text-label-mono font-bold">PORTFOLIO HARVESTING OPPORTUNITIES</span>
              <p className="text-label-mono-sm color-muted" style={{ marginTop: '2px' }}>UNREALIZED LOSSES ELIGIBLE FOR SET-OFFS</p>
            </div>
          </div>

          {harvestingOpportunities.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: '12px', textAlign: 'center' }}>
              <span className="material-symbols-outlined color-muted" style={{ fontSize: '32px', fontVariationSettings: "'wght' 200" }}>check_circle</span>
              <span className="text-label-mono color-muted">NO HARVESTABLE LOSSES</span>
              <span className="text-body-sm color-subtle" style={{ maxWidth: '285px' }}>All your open holding positions are currently profitable or have zero volume.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {harvestingOpportunities.map((opp) => {
                const { holding, unrealizedPnlPaise, potentialTaxSavedPaise } = opp;
                return (
                  <div 
                    key={holding.id}
                    className="item-card"
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '12px', 
                      alignItems: 'stretch',
                      borderLeft: `4px solid ${holding.holdingType === 'ST' ? 'var(--secondary-container)' : '#82ccff'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="text-data-display">{holding.symbol}</span>
                        <span className="text-label-mono-xs" style={{ 
                          background: holding.holdingType === 'ST' ? 'rgba(255, 178, 17, 0.1)' : 'rgba(130, 204, 255, 0.1)', 
                          color: holding.holdingType === 'ST' ? 'var(--secondary-container)' : '#82ccff',
                          padding: '2px 6px',
                          borderRadius: '3px'
                        }}>
                          {holding.holdingType === 'ST' ? 'SHORT TERM (<12M)' : 'LONG TERM (>=12M)'}
                        </span>
                      </div>
                      <div className="text-data-display" style={{ color: 'var(--error)' }}>
                        <CurrencyValue paise={unrealizedPnlPaise} sign={true} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }} className="text-label-mono-xs">
                      <div style={{ display: 'flex', gap: '16px' }} className="color-muted">
                        <span>QTY: {holding.qty}</span>
                        <span>AVG BUY: ₹{(holding.avgBuyPricePaise / 100).toLocaleString('en-IN')}</span>
                        <span>CMP: ₹{(holding.currentMarketPricePaise / 100).toLocaleString('en-IN')}</span>
                      </div>
                      <div style={{ color: 'var(--primary-container)', fontWeight: 600 }}>
                        POTENTIAL TAX SAVED: <CurrencyValue paise={potentialTaxSavedPaise} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
                      <span className="text-label-mono-xs color-muted">
                        OFFSET EFFECT: Reduces taxable {holding.holdingType === 'ST' ? 'STCG (@20%)' : 'LTCG (@12.5%)'}
                      </span>
                      <button 
                        className="salary-btn-primary" 
                        onClick={() => setConfirmAction({ type: 'loss', holding })}
                        style={{ 
                          background: 'rgba(255, 180, 171, 0.08)',
                          color: 'var(--error)',
                          border: '1px solid rgba(255, 180, 171, 0.2)',
                          padding: '4px 10px',
                          fontSize: '10px',
                          fontFamily: 'var(--font-headline)',
                          letterSpacing: '1.2px',
                          borderRadius: '4px'
                        }}
                      >
                        BOOK_LOSS
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Strategic Valuation Exit Warnings (ROC 18/40) */}
        <div className="glass-surface-elevated" style={{ borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <span className="material-symbols-outlined color-warning" style={{ fontSize: '22px', fontVariationSettings: "'wght' 200" }}>warning</span>
            <div>
              <span className="text-label-mono font-bold">STRATEGIC VALUATION EXIT ALERTS</span>
              <p className="text-label-mono-sm color-muted" style={{ marginTop: '2px' }}>ROCE &lt; 18% & P/E &gt; 40 BUSINESS QUALITY MISMATCH</p>
            </div>
          </div>

          {strategicExits.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: '12px', textAlign: 'center' }}>
              <span className="material-symbols-outlined color-positive" style={{ fontSize: '32px', fontVariationSettings: "'wght' 200" }}>shield</span>
              <span className="text-label-mono color-muted">ALL HOLDINGS FUNDAMENTALLY STRONG</span>
              <span className="text-body-sm color-subtle" style={{ maxWidth: '285px' }}>None of your open stock holdings exhibit the high-valuation, low-moat mismatch.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div style={{ background: 'rgba(255, 186, 63, 0.05)', border: '1px solid rgba(255, 186, 63, 0.15)', borderRadius: '6px', padding: '12px 14px', marginBottom: '4px' }} className="text-body-sm color-subtle">
                <span className="font-semibold" style={{ color: 'var(--secondary-container)' }}>⚠️ The ROC 18 under 40 Principle:</span>
                <p style={{ marginTop: '4px', fontSize: '11.5px', lineHeight: '1.4' }}>
                  A business operating at substandard capital efficiency (<strong className="color-negative">ROCE &lt; 18%</strong>) while priced at premium valuations (<strong className="color-negative">P/E &gt; 40</strong>) represents a high-risk, low-moat situation. Exiting these winning or underperforming assetsBooks profits at a peak premium or locks in tax losses, releasing capital for higher-moat, compound businesses.
                </p>
              </div>

              {strategicExits.map((item) => {
                const { holding, unrealizedPnlPaise } = item;
                const isGain = unrealizedPnlPaise >= 0;
                return (
                  <div 
                    key={holding.id}
                    className="item-card"
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '12px', 
                      alignItems: 'stretch',
                      borderLeft: '4px solid var(--secondary-container)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="text-data-display">{holding.symbol}</span>
                        <span className="salary-pill" style={{ background: 'rgba(255, 180, 171, 0.1)', color: 'var(--error)', padding: '2px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 600, fontFamily: 'var(--font-headline)' }}>
                          SELL MANDATE
                        </span>
                      </div>
                      <div className="text-data-display" style={{ color: isGain ? 'var(--primary-container)' : 'var(--error)' }}>
                        {isGain ? '+' : ''}<CurrencyValue paise={unrealizedPnlPaise} />
                        <span style={{ fontSize: '10px', marginLeft: '6px' }} className="color-muted">({isGain ? 'GAIN' : 'LOSS'})</span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px' }} className="text-label-mono-xs">
                      <div>
                        <span className="color-muted">CURRENT P/E</span>
                        <div className="font-semibold" style={{ color: 'var(--error)', fontSize: '12px', marginTop: '2px' }}>{holding.peRatio} <span className="color-muted" style={{ fontSize: '9px' }}>(Limit: 40)</span></div>
                      </div>
                      <div>
                        <span className="color-muted">CURRENT ROCE</span>
                        <div className="font-semibold" style={{ color: 'var(--error)', fontSize: '12px', marginTop: '2px' }}>{holding.roce}% <span className="color-muted" style={{ fontSize: '9px' }}>(Limit: 18%)</span></div>
                      </div>
                      <div>
                        <span className="color-muted">5Y MEDIAN PE</span>
                        <div className="font-semibold color-subtle" style={{ fontSize: '12px', marginTop: '2px' }}>{holding.medianPE5Y}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
                      <span className="text-label-mono-xs color-muted" style={{ maxWidth: '70%' }}>
                        Recommendation: Exit immediately to recycle capital. {isGain ? 'Books capital gain.' : 'Harvests capital loss.'}
                      </span>
                      <button 
                        className="salary-btn-primary" 
                        onClick={() => setConfirmAction({ type: isGain ? 'profit' : 'loss', holding })}
                        style={{ 
                          background: 'var(--secondary-container)',
                          color: '#000',
                          fontWeight: 600,
                          padding: '4px 10px',
                          fontSize: '10px',
                          fontFamily: 'var(--font-headline)',
                          letterSpacing: '1.2px',
                          borderRadius: '4px'
                        }}
                      >
                        {isGain ? 'BOOK_GAIN' : 'BOOK_LOSS'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Portfolio Holdings Manager */}
      <div className="glass-surface-elevated animate-in" style={{ borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-symbols-outlined color-info" style={{ fontSize: '22px', fontVariationSettings: "'wght' 200" }}>monitoring</span>
            <div>
              <span className="text-label-mono font-bold">PORTFOLIO HOLDINGS MANAGER (DAILY OPEN POSITIONS)</span>
              <p className="text-label-mono-sm color-muted" style={{ marginTop: '2px' }}>LIVE PORTFOLIO POSITION STATS AND VALUATIONS</p>
            </div>
          </div>
          <button 
            className="salary-btn-secondary" 
            onClick={openAddModal}
            style={{ 
              border: '1px solid var(--primary-container)', 
              color: 'var(--primary-container)',
              borderRadius: '6px', 
              padding: '6px 12px', 
              fontSize: '10px', 
              fontFamily: 'var(--font-headline)', 
              letterSpacing: '1px',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
            ADD_NEW_HOLDING
          </button>
        </div>

        {holdings.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: '12px', textAlign: 'center' }}>
            <span className="material-symbols-outlined color-muted" style={{ fontSize: '48px', fontVariationSettings: "'wght' 200" }}>inbox</span>
            <span className="text-label-mono color-muted">NO PORTFOLIO HOLDINGS TRACKED</span>
            <span className="text-body-sm color-subtle">Click "ADD_POSITION" or "RESET_SEEDED_HOLDINGS" to populate your active stock positions.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', minWidth: '800px' }} className="text-body-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }} className="text-label-mono-sm color-muted">
                  <th style={{ textAlign: 'left', padding: '12px 8px' }}>SYMBOL</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px' }}>ASSET CLASS</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px' }}>CLASSIFICATION</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px' }}>QTY</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px' }}>AVG COST</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px' }}>CMP</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px' }}>PE RATIO</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px' }}>ROCE %</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px' }}>UNREALIZED P&amp;L</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const unrealizedPnlPaise = (h.currentMarketPricePaise - h.avgBuyPricePaise) * h.qty;
                  const isGain = unrealizedPnlPaise >= 0;
                  const isViolated = h.roce < 18 && h.peRatio > 40;
                  
                  return (
                    <tr key={h.id} className="glass-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }} className="text-data-display">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {h.symbol}
                          {isViolated && (
                            <span 
                              className="material-symbols-outlined color-warning" 
                              style={{ fontSize: '16px' }}
                              title="Strategic exit warning triggered! PE > 40 and ROCE < 18%."
                            >
                              warning
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span className="text-label-mono-xs color-subtle">{h.assetType.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ 
                          color: h.holdingType === 'ST' ? 'var(--secondary-container)' : '#82ccff',
                          fontFamily: 'var(--font-headline)',
                          fontSize: '10px',
                          fontWeight: 500
                        }}>
                          {h.holdingType === 'ST' ? 'STCG (<12M)' : 'LTCG (>=12M)'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>{h.qty}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        ₹{(h.avgBuyPricePaise / 100).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>
                        ₹{(h.currentMarketPricePaise / 100).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: h.peRatio > 40 ? 'var(--error)' : 'inherit' }}>
                        {h.peRatio} <span className="color-muted" style={{ fontSize: '9px' }}>({h.medianPE5Y})</span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: h.roce < 18 ? 'var(--error)' : 'var(--primary-container)' }}>
                        {h.roce}%
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: isGain ? 'var(--primary-container)' : 'var(--error)' }}>
                        {isGain ? '+' : ''}<CurrencyValue paise={unrealizedPnlPaise} />
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button 
                            className="family-icon-btn" 
                            onClick={() => handleEditClick(h)}
                            style={{ 
                              padding: '5px', 
                              borderRadius: '4px', 
                              border: '1px solid rgba(255,255,255,0.06)',
                              display: 'flex', 
                              alignItems: 'center', 
                              background: 'rgba(255,255,255,0.03)',
                              color: 'rgba(255,255,255,0.6)'
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                          </button>
                          <button 
                            className="family-icon-btn" 
                            onClick={() => {
                              deleteHolding(h.id);
                              triggerNotification(`Holding for ${h.symbol} deleted.`);
                            }}
                            style={{ 
                              padding: '5px', 
                              borderRadius: '4px', 
                              border: '1px solid rgba(255,255,255,0.06)',
                              display: 'flex', 
                              alignItems: 'center', 
                              background: 'rgba(255,255,255,0.03)',
                              color: 'var(--error)'
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. GORGEOUS PREMIUM SANDBOX TRANSACTION CONFIRMATION MODAL */}
      {confirmAction && (
        <div 
          className="salary-modal-overlay" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.85)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1060,
            backdropFilter: 'blur(8px)',
            animation: 'animate-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both'
          }}
          onClick={() => setConfirmAction(null)}
        >
          <div 
            className="glass-surface-elevated salary-modal" 
            style={{ 
              width: '500px', 
              borderRadius: '12px', 
              border: '1px solid rgba(255,255,255,0.12)', 
              overflow: 'hidden', 
              boxShadow: '0 12px 48px rgba(0,0,0,0.6)' 
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="glass-card-header" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-label-mono font-bold" style={{ color: confirmAction.type === 'loss' ? 'var(--error)' : 'var(--primary-container)' }}>
                CONFIRM SIMULATED PORTFOLIO REALIZATION
              </span>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="text-body-sm color-subtle" style={{ fontSize: '13px', lineHeight: '1.5' }}>
                You are executing a mock **portfolio realization** transaction for **{confirmAction.holding.symbol}**.
                {confirmAction.type === 'loss' ? (
                  <p style={{ marginTop: '8px' }}>
                    This will simulate executing a sale of this underwater position, logging a realized capital loss of <strong className="color-negative"><CurrencyValue paise={Math.abs((confirmAction.holding.currentMarketPricePaise - confirmAction.holding.avgBuyPricePaise) * confirmAction.holding.qty)} /></strong> into your transaction history. This loss will be applied to offset matching realized capital gains inside the tax estimator in real-time.
                  </p>
                ) : (
                  <p style={{ marginTop: '8px' }}>
                    This will book the premium gains on this business, logging a realized capital profit of <strong className="color-positive"><CurrencyValue paise={(confirmAction.holding.currentMarketPricePaise - confirmAction.holding.avgBuyPricePaise) * confirmAction.holding.qty} /></strong> into your trade history.
                  </p>
                )}
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }} className="text-label-mono-xs">
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span className="color-muted">INSTRUMENT</span>
                  <span className="font-semibold text-data-display">{confirmAction.holding.symbol}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span className="color-muted">QUANTITY SOLD</span>
                  <span className="font-semibold text-data-display">{confirmAction.holding.qty} Shares</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span className="color-muted">BUY COST BASIS</span>
                  <span className="font-semibold">₹{(confirmAction.holding.avgBuyPricePaise / 100).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span className="color-muted">REALIZATION PRICE (CMP)</span>
                  <span className="font-semibold">₹{(confirmAction.holding.currentMarketPricePaise / 100).toLocaleString('en-IN')}</span>
                </div>
                <hr style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span className="color-muted">SIMULATED BROKERAGE / CHARGES</span>
                  <span className="font-semibold text-label-mono-xs color-positive">₹0.00 (WAIVED)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', alignItems: 'center' }}>
                  <span className="color-muted">EST. OFFSET SAVINGS / GAINS Realized</span>
                  <span className="text-data-display font-bold" style={{ color: confirmAction.type === 'loss' ? 'var(--error)' : 'var(--primary-container)', fontSize: '14px' }}>
                    <CurrencyValue paise={Math.abs((confirmAction.holding.currentMarketPricePaise - confirmAction.holding.avgBuyPricePaise) * confirmAction.holding.qty)} />
                  </span>
                </div>
              </div>
            </div>

            <div className="salary-modal-actions" style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                className="salary-btn-primary" 
                onClick={handleExecuteSimulatedTrade}
                style={{ 
                  background: confirmAction.type === 'loss' ? 'var(--error)' : 'var(--primary-container)', 
                  color: '#000', 
                  fontWeight: 600,
                  borderRadius: '6px',
                  padding: '8px 20px',
                  fontFamily: 'var(--font-headline)',
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}
              >
                CONFIRM_EXECUTE
              </button>
              <button 
                className="salary-btn-secondary" 
                onClick={() => setConfirmAction(null)}
                style={{ 
                  border: '1px solid rgba(255, 255, 255, 0.1)', 
                  borderRadius: '6px',
                  padding: '8px 20px',
                  fontFamily: 'var(--font-headline)',
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ADD HOLDING MODAL FORM OVERLAY */}
      {showAddModal && (
        <div 
          className="salary-modal-overlay" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.8)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1040,
            backdropFilter: 'blur(8px)',
            animation: 'animate-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both'
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="glass-surface-elevated salary-modal" 
            style={{ 
              width: '500px', 
              borderRadius: '12px', 
              border: '1px solid rgba(255,255,255,0.12)', 
              overflow: 'hidden', 
              boxShadow: '0 12px 48px rgba(0,0,0,0.6)' 
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="glass-card-header" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-label-mono font-bold">ADD NEW DAILY PORTFOLIO HOLDING</span>
            </div>

            <form onSubmit={handleAddHoldingSubmit}>
              <div className="salary-modal-body" style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-field" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">SYMBOL / TICKER</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={symbol} 
                    onChange={e => setSymbol(e.target.value)} 
                    placeholder="e.g. TATAMOTORS, RELIANCE, MUTHOOT" 
                    required 
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">ASSET TYPE</label>
                  <select className="form-select" value={assetType} onChange={e => setAssetType(e.target.value as 'equity' | 'mf')}>
                    <option value="equity">EQUITY STOCK</option>
                    <option value="mf">MUTUAL FUND</option>
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label">TAX CLASSIFICATION</label>
                  <select className="form-select" value={holdingType} onChange={e => setHoldingType(e.target.value as 'ST' | 'LT')}>
                    <option value="ST">SHORT TERM (held &lt; 12M)</option>
                    <option value="LT">LONG TERM (held &gt;= 12M)</option>
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label">QUANTITY (SHARES)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={qty} 
                    onChange={e => setQty(Number(e.target.value))} 
                    min="1" 
                    required 
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">AVG BUY PRICE (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-input" 
                    value={avgBuyPriceRupees} 
                    onChange={e => setAvgBuyPriceRupees(Number(e.target.value))} 
                    min="0.01" 
                    required 
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">CURRENT PRICE (CMP) (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-input" 
                    value={currentPriceRupees} 
                    onChange={e => setCurrentPriceRupees(Number(e.target.value))} 
                    min="0.01" 
                    required 
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">TRAILING P/E RATIO</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-input" 
                    value={peRatio} 
                    onChange={e => setPeRatio(Number(e.target.value))} 
                    min="0.01" 
                    required 
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">CURRENT ROCE %</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    className="form-input" 
                    value={roce} 
                    onChange={e => setRoce(Number(e.target.value))} 
                    required 
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">5-YEAR MEDIAN P/E</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-input" 
                    value={medianPE5Y} 
                    onChange={e => setMedianPE5Y(Number(e.target.value))} 
                    min="0.01" 
                    required 
                  />
                </div>
              </div>

              <div className="salary-modal-actions" style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  type="submit" 
                  className="salary-btn-primary" 
                  style={{ 
                    background: 'var(--primary-container)', 
                    color: '#000', 
                    fontWeight: 600,
                    borderRadius: '6px',
                    padding: '8px 20px',
                    fontFamily: 'var(--font-headline)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }}
                >
                  SAVE_HOLDING
                </button>
                <button 
                  type="button" 
                  className="salary-btn-secondary" 
                  onClick={() => setShowAddModal(false)}
                  style={{ 
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '6px',
                    padding: '8px 20px',
                    fontFamily: 'var(--font-headline)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }}
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. EDIT HOLDING MODAL FORM OVERLAY */}
      {showEditModal && editingHolding && (
        <div 
          className="salary-modal-overlay" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.8)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1040,
            backdropFilter: 'blur(8px)',
            animation: 'animate-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both'
          }}
          onClick={() => { setShowEditModal(false); setEditingHolding(null); }}
        >
          <div 
            className="glass-surface-elevated salary-modal" 
            style={{ 
              width: '500px', 
              borderRadius: '12px', 
              border: '1px solid rgba(255,255,255,0.12)', 
              overflow: 'hidden', 
              boxShadow: '0 12px 48px rgba(0,0,0,0.6)' 
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="glass-card-header" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-label-mono font-bold">EDIT PORTFOLIO POSITION: {editingHolding.symbol}</span>
            </div>

            <form onSubmit={handleEditHoldingSubmit}>
              <div className="salary-modal-body" style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-field" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">SYMBOL / TICKER</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={symbol} 
                    onChange={e => setSymbol(e.target.value)} 
                    required 
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">ASSET TYPE</label>
                  <select className="form-select" value={assetType} onChange={e => setAssetType(e.target.value as 'equity' | 'mf')}>
                    <option value="equity">EQUITY STOCK</option>
                    <option value="mf">MUTUAL FUND</option>
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label">TAX CLASSIFICATION</label>
                  <select className="form-select" value={holdingType} onChange={e => setHoldingType(e.target.value as 'ST' | 'LT')}>
                    <option value="ST">SHORT TERM (held &lt; 12M)</option>
                    <option value="LT">LONG TERM (held &gt;= 12M)</option>
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label">QUANTITY (SHARES)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={qty} 
                    onChange={e => setQty(Number(e.target.value))} 
                    min="1" 
                    required 
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">AVG BUY PRICE (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-input" 
                    value={avgBuyPriceRupees} 
                    onChange={e => setAvgBuyPriceRupees(Number(e.target.value))} 
                    min="0.01" 
                    required 
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">CURRENT PRICE (CMP) (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-input" 
                    value={currentPriceRupees} 
                    onChange={e => setCurrentPriceRupees(Number(e.target.value))} 
                    min="0.01" 
                    required 
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">TRAILING P/E RATIO</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-input" 
                    value={peRatio} 
                    onChange={e => setPeRatio(Number(e.target.value))} 
                    min="0.01" 
                    required 
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">CURRENT ROCE %</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    className="form-input" 
                    value={roce} 
                    onChange={e => setRoce(Number(e.target.value))} 
                    required 
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">5-YEAR MEDIAN P/E</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-input" 
                    value={medianPE5Y} 
                    onChange={e => setMedianPE5Y(Number(e.target.value))} 
                    min="0.01" 
                    required 
                  />
                </div>
              </div>

              <div className="salary-modal-actions" style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  type="submit" 
                  className="salary-btn-primary" 
                  style={{ 
                    background: 'var(--primary-container)', 
                    color: '#000', 
                    fontWeight: 600,
                    borderRadius: '6px',
                    padding: '8px 20px',
                    fontFamily: 'var(--font-headline)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }}
                >
                  SAVE_CHANGES
                </button>
                <button 
                  type="button" 
                  className="salary-btn-secondary" 
                  onClick={() => { setShowEditModal(false); setEditingHolding(null); }}
                  style={{ 
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '6px',
                    padding: '8px 20px',
                    fontFamily: 'var(--font-headline)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }}
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

