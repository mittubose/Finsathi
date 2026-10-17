import { useState, useMemo } from 'react';
import { useAppStore } from '../../../shared/hooks/useAppStore';
import { formatINRMasked } from '../../../shared/lib/currency';
import {
  computeScheduleBP,
  generatePortalFieldMappings,
  type ITR3TradeInput,
  type AssetType,
} from '../itr3Engine';
import { InfoTooltip } from '../../../shared/ui/InfoTooltip';
import './schedules.css';

function fmt(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function toITR3TradeInput(trade: ReturnType<typeof useAppStore.getState>['tradeItems'][number]): ITR3TradeInput {
  const assetType: AssetType = trade.assetType === 'mf' ? 'equity_mf' : trade.assetType as AssetType;
  return {
    id: trade.id,
    instrument: trade.instrument,
    assetType,
    subType: trade.subType,
    buyDate: trade.buyDate,
    sellDate: trade.sellDate,
    qty: trade.qty,
    buyPricePaise: trade.buyPricePaise,
    sellPricePaise: trade.sellPricePaise,
    chargesPaise: trade.chargesPaise,
    sttPaidPaise: trade.sttPaidPaise,
  };
}

export function ScheduleBP() {
  const tradeItems = useAppStore(s => s.tradeItems);
  const itr3Data = useAppStore(s => s.itr3Data);
  const currentFY = useAppStore(s => s.currentFY);
  const privacyMode = useAppStore(s => s.privacyMode);
  
  const addBusinessExpense = useAppStore(s => s.addBusinessExpense);
  const deleteBusinessExpense = useAppStore(s => s.deleteBusinessExpense);

  const [newExpense, setNewExpense] = useState({ category: 'other' as const, label: '', amount: '' });

  const fyTrades = useMemo(() => {
    const fyStart = parseInt(currentFY.split('-')[0]);
    const start = new Date(fyStart, 3, 1);
    const end = new Date(fyStart + 1, 2, 31);
    return tradeItems
      .filter(t => {
        const sellDate = new Date(t.sellDate);
        return sellDate >= start && sellDate <= end;
      })
      .map(toITR3TradeInput);
  }, [tradeItems, currentFY]);

  const scheduleBP = useMemo(() => computeScheduleBP(fyTrades, itr3Data.businessExpenses), [fyTrades, itr3Data.businessExpenses]);

  const portalMappings = useMemo(() => {
    return generatePortalFieldMappings({
      assessmentYear: '',
      financialYear: currentFY,
      filingSection: '139(1)',
      form10IEA: { filed: false, regime: 'new' },
      scheduleCG: { preSplit: {} as any, postSplit: {} as any, assumptions: [], tradeResults: [] } as any,
      scheduleBP,
      scheduleHP: { totalIncomePaise: 0 } as any,
      scheduleOS: { totalIncomePaise: 0 } as any,
      scheduleVIA: { totalAllowedPaise: 0 } as any,
      totalIncomePaise: 0,
      totalTaxPaise: 0,
      totalTDSPaise: 0,
      balanceTaxPaise: 0,
    }).filter(m => m.scheduleName === 'Schedule BP');
  }, [scheduleBP, currentFY]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = Math.floor(parseFloat(newExpense.amount) * 100);
    if (!newExpense.label || isNaN(amountPaise) || amountPaise <= 0) return;

    addBusinessExpense({
      id: crypto.randomUUID(),
      category: newExpense.category,
      label: newExpense.label,
      amountPaise,
    });
    setNewExpense({ category: 'other', label: '', amount: '' });
  };

  return (
    <div className="schedule-page">
      <div className="schedule-header">
        <div>
          <h1 className="schedule-page-title">SCHEDULE BP</h1>
          <div className="schedule-page-subtitle">Business and Profession (F&O / Intraday)</div>
        </div>
        <div className="wizard-fy-badge">FY {currentFY}</div>
      </div>

      {scheduleBP.isAuditRequired && (
        <div className="audit-warning">
          <span className="material-symbols-outlined" aria-hidden="true">warning</span>
          <strong>TAX AUDIT REQUIRED (Sec 44AB):</strong> {scheduleBP.auditReason}
        </div>
      )}

      <div className="schedule-section">
        <div className="schedule-section-title">TURNOVER COMPUTATION</div>
        <div className="schedule-grid">
          <div className="schedule-field-row">
            <span className="schedule-field-label">
              F&O TURNOVER (Absolute Sum)
              <InfoTooltip 
                title="F&O Turnover" 
                description="Calculated as the absolute sum of positive and negative differences (profits and losses) from all Futures & Options trades."
                example="If Trade 1 profit = ₹10k and Trade 2 loss = -₹5k, Turnover = 10k + 5k = ₹15,000."
              />
            </span>
            <span className="schedule-field-value">{formatINRMasked(scheduleBP.fnoTurnoverPaise, privacyMode)}</span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">
              INTRADAY TURNOVER (Absolute Sum)
              <InfoTooltip 
                title="Intraday Turnover" 
                description="Calculated as the absolute sum of positive and negative differences from all intraday equity trades."
              />
            </span>
            <span className="schedule-field-value">{formatINRMasked(scheduleBP.intradayTurnoverPaise, privacyMode)}</span>
          </div>
          <div className="schedule-summary-row" style={{ marginTop: '16px', gridColumn: '1 / -1' }}>
            <span className="schedule-field-label">TOTAL BUSINESS TURNOVER</span>
            <span className="schedule-field-value" style={{ fontSize: '24px' }}>
              {formatINRMasked(scheduleBP.totalTurnoverPaise, privacyMode)}
            </span>
          </div>
        </div>
      </div>

      <div className="schedule-section">
        <div className="schedule-section-title">TRADING P&L</div>
        <div className="schedule-grid">
          <div className="schedule-field-row">
            <span className="schedule-field-label">
              F&O INCOME (Profit side)
              <InfoTooltip 
                title="F&O Profit" 
                description="Sum of all profitable F&O trades before deducting expenses."
              />
            </span>
            <span className="schedule-field-value" style={{ color: '#00ff41' }}>{formatINRMasked(scheduleBP.fnoIncomePaise, privacyMode)}</span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">
              F&O LOSS (Loss side)
              <InfoTooltip 
                title="F&O Loss" 
                description="Sum of all loss-making F&O trades."
              />
            </span>
            <span className="schedule-field-value" style={{ color: '#ffb4ab' }}>{formatINRMasked(scheduleBP.fnoLossPaise, privacyMode)}</span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">
              SPECULATIVE INCOME
              <InfoTooltip 
                title="Speculative Profit" 
                description="Profits from intraday equity trading. Speculative business is treated separately from normal business under IT Act."
              />
            </span>
            <span className="schedule-field-value" style={{ color: '#00ff41' }}>{formatINRMasked(scheduleBP.speculativeIncomePaise, privacyMode)}</span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">
              SPECULATIVE LOSS
              <InfoTooltip 
                title="Speculative Loss" 
                description="Losses from intraday equity. Important: Speculative losses can only be set off against speculative profits, NOT against F&O or Salary."
              />
            </span>
            <span className="schedule-field-value" style={{ color: '#ffb4ab' }}>{formatINRMasked(scheduleBP.speculativeLossPaise, privacyMode)}</span>
          </div>
        </div>
      </div>

      <div className="schedule-section">
        <div className="schedule-section-title" style={{ display: 'flex', alignItems: 'center' }}>
          BUSINESS EXPENSES
          <InfoTooltip 
            title="Business Expenses" 
            description="Expenses wholly and exclusively incurred for the purpose of trading business (e.g., brokerage, trading software, internet, depreciation on laptop)."
            example="If you paid ₹5,000 for a TradingView subscription, add it here under 'Software/Data'."
          />
        </div>
        
        {itr3Data.businessExpenses.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            {itr3Data.businessExpenses.map(expense => (
              <div key={expense.id} className="portal-mapping-item">
                <div>
                  <span className="asset-badge" style={{ marginRight: '8px' }}>{expense.category}</span>
                  <span className="schedule-field-label" style={{ display: 'inline' }}>{expense.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="schedule-field-value">{formatINRMasked(expense.amountPaise, privacyMode)}</span>
                  <button className="field-copy-btn" onClick={() => deleteBusinessExpense(expense.id)}>
                    <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', color: '#ffb4ab' }}>delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddExpense} className="schedule-grid" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', gap: '8px', gridColumn: '1 / -1' }}>
            <select 
              className="wizard-select" 
              value={newExpense.category} 
              onChange={e => setNewExpense({...newExpense, category: e.target.value as any})}
            >
              <option value="brokerage">Brokerage</option>
              <option value="software">Software/Data</option>
              <option value="internet">Internet</option>
              <option value="advisory">Advisory/Fees</option>
              <option value="depreciation">Depreciation</option>
              <option value="office">Office Exp</option>
              <option value="other">Other</option>
            </select>
            <input 
              type="text" 
              className="wizard-select" 
              style={{ flex: 1 }} 
              placeholder="Expense Description" 
              value={newExpense.label}
              onChange={e => setNewExpense({...newExpense, label: e.target.value})}
            />
            <input 
              type="number" 
              className="wizard-select" 
              style={{ width: '120px' }} 
              placeholder="Amount (₹)" 
              value={newExpense.amount}
              onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
            />
            <button type="submit" className="wizard-nav-btn primary" style={{ padding: '8px 16px' }}>Add</button>
          </div>
        </form>
      </div>

      <div className="schedule-summary">
        <div className="schedule-summary-row">
          <span className="schedule-field-label">NET BUSINESS INCOME (F&O / Non-Speculative)</span>
          <span className="schedule-field-value" style={{ color: scheduleBP.netFnoPaise >= 0 ? '#00ff41' : '#ffb4ab' }}>
            {formatINRMasked(scheduleBP.netFnoPaise, privacyMode)}
          </span>
        </div>
        <div className="schedule-summary-row">
          <span className="schedule-field-label">NET SPECULATIVE INCOME (Intraday)</span>
          <span className="schedule-field-value" style={{ color: scheduleBP.netSpeculativePaise >= 0 ? '#00ff41' : '#ffb4ab' }}>
            {formatINRMasked(scheduleBP.netSpeculativePaise, privacyMode)}
          </span>
        </div>
        <div className="schedule-summary-row">
          <span className="schedule-field-label">TOTAL BUSINESS EXPENSES</span>
          <span className="schedule-field-value" style={{ color: '#ffb211' }}>
            - {formatINRMasked(scheduleBP.totalExpensesPaise, privacyMode)}
          </span>
        </div>
        <div className="schedule-summary-row" style={{ borderTop: '1px solid var(--sch-border)', paddingTop: '16px' }}>
          <span className="schedule-field-label">TOTAL BUSINESS & PROFESSION INCOME</span>
          <span className="schedule-field-value" style={{ color: scheduleBP.netBusinessIncomePaise >= 0 ? '#00ff41' : '#ffb4ab', fontSize: '24px' }}>
            {formatINRMasked(scheduleBP.netBusinessIncomePaise, privacyMode)}
          </span>
        </div>
      </div>

      {portalMappings.length > 0 && (
        <div className="portal-mapping" style={{ marginTop: '24px' }}>
          <div className="portal-mapping-title">
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '18px' }}>content_copy</span>
            PORTAL FIELD MAPPING
          </div>
          {portalMappings.map((m, i) => (
            <div key={i} className="portal-mapping-item">
              <div>
                <div className="schedule-field-label">{m.fieldLabel}</div>
                <div className="schedule-field-portal" style={{ marginTop: '4px' }}>
                  Portal: {m.portalFieldName}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="schedule-field-value">
                  {privacyMode ? '₹ •••••' : m.displayValue}
                </span>
                <button
                  className="field-copy-btn"
                  onClick={() => copyToClipboard(String(m.value / 100))}
                  title="Copy value"
                >
                  <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px' }}>content_copy</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="assumption-list">
        <div className="schedule-section-title">NOTES & ASSUMPTIONS</div>
        {scheduleBP.assumptions.map((a, i) => (
          <div key={i} className="assumption-item">
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>circle</span>
            {a}
          </div>
        ))}
      </div>
    </div>
  );
}
