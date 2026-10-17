import { useAppStore } from '../hooks/useAppStore';
import { formatINR } from '../lib/currency';
import { useNavigate } from 'react-router-dom';

export function TradesWidget() {
  const navigate = useNavigate();
  const { tradeItems } = useAppStore();

  const totalPnL = tradeItems.reduce((acc, t) => acc + t.realizedPnlPaise, 0);
  const stcg = tradeItems.filter(t => t.classification === 'STCG').reduce((acc, t) => acc + t.realizedPnlPaise, 0);
  const ltcg = tradeItems.filter(t => t.classification === 'LTCG').reduce((acc, t) => acc + t.realizedPnlPaise, 0);

  return (
    <div className="trades-widget-content">
      <div className="widget-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginBottom: '12px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-label-mono-sm color-muted">REALIZED_PNL</span>
          <div className={`text-data-display ${totalPnL >= 0 ? 'color-positive' : 'color-negative'}`} style={{ fontSize: '16px', marginTop: '4px' }}>
            {totalPnL >= 0 ? '+' : ''}{formatINR(totalPnL)}
          </div>
          <span className="text-label-mono-xs color-muted">{tradeItems.length} closed lots</span>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-label-mono-sm color-muted">STCG (SEC 111A)</span>
          <div className={`text-data-display ${stcg >= 0 ? 'color-positive' : 'color-negative'}`} style={{ fontSize: '14px', marginTop: '4px' }}>
            {stcg >= 0 ? '+' : ''}{formatINR(stcg)}
          </div>
          <span className="text-label-mono-xs color-muted">Taxed @ 20%</span>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-label-mono-sm color-muted">LTCG (SEC 112A)</span>
          <div className={`text-data-display ${ltcg >= 0 ? 'color-positive' : 'color-negative'}`} style={{ fontSize: '14px', marginTop: '4px' }}>
            {ltcg >= 0 ? '+' : ''}{formatINR(ltcg)}
          </div>
          <span className="text-label-mono-xs color-muted">Exempt up to 1.25L</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button 
          onClick={() => navigate('/trades')}
          style={{ background: 'none', border: 'none', color: 'var(--primary-container)', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer' }}
        >
          VIEW DETAILED TRADES →
        </button>
      </div>
    </div>
  );
}
