import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../../shared/hooks/useAppStore';
import { computeBookkeeping } from '../itr3Engine';
import { formatINRMasked } from '../../../shared/lib/currency';
import './schedules.css';

export const ScheduleBookkeeping: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'trading' | 'pl' | 'capital' | 'bs'>('trading');
  
  const tradeItems = useAppStore((state: any) => state.tradeItems);
  const incomeItems = useAppStore((state: any) => state.incomeItems);
  const expenses = useAppStore((state: any) => state.itr3Data.businessExpenses);
  const bookkeepingData = useAppStore((state: any) => state.itr3Data.bookkeepingData);
  const updateBookkeepingData = useAppStore((state: any) => state.updateBookkeepingData);
  const privacyMode = useAppStore((state: any) => state.privacyMode);

  const bk = useMemo(() => {
    // Map TradeItem to ITR3TradeInput
    const mappedTrades = tradeItems.map((t: any) => ({
      tradeId: t.id,
      assetType: t.assetType === 'mf' ? 'equity_mf' : t.assetType as any,
      subType: t.subType,
      buyDate: t.buyDate,
      sellDate: t.sellDate || '',
      qty: t.qty,
      buyPricePaise: t.buyPricePaise,
      sellPricePaise: t.sellPricePaise || 0,
      chargesPaise: t.chargesPaise || 0,
    }));
    return computeBookkeeping(mappedTrades, incomeItems, expenses, bookkeepingData);
  }, [tradeItems, incomeItems, expenses, bookkeepingData]);

  const handleUpdate = (field: keyof typeof bookkeepingData, valueStr: string) => {
    const val = valueStr.replace(/[^0-9-]/g, '');
    const num = parseInt(val || '0', 10);
    updateBookkeepingData({ [field]: num * 100 }); // convert to paise
  };

  const renderTrading = () => (
    <div className="schedule-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      <div>
        <h4 className="schedule-section-title">Dr. (Purchases & Expenses)</h4>
        
        <div className="schedule-card" style={{ marginBottom: '16px' }}>
          <div className="schedule-card-header">
            <span className="material-symbols-outlined">trending_down</span>
            <h3>Intraday Trading</h3>
          </div>
          <div className="schedule-card-body">
            <div className="schedule-field-row">
              <span className="schedule-field-label">Purchases</span>
              <span className="schedule-field-value">{formatINRMasked(bk.intradayPurchasesPaise, privacyMode)}</span>
            </div>
            <div className="schedule-field-row">
              <span className="schedule-field-label">Charges</span>
              <span className="schedule-field-value">{formatINRMasked(bk.intradayChargesPaise, privacyMode)}</span>
            </div>
            <div className="schedule-summary-row" style={{ marginTop: '16px', color: '#00ff41' }}>
              <span>Gross Profit (Intraday)</span>
              <span>{formatINRMasked(bk.intradayGrossProfitPaise, privacyMode)}</span>
            </div>
          </div>
        </div>

        <div className="schedule-card">
          <div className="schedule-card-header">
            <span className="material-symbols-outlined">monitoring</span>
            <h3>F&O Trading</h3>
          </div>
          <div className="schedule-card-body">
            <div className="schedule-field-row">
              <span className="schedule-field-label">Purchases</span>
              <span className="schedule-field-value">{formatINRMasked(bk.fnoPurchasesPaise, privacyMode)}</span>
            </div>
            <div className="schedule-field-row">
              <span className="schedule-field-label">Charges</span>
              <span className="schedule-field-value">{formatINRMasked(bk.fnoChargesPaise, privacyMode)}</span>
            </div>
            <div className="schedule-summary-row" style={{ marginTop: '16px', color: '#00ff41' }}>
              <span>Gross Profit (F&O)</span>
              <span>{formatINRMasked(bk.fnoGrossProfitPaise, privacyMode)}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <h4 className="schedule-section-title">Cr. (Sales / Turnover)</h4>
        
        <div className="schedule-card" style={{ marginBottom: '16px' }}>
          <div className="schedule-card-header">
            <span className="material-symbols-outlined">trending_up</span>
            <h3>Intraday Trading</h3>
          </div>
          <div className="schedule-card-body">
            <div className="schedule-field-row">
              <span className="schedule-field-label">Sales Turnover</span>
              <span className="schedule-field-value">{formatINRMasked(bk.intradaySalesPaise, privacyMode)}</span>
            </div>
          </div>
        </div>

        <div className="schedule-card">
          <div className="schedule-card-header">
            <span className="material-symbols-outlined">analytics</span>
            <h3>F&O Trading</h3>
          </div>
          <div className="schedule-card-body">
            <div className="schedule-field-row">
              <span className="schedule-field-label">Sales Turnover</span>
              <span className="schedule-field-value">{formatINRMasked(bk.fnoSalesPaise, privacyMode)}</span>
            </div>
          </div>
        </div>

        <div className="schedule-card" style={{ marginTop: '24px', borderColor: '#00ff41' }}>
          <div className="schedule-card-body">
            <div className="schedule-summary-row" style={{ color: '#00ff41' }}>
              <span>Total Gross Profit c/d</span>
              <span>{formatINRMasked(bk.totalGrossProfitPaise, privacyMode)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPL = () => (
    <div className="schedule-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      <div>
        <h4 className="schedule-section-title">Dr. (Indirect Expenses)</h4>
        <div className="schedule-card">
          <div className="schedule-card-body">
            <div className="schedule-field-row">
              <span className="schedule-field-label">Business Expenses</span>
              <span className="schedule-field-value">{formatINRMasked(bk.indirectExpensesPaise, privacyMode)}</span>
            </div>
            
            <div className="schedule-summary-row" style={{ marginTop: '32px', color: '#ffb211' }}>
              <span>Net Profit (transferred to Capital)</span>
              <span>{formatINRMasked(bk.netProfitPaise, privacyMode)}</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="schedule-section-title">Cr. (Gross Profit & Other Income)</h4>
        <div className="schedule-card">
          <div className="schedule-card-body">
            <div className="schedule-field-row">
              <span className="schedule-field-label">Gross Profit b/d</span>
              <span className="schedule-field-value">{formatINRMasked(bk.totalGrossProfitPaise, privacyMode)}</span>
            </div>
            <div className="schedule-field-row">
              <span className="schedule-field-label">Other Income (Dividend, Interest)</span>
              <span className="schedule-field-value">{formatINRMasked(bk.otherIncomePaise, privacyMode)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCapital = () => (
    <div className="schedule-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      <div>
        <h4 className="schedule-section-title">Dr. (Drawings & Reductions)</h4>
        <div className="schedule-card">
          <div className="schedule-card-body">
            <div className="schedule-field-row">
              <span className="schedule-field-label">Drawings (Personal Withdrawals)</span>
              <input 
                type="text" 
                value={Math.round(bk.drawingsPaise / 100)} 
                onChange={(e) => handleUpdate('drawingsPaise', e.target.value)}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '4px 8px', borderRadius: '4px', textAlign: 'right', width: '120px' }}
              />
            </div>
            <div className="schedule-summary-row" style={{ marginTop: '32px', color: '#00ff41' }}>
              <span>Closing Balance c/d</span>
              <span>{formatINRMasked(bk.closingCapitalPaise, privacyMode)}</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="schedule-section-title">Cr. (Capital & Additions)</h4>
        <div className="schedule-card">
          <div className="schedule-card-body">
            <div className="schedule-field-row">
              <span className="schedule-field-label">Opening Capital b/d</span>
              <input 
                type="text" 
                value={Math.round(bk.openingCapitalPaise / 100)} 
                onChange={(e) => handleUpdate('openingCapitalPaise', e.target.value)}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '4px 8px', borderRadius: '4px', textAlign: 'right', width: '120px' }}
              />
            </div>
            <div className="schedule-field-row">
              <span className="schedule-field-label">Net Profit for the year</span>
              <span className="schedule-field-value">{formatINRMasked(bk.netProfitPaise, privacyMode)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBS = () => (
    <div>
      <div className="schedule-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h4 className="schedule-section-title">Liabilities</h4>
          <div className="schedule-card">
            <div className="schedule-card-body">
              <div className="schedule-field-row">
                <span className="schedule-field-label">Capital Account</span>
                <span className="schedule-field-value">{formatINRMasked(bk.liabilities.capitalAccountPaise, privacyMode)}</span>
              </div>
              <div className="schedule-field-row">
                <span className="schedule-field-label">Loans / Borrowings</span>
                <input 
                  type="text" 
                  value={Math.round(bookkeepingData.loansPaise / 100)} 
                  onChange={(e) => handleUpdate('loansPaise', e.target.value)}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '4px 8px', borderRadius: '4px', textAlign: 'right', width: '120px' }}
                />
              </div>
            </div>
            <div className="schedule-summary">
              <div className="schedule-summary-row">
                <span>Total Liabilities</span>
                <span>{formatINRMasked(bk.liabilities.totalLiabilitiesPaise, privacyMode)}</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="schedule-section-title">Assets</h4>
          <div className="schedule-card">
            <div className="schedule-card-body">
              <div className="schedule-field-row">
                <span className="schedule-field-label">Fixed Assets (Laptop, etc.)</span>
                <input 
                  type="text" 
                  value={Math.round(bookkeepingData.fixedAssetsPaise / 100)} 
                  onChange={(e) => handleUpdate('fixedAssetsPaise', e.target.value)}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '4px 8px', borderRadius: '4px', textAlign: 'right', width: '120px' }}
                />
              </div>
              <div className="schedule-field-row">
                <span className="schedule-field-label">Investments (Delivery Holdings)</span>
                <span className="schedule-field-value">{formatINRMasked(bk.assets.investmentsPaise, privacyMode)}</span>
              </div>
              <div className="schedule-field-row">
                <span className="schedule-field-label">Bank Balance</span>
                <input 
                  type="text" 
                  value={Math.round(bookkeepingData.bankBalancePaise / 100)} 
                  onChange={(e) => handleUpdate('bankBalancePaise', e.target.value)}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '4px 8px', borderRadius: '4px', textAlign: 'right', width: '120px' }}
                />
              </div>
              <div className="schedule-field-row">
                <span className="schedule-field-label">Broker Balance</span>
                <input 
                  type="text" 
                  value={Math.round(bookkeepingData.brokerBalancePaise / 100)} 
                  onChange={(e) => handleUpdate('brokerBalancePaise', e.target.value)}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '4px 8px', borderRadius: '4px', textAlign: 'right', width: '120px' }}
                />
              </div>
              <div className="schedule-field-row">
                <span className="schedule-field-label">Cash in Hand</span>
                <input 
                  type="text" 
                  value={Math.round(bookkeepingData.cashBalancePaise / 100)} 
                  onChange={(e) => handleUpdate('cashBalancePaise', e.target.value)}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '4px 8px', borderRadius: '4px', textAlign: 'right', width: '120px' }}
                />
              </div>
            </div>
            <div className="schedule-summary">
              <div className="schedule-summary-row">
                <span>Total Assets</span>
                <span>{formatINRMasked(bk.assets.totalAssetsPaise, privacyMode)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '24px', padding: '16px', borderRadius: '8px', border: `1px solid ${bk.isBalanced ? '#00ff41' : '#ffb4ab'}`, background: bk.isBalanced ? 'rgba(0, 255, 65, 0.05)' : 'rgba(255, 180, 171, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: bk.isBalanced ? '#00ff41' : '#ffb4ab' }}>
            <span className="material-symbols-outlined">{bk.isBalanced ? 'check_circle' : 'warning'}</span>
            <span style={{ fontWeight: 600, fontSize: '1.1em' }}>
              {bk.isBalanced ? 'Balance Sheet is Balanced' : 'Balance Sheet does not match'}
            </span>
          </div>
          {!bk.isBalanced && (
            <div style={{ color: '#ffb4ab', fontSize: '14px' }}>
              Difference (Suspense A/c): <strong>{formatINRMasked(Math.abs(bk.imbalancePaise), privacyMode)}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="schedule-page">
      <div className="schedule-header">
        <div>
          <h2>Bookkeeping & Balance Sheet</h2>
          <div className="schedule-subtitle" style={{ color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>T-Format Accounts (ITR-3 Part A - BS & P&L)</div>
        </div>
        <div className="completion-badge" style={{ color: bk.isBalanced ? '#00ff41' : '#ffb211' }}>
          {bk.isBalanced ? '✅ Balanced' : '⚠️ Pending'}
        </div>
      </div>

      <div className="schedule-tabs" style={{ marginBottom: '24px' }}>
        <button className={activeTab === 'trading' ? 'active' : ''} onClick={() => setActiveTab('trading')}>Trading A/c</button>
        <button className={activeTab === 'pl' ? 'active' : ''} onClick={() => setActiveTab('pl')}>P&L A/c</button>
        <button className={activeTab === 'capital' ? 'active' : ''} onClick={() => setActiveTab('capital')}>Capital A/c</button>
        <button className={activeTab === 'bs' ? 'active' : ''} onClick={() => setActiveTab('bs')}>Balance Sheet</button>
      </div>

      {activeTab === 'trading' && renderTrading()}
      {activeTab === 'pl' && renderPL()}
      {activeTab === 'capital' && renderCapital()}
      {activeTab === 'bs' && renderBS()}
    </div>
  );
};
