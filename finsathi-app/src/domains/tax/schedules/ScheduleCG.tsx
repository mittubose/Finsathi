import { useState, useMemo } from 'react';
import { useAppStore } from '../../../shared/hooks/useAppStore';
import {
  computeScheduleCG,
  generatePortalFieldMappings,
  type ITR3TradeInput,
  type AssetType,
  type DateSplitGains
} from '../itr3Engine';
import { InfoTooltip } from '../../../shared/ui/InfoTooltip';
import { formatINRMasked } from '../../../shared/lib/currency';
import './schedules.css';

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

export function ScheduleCG() {
  const tradeItems = useAppStore(s => s.tradeItems);
  const currentFY = useAppStore(s => s.currentFY);
  const privacyMode = useAppStore(s => s.privacyMode);

  const [period, setPeriod] = useState<'combined' | 'pre' | 'post'>('combined');

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

  const scheduleCG = useMemo(() => computeScheduleCG(fyTrades), [fyTrades]);

  // For portal mappings we need the full ITR3FilingData, but since we are just in CG, 
  // we'll simulate the data structure to get CG mappings.
  const portalMappings = useMemo(() => {
    return generatePortalFieldMappings({
      assessmentYear: '',
      financialYear: currentFY,
      filingSection: '139(1)',
      form10IEA: { filed: false, regime: 'new' },
      scheduleCG,
      scheduleBP: { totalTurnoverPaise: 0, fnoTradeCount: 0, intradayTradeCount: 0 } as any,
      scheduleHP: { totalIncomePaise: 0 } as any,
      scheduleOS: { totalIncomePaise: 0 } as any,
      scheduleVIA: { totalAllowedPaise: 0 } as any,
      totalIncomePaise: 0,
      totalTaxPaise: 0,
      totalTDSPaise: 0,
      balanceTaxPaise: 0,
    }).filter(m => m.scheduleName === 'Schedule CG');
  }, [scheduleCG, currentFY]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const renderAssetCard = (title: string, gains: { stcgPaise: number, ltcgPaise: number, stclPaise: number, ltclPaise: number, stcgTaxPaise: number, ltcgTaxPaise: number, tradeCount: number }, assetClass: string) => {
    if (gains.tradeCount === 0) return null;
    return (
      <div className="schedule-card" key={title}>
        <div className="schedule-card-header">
          <span className={`asset-badge ${assetClass}`}>{title}</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>
            {gains.tradeCount} trades
          </span>
        </div>
        <div className="schedule-card-body">
          <div className="schedule-grid">
            <div className="schedule-field-row">
              <span className="schedule-field-label">
                STCG
                <InfoTooltip 
                  title="Short Term Capital Gains" 
                  description="Profits from assets sold before holding them for long-term duration (e.g. < 1 year for listed equity, < 3 years for debt)."
                />
              </span>
              <span className="schedule-field-value" style={{ color: gains.stcgPaise > 0 ? '#00ff41' : 'inherit' }}>
                {formatINRMasked(gains.stcgPaise, privacyMode)}
              </span>
            </div>
            <div className="schedule-field-row">
              <span className="schedule-field-label">
                LTCG
                <InfoTooltip 
                  title="Long Term Capital Gains" 
                  description="Profits from assets held for long-term duration (e.g. > 1 year for listed equity)."
                  example="Listed equity LTCG enjoys ₹1.25L exemption (₹1L pre-budget)."
                />
              </span>
              <span className="schedule-field-value" style={{ color: gains.ltcgPaise > 0 ? '#00ff41' : 'inherit' }}>
                {formatINRMasked(gains.ltcgPaise, privacyMode)}
              </span>
            </div>
            <div className="schedule-field-row">
              <span className="schedule-field-label">
                STCL (Loss)
                <InfoTooltip 
                  title="Short Term Capital Loss" 
                  description="Losses from short-term assets. STCL can be set off against both STCG and LTCG."
                />
              </span>
              <span className="schedule-field-value" style={{ color: gains.stclPaise > 0 ? '#ffb4ab' : 'inherit' }}>
                {formatINRMasked(gains.stclPaise, privacyMode)}
              </span>
            </div>
            <div className="schedule-field-row">
              <span className="schedule-field-label">
                LTCL (Loss)
                <InfoTooltip 
                  title="Long Term Capital Loss" 
                  description="Losses from long-term assets. LTCL can ONLY be set off against LTCG (not STCG)."
                />
              </span>
              <span className="schedule-field-value" style={{ color: gains.ltclPaise > 0 ? '#ffb4ab' : 'inherit' }}>
                {formatINRMasked(gains.ltclPaise, privacyMode)}
              </span>
            </div>
          </div>
          <div className="schedule-summary-row" style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
            <span className="schedule-field-label">TAX LIABILITY</span>
            <span className="schedule-field-value">
              {formatINRMasked(gains.stcgTaxPaise + gains.ltcgTaxPaise, privacyMode)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const getCombinedGains = (pre: DateSplitGains, post: DateSplitGains, asset: keyof DateSplitGains) => {
    return {
      stcgPaise: pre[asset].stcgPaise + post[asset].stcgPaise,
      ltcgPaise: pre[asset].ltcgPaise + post[asset].ltcgPaise,
      stclPaise: pre[asset].stclPaise + post[asset].stclPaise,
      ltclPaise: pre[asset].ltclPaise + post[asset].ltclPaise,
      stcgTaxPaise: pre[asset].stcgTaxPaise + post[asset].stcgTaxPaise,
      ltcgTaxPaise: pre[asset].ltcgTaxPaise + post[asset].ltcgTaxPaise,
      tradeCount: pre[asset].tradeCount + post[asset].tradeCount,
    };
  };

  return (
    <div className="schedule-page">
      <div className="schedule-header">
        <div>
          <h1 className="schedule-page-title">SCHEDULE CG</h1>
          <div className="schedule-page-subtitle">Capital Gains</div>
        </div>
        <div className="wizard-fy-badge">FY {currentFY}</div>
      </div>

      <div className="date-split-toggle">
        <button className={period === 'combined' ? 'active' : ''} onClick={() => setPeriod('combined')}>Combined</button>
        <button className={period === 'pre' ? 'active' : ''} onClick={() => setPeriod('pre')}>Before 23 July</button>
        <button className={period === 'post' ? 'active' : ''} onClick={() => setPeriod('post')}>On/After 23 July</button>
      </div>

      <div className="schedule-section">
        {period === 'pre' && (
          <>
            {renderAssetCard('Listed Equity', scheduleCG.preSplit.equity, 'equity')}
            {renderAssetCard('Equity Mutual Funds', scheduleCG.preSplit.equity_mf, 'equity_mf')}
            {renderAssetCard('Debt Mutual Funds', scheduleCG.preSplit.debt_mf, 'debt_mf')}
            {renderAssetCard('Virtual Digital Assets', scheduleCG.preSplit.vda, 'vda')}
            {renderAssetCard('Other Assets', scheduleCG.preSplit.other, 'other')}
          </>
        )}
        {period === 'post' && (
          <>
            {renderAssetCard('Listed Equity', scheduleCG.postSplit.equity, 'equity')}
            {renderAssetCard('Equity Mutual Funds', scheduleCG.postSplit.equity_mf, 'equity_mf')}
            {renderAssetCard('Debt Mutual Funds', scheduleCG.postSplit.debt_mf, 'debt_mf')}
            {renderAssetCard('Virtual Digital Assets', scheduleCG.postSplit.vda, 'vda')}
            {renderAssetCard('Other Assets', scheduleCG.postSplit.other, 'other')}
          </>
        )}
        {period === 'combined' && (
          <>
            {renderAssetCard('Listed Equity', getCombinedGains(scheduleCG.preSplit, scheduleCG.postSplit, 'equity'), 'equity')}
            {renderAssetCard('Equity Mutual Funds', getCombinedGains(scheduleCG.preSplit, scheduleCG.postSplit, 'equity_mf'), 'equity_mf')}
            {renderAssetCard('Debt Mutual Funds', getCombinedGains(scheduleCG.preSplit, scheduleCG.postSplit, 'debt_mf'), 'debt_mf')}
            {renderAssetCard('Virtual Digital Assets', getCombinedGains(scheduleCG.preSplit, scheduleCG.postSplit, 'vda'), 'vda')}
            {renderAssetCard('Other Assets', getCombinedGains(scheduleCG.preSplit, scheduleCG.postSplit, 'other'), 'other')}
          </>
        )}
      </div>

      <div className="schedule-section">
        <div className="schedule-section-title">SET-OFF & NET GAINS</div>
        <div className="schedule-grid">
          <div className="schedule-field-row">
            <span className="schedule-field-label">
              NET STCG (After Set-off)
              <InfoTooltip 
                title="Net STCG" 
                description="Final Short Term Capital Gains after adjusting intra-head short-term losses."
              />
            </span>
            <span className="schedule-field-value">{formatINRMasked(scheduleCG.netSTCGPaise, privacyMode)}</span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">
              NET LTCG (After Set-off)
              <InfoTooltip 
                title="Net LTCG" 
                description="Final Long Term Capital Gains after adjusting long-term losses. This is before applying the ₹1.25L exemption which happens in the final tax computation."
              />
            </span>
            <span className="schedule-field-value">{formatINRMasked(scheduleCG.netLTCGPaise, privacyMode)}</span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">TOTAL CG TAX</span>
            <span className="schedule-field-value" style={{ color: '#00ff41' }}>
              {formatINRMasked(scheduleCG.netCGTaxPaise, privacyMode)}
            </span>
          </div>
        </div>
      </div>

      {portalMappings.length > 0 && (
        <div className="portal-mapping">
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
        {scheduleCG.assumptions.map((a, i) => (
          <div key={i} className="assumption-item">
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>circle</span>
            {a}
          </div>
        ))}
      </div>
    </div>
  );
}
