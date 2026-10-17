import React, { useState, useMemo } from 'react';
import { useFamilyStore, type FamilyMember, type FamilyAsset, type ProbableCashflow } from '../../shared/hooks/useFamilyStore';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { toPaise } from '../../shared/lib/currency';
import './Family.css';

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function FamilyHub() {
  const { members, assets, cashflows, addMember, deleteMember, addAsset, deleteAsset, addCashflow, deleteCashflow } = useFamilyStore();
  const [activeTab, setActiveTab] = useState<'members' | 'assets' | 'cashflows'>('members');

  // Modal visibility
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showCashflowModal, setShowCashflowModal] = useState(false);

  // Member form
  const [memberName, setMemberName] = useState('');
  const [memberRelation, setMemberRelation] = useState<'Self' | 'Spouse' | 'Child' | 'Parent' | 'Sibling' | 'Other'>('Spouse');

  // Asset form
  const [assetMemberId, setAssetMemberId] = useState('');
  const [assetType, setAssetType] = useState<'Gold' | 'Real Estate' | 'Vehicle' | 'Other'>('Gold');
  const [assetName, setAssetName] = useState('');
  const [assetValue, setAssetValue] = useState('');

  // Cashflow form
  const [cfMemberId, setCfMemberId] = useState('');
  const [cfType, setCfType] = useState<'income' | 'expense'>('income');
  const [cfLabel, setCfLabel] = useState('');
  const [cfAmount, setCfAmount] = useState('');
  const [cfProb, setCfProb] = useState<'High' | 'Medium' | 'Low'>('High');

  // Computed stats
  const totalAssets = useMemo(() => assets.reduce((sum, a) => sum + a.estimatedValuePaise, 0), [assets]);
  const cashflowIn = useMemo(() => cashflows.filter(c => c.type === 'income').reduce((sum, c) => sum + c.expectedAmountPaise, 0), [cashflows]);
  const cashflowOut = useMemo(() => cashflows.filter(c => c.type === 'expense').reduce((sum, c) => sum + c.expectedAmountPaise, 0), [cashflows]);

  // Assets grouped by member
  const assetsByMember = useMemo(() => {
    const groups: Record<string, { member: FamilyMember; assets: FamilyAsset[]; total: number }> = {};
    for (const m of members) {
      const memberAssets = assets.filter(a => a.memberId === m.id);
      if (memberAssets.length > 0) {
        groups[m.id] = {
          member: m,
          assets: memberAssets,
          total: memberAssets.reduce((sum, a) => sum + a.estimatedValuePaise, 0),
        };
      }
    }
    return groups;
  }, [members, assets]);

  const handleAddMember = () => {
    if (!memberName) return;
    addMember({ id: generateId(), name: memberName, relation: memberRelation });
    setMemberName('');
    setMemberRelation('Spouse');
    setShowMemberModal(false);
  };

  const handleAddAsset = () => {
    if (!assetName || !assetValue || !assetMemberId) return;
    addAsset({
      id: generateId(),
      memberId: assetMemberId,
      type: assetType,
      name: assetName,
      estimatedValuePaise: toPaise(Number(assetValue)),
    });
    setAssetName('');
    setAssetValue('');
    setAssetMemberId('');
    setAssetType('Gold');
    setShowAssetModal(false);
  };

  const handleAddCashflow = () => {
    if (!cfLabel || !cfAmount || !cfMemberId) return;
    addCashflow({
      id: generateId(),
      memberId: cfMemberId,
      type: cfType,
      label: cfLabel,
      expectedAmountPaise: toPaise(Number(cfAmount)),
      probability: cfProb,
    });
    setCfLabel('');
    setCfAmount('');
    setCfMemberId('');
    setCfType('income');
    setCfProb('High');
    setShowCashflowModal(false);
  };

  return (
    <div className="family-hub animate-in">
      {/* ── Header ──────────────────────────────────── */}
      <header className="ledger-header">
        <div className="header-meta">
          <h1 className="text-headline-md tracking-tighter">FAMILY_HUB</h1>
          <div className="status-line">
            <span className="pulse-dot"></span>
            <span className="text-label-mono color-muted">TRACK_MEMBER_ASSETS_&_CASHFLOWS</span>
          </div>
        </div>
      </header>

      {/* ── Stats ───────────────────────────────────── */}
      <div className="family-header-stats">
        <div className="family-stat-pill">
          <span className="text-label-mono-sm color-muted">MEMBERS</span>
          <span className="text-data-display">{members.length}</span>
        </div>
        <div className="family-stat-pill">
          <span className="text-label-mono-sm color-muted">TOTAL_ASSETS</span>
          <span className="text-data-display"><CurrencyValue paise={totalAssets} /></span>
        </div>
        <div className="family-stat-pill">
          <span className="text-label-mono-sm color-muted">CASHFLOW_IN</span>
          <span className="text-data-display" style={{ color: 'var(--positive)' }}><CurrencyValue paise={cashflowIn} /></span>
        </div>
        <div className="family-stat-pill">
          <span className="text-label-mono-sm color-muted">CASHFLOW_OUT</span>
          <span className="text-data-display" style={{ color: 'var(--error)' }}><CurrencyValue paise={cashflowOut} /></span>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────── */}
      <div className="family-tabs">
        {(['members', 'assets', 'cashflows'] as const).map(tab => (
          <button
            key={tab}
            className={`family-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════
          MEMBERS TAB
          ═══════════════════════════════════════════════ */}
      {activeTab === 'members' && (
        <div className="family-section">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button className="family-add-btn" onClick={() => setShowMemberModal(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'wght' 200" }}>person_add</span>
              ADD_MEMBER
            </button>
          </div>

          {members.length === 0 ? (
            <div className="family-empty">
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--on-surface-variant)', fontVariationSettings: "'wght' 200" }}>group</span>
              <span className="text-label-mono color-muted">NO_MEMBERS_DEFINED</span>
              <span className="text-label-mono-sm color-muted">Add family members to track their assets and cashflows</span>
            </div>
          ) : (
            <div className="family-avatar-grid">
              {members.map(m => (
                <div key={m.id} className="family-avatar-card">
                  <span className="family-relation-badge">{m.relation}</span>
                  <div className={`family-avatar ${m.relation}`}>
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-body">{m.name}</span>
                  <button className="family-icon-btn" onClick={() => deleteMember(m.id)}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'wght' 200" }}>delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          ASSETS TAB
          ═══════════════════════════════════════════════ */}
      {activeTab === 'assets' && (
        <div className="family-section">
          {members.length === 0 ? (
            <div className="family-empty">
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--on-surface-variant)', fontVariationSettings: "'wght' 200" }}>home</span>
              <span className="text-label-mono color-muted">PLEASE_ADD_A_FAMILY_MEMBER_FIRST</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button className="family-add-btn" onClick={() => setShowAssetModal(true)}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'wght' 200" }}>add_home</span>
                  ADD_ASSET
                </button>
              </div>

              {assets.length === 0 ? (
                <div className="family-empty">
                  <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--on-surface-variant)', fontVariationSettings: "'wght' 200" }}>home</span>
                  <span className="text-label-mono color-muted">NO_ASSETS_DEFINED</span>
                  <span className="text-label-mono-sm color-muted">Add assets to track family wealth</span>
                </div>
              ) : (
                Object.values(assetsByMember).map(({ member, assets: memberAssets, total }) => (
                  <div key={member.id} className="family-asset-group">
                    <div className="family-asset-group-header">
                      <span className="text-label-mono">{member.name}</span>
                      <span className="text-data-display"><CurrencyValue paise={total} /></span>
                    </div>
                    {memberAssets.map(a => (
                      <div key={a.id} className="family-asset-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span className="text-body">{a.name}</span>
                          <span className="family-relation-badge" style={{ position: 'static' }}>{a.type}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <span className="text-data-display"><CurrencyValue paise={a.estimatedValuePaise} /></span>
                          <button className="family-icon-btn" onClick={() => deleteAsset(a.id)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'wght' 200" }}>delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          CASHFLOWS TAB
          ═══════════════════════════════════════════════ */}
      {activeTab === 'cashflows' && (
        <div className="family-section">
          {members.length === 0 ? (
            <div className="family-empty">
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--on-surface-variant)', fontVariationSettings: "'wght' 200" }}>account_balance_wallet</span>
              <span className="text-label-mono color-muted">PLEASE_ADD_A_FAMILY_MEMBER_FIRST</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button className="family-add-btn" onClick={() => setShowCashflowModal(true)}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'wght' 200" }}>currency_exchange</span>
                  ADD_CASHFLOW
                </button>
              </div>

              {cashflows.length === 0 ? (
                <div className="family-empty">
                  <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--on-surface-variant)', fontVariationSettings: "'wght' 200" }}>account_balance_wallet</span>
                  <span className="text-label-mono color-muted">NO_CASHFLOWS_DEFINED</span>
                  <span className="text-label-mono-sm color-muted">Add probable income and expenses for family members</span>
                </div>
              ) : (
                <div className="family-cf-timeline">
                  {cashflows.map(c => {
                    const member = members.find(m => m.id === c.memberId);
                    return (
                      <div key={c.id} className={`family-cf-item ${c.type}`}>
                        <span className={`family-prob-dot ${c.probability}`}></span>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span className="text-body">{c.label}</span>
                          <span className="text-label-mono-sm color-muted">
                            {member?.name} · {c.type.toUpperCase()} · {c.probability.toUpperCase()}
                          </span>
                        </div>
                        <span
                          className="text-data-display"
                          style={{ color: c.type === 'income' ? 'var(--positive)' : 'var(--error)' }}
                        >
                          {c.type === 'income' ? '+' : '−'}<CurrencyValue paise={c.expectedAmountPaise} />
                        </span>
                        <button className="family-icon-btn" onClick={() => deleteCashflow(c.id)}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'wght' 200" }}>delete</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          MODAL — Add Member
          ═══════════════════════════════════════════════ */}
      {showMemberModal && (
        <div className="salary-modal-overlay" onClick={() => setShowMemberModal(false)}>
          <div className="glass-surface-elevated salary-modal" style={{ width: '460px' }} onClick={e => e.stopPropagation()}>
            <div className="glass-card-header">
              <span className="text-label-mono">ADD_MEMBER</span>
            </div>
            <div className="salary-modal-body" style={{ display: 'grid', gap: '16px' }}>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">NAME</label>
                <input
                  className="salary-input"
                  type="text"
                  value={memberName}
                  onChange={e => setMemberName(e.target.value)}
                  placeholder="e.g. Alice"
                  autoFocus
                />
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">RELATION</label>
                <select
                  className="salary-input"
                  value={memberRelation}
                  onChange={e => setMemberRelation(e.target.value as any)}
                >
                  {['Self', 'Spouse', 'Child', 'Parent', 'Sibling', 'Other'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="salary-modal-actions">
              <button className="salary-btn-primary" onClick={handleAddMember}>SAVE</button>
              <button className="salary-btn-secondary" onClick={() => setShowMemberModal(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          MODAL — Add Asset
          ═══════════════════════════════════════════════ */}
      {showAssetModal && (
        <div className="salary-modal-overlay" onClick={() => setShowAssetModal(false)}>
          <div className="glass-surface-elevated salary-modal" style={{ width: '460px' }} onClick={e => e.stopPropagation()}>
            <div className="glass-card-header">
              <span className="text-label-mono">ADD_ASSET</span>
            </div>
            <div className="salary-modal-body" style={{ display: 'grid', gap: '16px' }}>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">MEMBER</label>
                <select
                  className="salary-input"
                  value={assetMemberId}
                  onChange={e => setAssetMemberId(e.target.value)}
                >
                  <option value="">Select...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">TYPE</label>
                <select
                  className="salary-input"
                  value={assetType}
                  onChange={e => setAssetType(e.target.value as any)}
                >
                  {['Gold', 'Real Estate', 'Vehicle', 'Other'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">ASSET_NAME</label>
                <input
                  className="salary-input"
                  type="text"
                  value={assetName}
                  onChange={e => setAssetName(e.target.value)}
                  placeholder="e.g. 50g Gold Coin"
                />
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">ESTIMATED_VALUE</label>
                <input
                  className="salary-input"
                  type="number"
                  value={assetValue}
                  onChange={e => setAssetValue(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="salary-modal-actions">
              <button className="salary-btn-primary" onClick={handleAddAsset}>SAVE</button>
              <button className="salary-btn-secondary" onClick={() => setShowAssetModal(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          MODAL — Add Cashflow
          ═══════════════════════════════════════════════ */}
      {showCashflowModal && (
        <div className="salary-modal-overlay" onClick={() => setShowCashflowModal(false)}>
          <div className="glass-surface-elevated salary-modal" style={{ width: '460px' }} onClick={e => e.stopPropagation()}>
            <div className="glass-card-header">
              <span className="text-label-mono">ADD_CASHFLOW</span>
            </div>
            <div className="salary-modal-body" style={{ display: 'grid', gap: '16px' }}>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">MEMBER</label>
                <select
                  className="salary-input"
                  value={cfMemberId}
                  onChange={e => setCfMemberId(e.target.value)}
                >
                  <option value="">Select...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">TYPE</label>
                <select
                  className="salary-input"
                  value={cfType}
                  onChange={e => setCfType(e.target.value as any)}
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">LABEL</label>
                <input
                  className="salary-input"
                  type="text"
                  value={cfLabel}
                  onChange={e => setCfLabel(e.target.value)}
                  placeholder="e.g. Sister's Salary"
                />
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">AMOUNT</label>
                <input
                  className="salary-input"
                  type="number"
                  value={cfAmount}
                  onChange={e => setCfAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">PROBABILITY</label>
                <select
                  className="salary-input"
                  value={cfProb}
                  onChange={e => setCfProb(e.target.value as any)}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
            <div className="salary-modal-actions">
              <button className="salary-btn-primary" onClick={handleAddCashflow}>SAVE</button>
              <button className="salary-btn-secondary" onClick={() => setShowCashflowModal(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
