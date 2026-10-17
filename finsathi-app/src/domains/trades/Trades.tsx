import { useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../../shared/hooks/useAppStore';
import type { ChargeBreakdown } from '../../shared/hooks/useAppStore';
import { toPaise } from '../../shared/lib/currency';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { classifyTrade } from '../tax/engine';
import { SmartImport } from '../imports/SmartImport';
import { TradeInsights } from './TradeInsights';
import { Skeleton, CardSkeleton } from '../../shared/ui/Skeleton';
import { useEffect } from 'react';
import './Trades.css';

function generateId() {
  return crypto.randomUUID();
}

export function Trades() {
  const {
    tradeItems, addTrade, deleteTrade,
    tradingAccounts, addTradingAccount, deleteTradingAccount, updateTradingAccount
  } = useAppStore();
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<'manual' | 'import' | 'journal'>('journal');
  const [journalView, setJournalView] = useState<'table' | 'insights'>('table');
  const [importAccountId, setImportAccountId] = useState<string>(tradingAccounts[0]?.id || 'default');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 700);
    return () => clearTimeout(timer);
  }, [entryMode, journalView]);

  // Filter state
  const [filterFY, setFilterFY] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set(['STCG', 'LTCG', 'INTRADAY']));
  const [filterResult, setFilterResult] = useState('all');

  const handleResetFilters = () => {
    setFilterFY('all');
    setFilterMonth('all');
    setFilterTypes(new Set(['STCG', 'LTCG', 'INTRADAY']));
    setFilterResult('all');
    setSelectedAccountId('all');
  };

  // Trade Form state
  const [accountId, setAccountId] = useState(tradingAccounts[0]?.id || 'default');
  const [instrument, setInstrument] = useState('');
  const [isin, setIsin] = useState('');
  const [buyDate, setBuyDate] = useState('');
  const [sellDate, setSellDate] = useState('');
  const [qty, setQty] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [charges, setCharges] = useState('');

  // Charges Breakdown state
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [stt, setStt] = useState('');
  const [brokerage, setBrokerage] = useState('');
  const [exchangeTxn, setExchangeTxn] = useState('');
  const [sebi, setSebi] = useState('');
  const [cgst, setCgst] = useState('');
  const [sgst, setSgst] = useState('');
  const [igst, setIgst] = useState('');
  const [stampDuty, setStampDuty] = useState('');

  useEffect(() => {
    if (showBreakdown) {
      const sum = (Number(stt) || 0) + (Number(brokerage) || 0) + (Number(exchangeTxn) || 0) + 
                  (Number(sebi) || 0) + (Number(cgst) || 0) + (Number(sgst) || 0) + 
                  (Number(igst) || 0) + (Number(stampDuty) || 0);
      setCharges(sum > 0 ? sum.toFixed(2) : '');
    }
  }, [stt, brokerage, exchangeTxn, sebi, cgst, sgst, igst, stampDuty, showBreakdown]);

  // Account Form state
  const [accName, setAccName] = useState('');
  const [accBroker, setAccBroker] = useState('Zerodha');

  // Filtered and Sorted Trades
  const filteredTrades = useMemo(() => {
    let list = [...tradeItems];
    if (selectedAccountId !== 'all') {
      list = list.filter(t => t.accountId === selectedAccountId);
    }
    if (filterFY !== 'all') {
      list = list.filter(t => {
        const d = new Date(t.sellDate);
        const y = d.getFullYear();
        const m = d.getMonth();
        const fy = m >= 3 ? `${y}-${(y + 1) % 100}` : `${y - 1}-${y % 100}`;
        return fy === filterFY;
      });
    }
    if (filterMonth !== 'all') {
      list = list.filter(t => new Date(t.sellDate).getMonth() === parseInt(filterMonth));
    }

    // Checkbox filter
    list = list.filter(t => filterTypes.has(t.classification));

    if (filterResult === 'profit') {
      list = list.filter(t => t.realizedPnlPaise > 0);
    } else if (filterResult === 'loss') {
      list = list.filter(t => t.realizedPnlPaise < 0);
    }

    return list.sort((a, b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime());
  }, [tradeItems, selectedAccountId, filterFY, filterMonth, filterTypes, filterResult]);

  // Analytics
  const analytics = useMemo(() => {
    const totalPnl = filteredTrades.reduce((s, t) => s + t.realizedPnlPaise, 0);
    const totalCharges = filteredTrades.reduce((s, t) => s + t.chargesPaise, 0);
    const wins = filteredTrades.filter(t => t.realizedPnlPaise > 0).length;
    const losses = filteredTrades.filter(t => t.realizedPnlPaise < 0).length;
    const winRate = filteredTrades.length > 0 ? Math.round((wins / filteredTrades.length) * 100) : 0;

    const fnoTurnover = filteredTrades.reduce((s, t) => {
      if (t.classification === 'BUSINESS' || t.subType === 'futures' || t.subType === 'options') {
        return s + Math.abs((t.sellPricePaise - t.buyPricePaise) * t.qty);
      }
      return s;
    }, 0);

    const intradayTurnover = filteredTrades.reduce((s, t) => {
      if (t.classification === 'INTRADAY' || t.subType === 'intraday') {
        return s + Math.abs((t.sellPricePaise - t.buyPricePaise) * t.qty);
      }
      return s;
    }, 0);

    return { totalPnl, totalCharges, wins, losses, winRate, fnoTurnover, intradayTurnover };
  }, [filteredTrades]);

  const toggleFilterType = (type: string) => {
    const next = new Set(filterTypes);
    if (next.has(type)) {
      if (next.size > 1) next.delete(type);
    } else {
      next.add(type);
    }
    setFilterTypes(next);
  };

  const handleSaveTrade = (e: React.FormEvent) => {
    e.preventDefault();
    const bDate = new Date(buyDate);
    const sDate = new Date(sellDate);
    const q = Number(qty);
    const bp = toPaise(Number(buyPrice));
    const sp = toPaise(Number(sellPrice));
    const ch = toPaise(Number(charges) || 0);

    let chargeBreakdown: ChargeBreakdown | undefined = undefined;
    if (showBreakdown) {
      chargeBreakdown = {
        sttPaise: toPaise(Number(stt) || 0),
        brokeragePaise: toPaise(Number(brokerage) || 0),
        exchangeTxnPaise: toPaise(Number(exchangeTxn) || 0),
        sebiChargesPaise: toPaise(Number(sebi) || 0),
        cgstPaise: toPaise(Number(cgst) || 0),
        sgstPaise: toPaise(Number(sgst) || 0),
        igstPaise: toPaise(Number(igst) || 0),
        stampDutyPaise: toPaise(Number(stampDuty) || 0),
      };
    }

    addTrade({
      id: generateId(),
      type: 'trade',
      accountId: accountId,
      instrument: instrument.toUpperCase(),
      isin,
      buyDate,
      sellDate,
      qty: q,
      buyPricePaise: bp,
      sellPricePaise: sp,
      chargesPaise: ch,
      chargeBreakdown,
      assetType: 'equity',
      classification: classifyTrade(bDate, sDate),
      realizedPnlPaise: (sp - bp) * q - ch,
      notes: '',
      createdAt: new Date().toISOString(),
    });

    setInstrument('');
    setIsin('');
    setQty('');
    setBuyPrice('');
    setSellPrice('');
    setCharges('');
    
    setStt('');
    setBrokerage('');
    setExchangeTxn('');
    setSebi('');
    setCgst('');
    setSgst('');
    setIgst('');
    setStampDuty('');
    setShowBreakdown(false);

    setEntryMode('journal');
  };

  const handleSmartImportBatchConfirm = (records: any[]) => {
    const createdIds: string[] = [];
    records.forEach(rec => {
      const bp = toPaise(rec.buyPrice || 0);
      const sp = toPaise(rec.sellPrice || 0);
      const ch = toPaise(rec.charges || 0);
      const chargeBreakdown = rec.chargeBreakdown ? {
        brokeragePaise: toPaise(rec.chargeBreakdown.brokerage || 0),
        sttPaise: toPaise(rec.chargeBreakdown.stt || 0),
        exchangeTxnPaise: toPaise(rec.chargeBreakdown.exchangeTxn || 0),
        sebiChargesPaise: toPaise(rec.chargeBreakdown.sebiCharges || 0),
        stampDutyPaise: toPaise(rec.chargeBreakdown.stampDuty || 0),
        cgstPaise: toPaise(rec.chargeBreakdown.cgst || 0),
        sgstPaise: toPaise(rec.chargeBreakdown.sgst || 0),
        igstPaise: toPaise(rec.chargeBreakdown.igst || 0),
      } : undefined;

      const q = rec.qty || 0;
      const id = generateId();
      createdIds.push(id);

      const bDate = new Date(rec.buyDate);
      const sDate = new Date(rec.sellDate);

      addTrade({
        id,
        type: 'trade',
        accountId: importAccountId,
        instrument: (rec.instrument || 'UNKNOWN').toUpperCase(),
        isin: rec.isin || '',
        buyDate: rec.buyDate || new Date().toISOString().split('T')[0],
        sellDate: rec.sellDate || new Date().toISOString().split('T')[0],
        qty: q,
        buyPricePaise: bp,
        sellPricePaise: sp,
        chargesPaise: ch,
        chargeBreakdown,
        assetType: 'equity',
        classification: classifyTrade(
          isNaN(bDate.getTime()) ? new Date() : bDate,
          isNaN(sDate.getTime()) ? new Date() : sDate
        ),
        realizedPnlPaise: (sp - bp) * q - ch,
        notes: 'Batch Imported from Statement',
        createdAt: new Date().toISOString(),
        tradeId: rec.tradeId || `${rec.instrument}-${rec.buyDate}-${rec.qty}` // Save the unique ID
      });
    });
    return createdIds;
  };

  const handleAddAccount = () => {
    if (!accName) return;
    if (editingAccountId) {
      updateTradingAccount(editingAccountId, { name: accName, broker: accBroker });
      setEditingAccountId(null);
    } else {
      addTradingAccount({
        id: generateId(),
        name: accName,
        broker: accBroker,
        notes: '',
        createdAt: new Date().toISOString(),
      });
    }
    setAccName('');
    setShowAccountForm(false);
  };

  const handleEditAccount = (acc: any) => {
    setEditingAccountId(acc.id);
    setAccName(acc.name);
    setAccBroker(acc.broker);
    setShowAccountForm(true);
  };

  const fyOptions = useMemo(() => {
    const fys = new Set<string>();
    tradeItems.forEach(t => {
      const d = new Date(t.sellDate);
      const y = d.getFullYear();
      const m = d.getMonth();
      const fy = m >= 3 ? `${y}-${(y + 1) % 100}` : `${y - 1}-${y % 100}`;
      fys.add(fy);
    });
    return Array.from(fys).sort().reverse();
  }, [tradeItems]);

  const checkTradeDuplicate = useCallback((record: any) => {
    // 1. Check by explicit Trade ID if provided by broker
    if (record.tradeId) {
      const hasId = tradeItems.some(t => (t as any).tradeId === record.tradeId);
      if (hasId) return 'duplicate';
    }

    // 2. Check by composite key (Instrument + Dates + Qty + Account)
    const isDup = tradeItems.some(t =>
      t.instrument === record.instrument.toUpperCase() &&
      t.buyDate === record.buyDate &&
      t.sellDate === record.sellDate &&
      t.qty === record.qty &&
      t.accountId === importAccountId
    );
    if (isDup) return 'duplicate';

    const hasConflict = tradeItems.some(t =>
      t.instrument === record.instrument.toUpperCase() &&
      t.buyDate === record.buyDate &&
      t.sellDate === record.sellDate &&
      t.qty === record.qty &&
      t.accountId === importAccountId &&
      (t.buyPricePaise !== toPaise(record.buyPrice) || t.sellPricePaise !== toPaise(record.sellPrice))
    );
    if (hasConflict) return 'conflict';

    return 'new';
  }, [tradeItems, importAccountId]);

  const handleSelectRange = (monthIndex: number, year: number) => {
    // Determine FY from year/month
    const fy = monthIndex >= 3 ? `${year}-${(year + 1) % 100}` : `${year - 1}-${year % 100}`;
    setFilterFY(fy);
    setFilterMonth(monthIndex.toString());
    setJournalView('table');
  };

  return (
    <div className="trades">
      <div className="trades-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 className="text-headline-md">TRADING_DESK</h1>
          <nav className="trades-mode-tabs">
            <button className={`trades-mode-btn ${entryMode === 'journal' ? 'active' : ''}`} onClick={() => setEntryMode('journal')}>JOURNAL & ANALYSIS</button>
            <button className={`trades-mode-btn ${entryMode === 'manual' ? 'active' : ''}`} onClick={() => setEntryMode('manual')}>MANUAL_ENTRY</button>
            <button className={`trades-mode-btn ${entryMode === 'import' ? 'active' : ''}`} onClick={() => setEntryMode('import')}>SMART_IMPORT</button>
          </nav>
        </div>
        <button
          className={`trades-add-btn ${showAccountForm ? 'active' : ''}`}
          onClick={() => setShowAccountForm(!showAccountForm)}
        >
          <span className="material-symbols-outlined icon-sm">account_balance</span>
          MANAGE_ACCOUNTS
        </button>
      </div>

      {showAccountForm && (
        <div className="glass-surface trades-account-mgmt animate-in">
          <div className="glass-card-header">
            <span className="text-label-mono color-subtle">{editingAccountId ? 'EDIT_ACCOUNT' : 'LINK_TRADING_ACCOUNT'}</span>
          </div>
          <div className="trades-account-list">
            {tradingAccounts.map(acc => (
              <div key={acc.id} className={`trades-account-item ${editingAccountId === acc.id ? 'editing' : ''}`}>
                <div>
                  <span className="text-label-mono" style={{ fontSize: '11px' }}>{acc.name.toUpperCase()}</span>
                  <span className="text-label-mono-sm color-muted" style={{ marginLeft: '8px' }}>{acc.broker}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="trades-delete-btn" onClick={() => handleEditAccount(acc)}>
                    <span className="material-symbols-outlined icon-xs">edit</span>
                  </button>
                  <button className="trades-delete-btn" onClick={() => deleteTradingAccount(acc.id)}>
                    <span className="material-symbols-outlined icon-xs">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="trades-account-form">
            <input
              className="trades-input"
              placeholder="ACCOUNT_NAME"
              value={accName}
              onChange={e => setAccName(e.target.value)}
              style={{ flex: 1 }}
            />
            <select className="trades-select" value={accBroker} onChange={e => setAccBroker(e.target.value)}>
              <option>Zerodha</option>
              <option>Groww</option>
              <option>Upstox</option>
              <option>Angel One</option>
              <option>Other</option>
            </select>
            <button className="trades-save-btn" onClick={handleAddAccount}>{editingAccountId ? 'UPDATE' : 'ADD_ACCOUNT'}</button>
            {editingAccountId && <button className="trades-cancel-btn" onClick={() => { setEditingAccountId(null); setAccName(''); setShowAccountForm(false); }}>CANCEL</button>}
          </div>
        </div>
      )}

      {entryMode === 'import' ? (
        <SmartImport
          onBatchConfirm={handleSmartImportBatchConfirm}
          onCheckDuplicate={checkTradeDuplicate}
          extraReviewContent={
            <div className="si-extra-content glass-surface">
              <span className="si-extra-label">TARGET_ACCOUNT</span>
              <div className="si-extra-field">
                <select className="trades-select" value={importAccountId} onChange={e => setImportAccountId(e.target.value)} style={{ width: '100%' }}>
                  {tradingAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.broker})</option>)}
                </select>
              </div>
            </div>
          }
        />
      ) : entryMode === 'manual' ? (
        <div className="glass-surface trades-form-container animate-in">
          <div className="glass-card-header">
            <span className="text-label-mono color-subtle">ADD_MANUAL_TRADE</span>
          </div>
          <form className="trades-form" onSubmit={handleSaveTrade}>
            <div className="trades-form-grid">
              <div className="trades-field">
                <label className="text-label-mono-sm color-muted">ACCOUNT</label>
                <select className="trades-select" value={accountId} onChange={e => setAccountId(e.target.value)}>
                  {tradingAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
              </div>
              <div className="trades-field">
                <label className="text-label-mono-sm color-muted">INSTRUMENT</label>
                <input className="trades-input" placeholder="RELIANCE" value={instrument} onChange={e => setInstrument(e.target.value)} required />
              </div>
              <div className="trades-field">
                <label className="text-label-mono-sm color-muted">QTY</label>
                <input className="trades-input" type="number" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} required />
              </div>
              <div className="trades-field">
                <label className="text-label-mono-sm color-muted">BUY_DATE</label>
                <input className="trades-input" type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)} required />
              </div>
              <div className="trades-field">
                <label className="text-label-mono-sm color-muted">SELL_DATE</label>
                <input className="trades-input" type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} required />
              </div>
              <div className="trades-field">
                <label className="text-label-mono-sm color-muted">BUY_PRICE</label>
                <input className="trades-input" type="number" step="0.01" placeholder="0.00" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} required />
              </div>
              <div className="trades-field">
                <label className="text-label-mono-sm color-muted">SELL_PRICE</label>
                <input className="trades-input" type="number" step="0.01" placeholder="0.00" value={sellPrice} onChange={e => setSellPrice(e.target.value)} required />
              </div>
              <div className="trades-field">
                <label className="text-label-mono-sm color-muted">CHARGES</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="trades-input" type="number" step="0.01" placeholder="0.00" value={charges} onChange={e => { if (!showBreakdown) setCharges(e.target.value); }} readOnly={showBreakdown} style={{ flex: 1 }} />
                  <button type="button" className="trades-mode-btn" onClick={() => setShowBreakdown(!showBreakdown)} style={{ height: '36px', padding: '0 8px' }}>
                    <span className="material-symbols-outlined icon-xs">{showBreakdown ? 'expand_less' : 'expand_more'}</span>
                  </button>
                </div>
              </div>
            </div>
            {showBreakdown && (
              <div className="trades-breakdown-section" style={{ marginTop: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <div className="text-label-mono-sm color-muted" style={{ marginBottom: '12px' }}>CHARGES BREAKDOWN</div>
                <div className="trades-form-grid">
                  <div className="trades-field">
                    <label className="text-label-mono-sm color-muted">STT</label>
                    <input className="trades-input" type="number" step="0.01" value={stt} onChange={e => setStt(e.target.value)} />
                  </div>
                  <div className="trades-field">
                    <label className="text-label-mono-sm color-muted">BROKERAGE</label>
                    <input className="trades-input" type="number" step="0.01" value={brokerage} onChange={e => setBrokerage(e.target.value)} />
                  </div>
                  <div className="trades-field">
                    <label className="text-label-mono-sm color-muted">EXCHANGE TXN</label>
                    <input className="trades-input" type="number" step="0.01" value={exchangeTxn} onChange={e => setExchangeTxn(e.target.value)} />
                  </div>
                  <div className="trades-field">
                    <label className="text-label-mono-sm color-muted">SEBI</label>
                    <input className="trades-input" type="number" step="0.01" value={sebi} onChange={e => setSebi(e.target.value)} />
                  </div>
                  <div className="trades-field">
                    <label className="text-label-mono-sm color-muted">CGST</label>
                    <input className="trades-input" type="number" step="0.01" value={cgst} onChange={e => setCgst(e.target.value)} />
                  </div>
                  <div className="trades-field">
                    <label className="text-label-mono-sm color-muted">SGST</label>
                    <input className="trades-input" type="number" step="0.01" value={sgst} onChange={e => setSgst(e.target.value)} />
                  </div>
                  <div className="trades-field">
                    <label className="text-label-mono-sm color-muted">IGST</label>
                    <input className="trades-input" type="number" step="0.01" value={igst} onChange={e => setIgst(e.target.value)} />
                  </div>
                  <div className="trades-field">
                    <label className="text-label-mono-sm color-muted">STAMP DUTY</label>
                    <input className="trades-input" type="number" step="0.01" value={stampDuty} onChange={e => setStampDuty(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
            <div className="trades-form-actions">
              <button type="submit" className="trades-save-btn">SAVE_TRADE</button>
              <button type="button" className="trades-cancel-btn" onClick={() => setEntryMode('journal')}>CANCEL</button>
            </div>
          </form>
        </div>
      ) : isLoading ? (
        <div className="trades-journal-view">
          <div className="trades-summary">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="glass-surface" style={{ marginTop: '12px', padding: '24px' }}>
            <Skeleton width="100%" height={200} />
          </div>
        </div>
      ) : (
        <div className="trades-journal-view animate-in">
          {/* Analytics Bar */}
          <div className="trades-summary">
            <div className="glass-surface trades-stat">
              <div className="trades-stat-body">
                <span className="text-label-mono-sm color-muted">NET_REALIZED_PNL</span>
                <span className={`text-headline-sm ${analytics.totalPnl >= 0 ? 'color-positive' : 'color-negative'}`}>
                  {analytics.totalPnl >= 0 ? '+' : ''}
                  <CurrencyValue paise={analytics.totalPnl} />
                </span>
              </div>
            </div>
            <div className="glass-surface trades-stat">
              <div className="trades-stat-body">
                <span className="text-label-mono-sm color-muted">TOTAL_CHARGES</span>
                <span className="text-headline-sm color-negative">
                  <CurrencyValue paise={analytics.totalCharges} />
                </span>
              </div>
            </div>
            <div className="glass-surface trades-stat">
              <div className="trades-stat-body">
                <span className="text-label-mono-sm color-muted">WIN_RATE</span>
                <span className="text-headline-sm color-info">{analytics.winRate}%</span>
              </div>
            </div>
            <div className="glass-surface trades-stat">
              <div className="trades-stat-body">
                <span className="text-label-mono-sm color-muted">TRADE_COUNT</span>
                <span className="text-headline-sm">{filteredTrades.length}</span>
              </div>
            </div>
            <div className="glass-surface trades-stat">
              <div className="trades-stat-body">
                <span className="text-label-mono-sm color-muted">F&O TURNOVER</span>
                <span className="text-headline-sm">
                  <CurrencyValue paise={analytics.fnoTurnover} />
                </span>
              </div>
            </div>
            <div className="glass-surface trades-stat">
              <div className="trades-stat-body">
                <span className="text-label-mono-sm color-muted">INTRADAY TURNOVER</span>
                <span className="text-headline-sm">
                  <CurrencyValue paise={analytics.intradayTurnover} />
                </span>
              </div>
            </div>
          </div>
          {/* Filters Bar */}
          <div className="glass-surface trades-filters-bar" style={{ marginTop: '12px', padding: '12px' }}>
            <div className="trades-filters">
              <div style={{ display: 'flex', gap: '8px', marginRight: 'auto' }}>
                <button
                  className={`trades-mode-btn ${journalView === 'table' ? 'active' : ''}`}
                  onClick={() => setJournalView('table')}
                  style={{ height: '32px' }}
                >
                  <span className="material-symbols-outlined icon-xs">list</span>
                  JOURNAL
                </button>
                <button
                  className={`trades-mode-btn ${journalView === 'insights' ? 'active' : ''}`}
                  onClick={() => setJournalView('insights')}
                  style={{ height: '32px' }}
                >
                  <span className="material-symbols-outlined icon-xs">insights</span>
                  INSIGHTS
                </button>
              </div>

              <div className="fy-divider-v" style={{ height: '24px', margin: '0 8px' }} />

              <div className="trades-field" style={{ minWidth: '120px' }}>
                <label className="text-label-mono-sm color-muted">ACCOUNT</label>
                <select className="trades-select" value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
                  <option value="all">ALL_ACCOUNTS</option>
                  {tradingAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
              </div>
              <div className="trades-field" style={{ minWidth: '100px' }}>
                <label className="text-label-mono-sm color-muted">FY</label>
                <select className="trades-select" value={filterFY} onChange={e => setFilterFY(e.target.value)}>
                  <option value="all">ALL_FY</option>
                  {fyOptions.map(fy => <option key={fy} value={fy}>FY {fy}</option>)}
                </select>
              </div>

              {journalView === 'table' && (
                <>
                  <div className="trades-field" style={{ minWidth: '100px' }}>
                    <label className="text-label-mono-sm color-muted">MONTH</label>
                    <select className="trades-select" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                      <option value="all">ALL_MONTHS</option>
                      {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map((m, i) => (
                        <option key={m} value={i.toString()}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="trades-field">
                    <label className="text-label-mono-sm color-muted">TRADE_TYPES</label>
                    <div className="trades-checkbox-group">
                      {['STCG', 'LTCG', 'INTRADAY'].map(type => (
                        <label key={type} className={`trades-checkbox-label ${filterTypes.has(type) ? 'active' : ''}`}>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={filterTypes.has(type)}
                            onChange={() => toggleFilterType(type)}
                          />
                          <span>{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="trades-field" style={{ minWidth: '100px' }}>
                    <label className="text-label-mono-sm color-muted">RESULT</label>
                    <select className="trades-select" value={filterResult} onChange={e => setFilterResult(e.target.value)}>
                      <option value="all">ALL_RESULTS</option>
                      <option value="profit">PROFIT_ONLY</option>
                      <option value="loss">LOSS_ONLY</option>
                    </select>
                  </div>
                </>
              )}

              <div className="trades-field" style={{ alignSelf: 'flex-end' }}>
                <button className="trades-mode-btn" onClick={handleResetFilters} style={{ height: '32px', border: '1px solid rgba(255,255,255,0.1)' }}>RESET</button>
              </div>
            </div>
          </div>

          {journalView === 'insights' ? (
            <TradeInsights onSelectMonth={handleSelectRange} />
          ) : (
            <div className="glass-surface trades-table animate-in" style={{ marginTop: '12px' }}>
              <div className="trades-table-header">
                <span>INSTRUMENT</span>
                <span>SELL_DATE</span>
                <span>BUY_DATE</span>
                <span>QTY</span>
                <span>P&L (NET)</span>
                <span>TYPE</span>
                <span></span>
              </div>
              <div className="trades-table-body">
                {filteredTrades.length === 0 ? (
                  <div className="trades-empty">
                    <span className="text-label-mono color-muted" style={{ padding: '40px' }}>NO_RECORDS_MATCH_FILTERS</span>
                  </div>
                ) : (
                  filteredTrades.map((trade) => (
                    <div key={trade.id} className="glass-row trades-table-row">
                      <div className="trades-cell-instrument">
                        <span className="text-body" style={{ fontWeight: 600 }}>{trade.instrument}</span>
                        <span className="text-label-mono-sm color-muted" style={{ fontSize: '9px' }}>
                          {tradingAccounts.find(a => a.id === trade.accountId)?.name || 'UNKNOWN'}
                        </span>
                      </div>
                      <div className="trades-cell">
                        <span className="text-label-mono-sm">{trade.sellDate}</span>
                        <span className="text-label-mono-sm color-muted">@ <CurrencyValue paise={trade.sellPricePaise} /></span>
                      </div>
                      <div className="trades-cell">
                        <span className="text-label-mono-sm">{trade.buyDate}</span>
                        <span className="text-label-mono-sm color-muted">@ <CurrencyValue paise={trade.buyPricePaise} /></span>
                      </div>
                      <div className="text-data-display">{trade.qty}</div>
                      <div className="trades-cell" style={{ textAlign: 'right' }}>
                        <span className={`text-data-display ${trade.realizedPnlPaise >= 0 ? 'color-positive' : 'color-negative'}`}>
                          <CurrencyValue paise={trade.realizedPnlPaise} />
                        </span>
                        <span className="text-label-mono-sm color-muted" style={{ fontSize: '9px' }}>
                          EXP: <CurrencyValue paise={trade.chargesPaise} />
                        </span>
                      </div>
                      <div>
                        <span className={`trades-badge trades-badge--${trade.classification.toLowerCase()}`}>
                          {trade.classification}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          className="trades-delete-btn"
                          onClick={() => deleteTrade(trade.id)}
                          title="Delete Trade"
                          aria-label={`Delete trade for ${trade.instrument}`}
                        >
                          <span className="material-symbols-outlined icon-xs">delete</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
