import React, { useState } from 'react';
import { useSalaryStore, type SalaryComponent } from '../../shared/hooks/useSalaryStore';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { formatINR, toPaise, toRupees } from '../../shared/lib/currency';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { getCurrentFY, getFY, getYearRange } from '../../shared/lib/dates';
import './Salary.css';
import { SmartSalaryImport } from './SmartSalaryImport';

export function SalaryStructure() {
  const { 
    revisions, addRevision, updateRevision, deleteRevision,
    documents, addDocument, deleteDocument,
    calculateNet, markMonthAsPosted, postedMonths, getStructureForMonth
  } = useSalaryStore();
  const { addIncome } = useAppStore();
  
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(revisions[0]?.id || null);
  const [showForm, setShowForm] = useState(false);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'earning' | 'deduction'>('earning');
  const [newCat, setNewCat] = useState<SalaryComponent['category']>('basic');
  const [newMonths, setNewMonths] = useState<number[]>([]);
  
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  // Revision Form State
  const [revEffective, setRevEffective] = useState('');
  const [revCompany, setRevCompany] = useState('');
  const [revCTC, setRevCTC] = useState('');

  // Doc Form State
  const [docLabel, setDocLabel] = useState('');
  const [docUrl, setDocUrl] = useState('');

  const handleSmartImportComplete = async (results: any[]) => {
    try {
      for (const item of results) {
        const d = item.data;
        const monthKey = item.editedMonth || d.month;
        
        addIncome({
          id: crypto.randomUUID(),
          type: 'income',
          head: 'salary',
          amountPaise: toPaise(d.netPay),
          source: d.employer || 'Salary Import',
          fy: getFY(new Date(monthKey + '-01')),
          isTaxable: true,
          notes: `Smart Import: ${monthKey}. Gross: ₹${(d.grossPay || 0).toLocaleString()}`,
          tags: ['salary', 'smart-import', `smk:${monthKey}`],
          date: `${monthKey}-01`,
          createdAt: new Date().toISOString()
        });

        markMonthAsPosted(monthKey);
      }
      setShowImport(false);
      alert(`Successfully imported ${results.length} records!`);
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    }
  };

  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const YEARS = getYearRange();

  const activeStructure = revisions.find(r => r.id === activeRevisionId) || revisions[0] || null;

  const handleInitialize = () => {
    const id = crypto.randomUUID();
    addRevision({
      effectiveFrom: '2024-04',
      companyName: 'My Company',
      payCycleDay: 1,
      components: [
        { id: '1', label: 'Basic Salary', amountPaise: toPaise(50000), type: 'earning', category: 'basic' },
        { id: '2', label: 'HRA', amountPaise: toPaise(20000), type: 'earning', category: 'hra' }
      ]
    });
    setActiveRevisionId(id);
  };

  const handleSaveComponent = () => {
    if (!newLabel || !newAmount || !activeStructure) return;
    const compData = {
      label: newLabel,
      amountPaise: toPaise(Number(newAmount)),
      type: newType,
      category: newCat,
      applicableMonths: newMonths.length > 0 ? newMonths : undefined
    };

    if (editingId) {
      const updated = activeStructure.components.map(c => 
        c.id === editingId ? { ...c, ...compData } : c
      );
      updateRevision(activeStructure.id, { components: updated });
    } else {
      updateRevision(activeStructure.id, { 
        components: [...activeStructure.components, { ...compData, id: crypto.randomUUID() }] 
      });
    }
    resetForm();
    setShowForm(false);
  };

  const handleSaveRevision = () => {
    if (!revEffective || !revCompany) return;
    addRevision({
      effectiveFrom: revEffective,
      companyName: revCompany,
      payCycleDay: 1,
      components: activeStructure?.components || [],
      ctcPaise: revCTC ? toPaise(Number(revCTC)) : undefined
    });
    setRevEffective(''); setRevCompany(''); setRevCTC('');
    setShowRevisionForm(false);
  };

  const handleSaveDoc = () => {
    if (!docLabel || !docUrl) return;
    addDocument({
      label: docLabel,
      url: docUrl,
      date: new Date().toISOString().split('T')[0]
    });
    setDocLabel(''); setDocUrl('');
    setShowDocForm(false);
  };

  const handleEdit = (c: SalaryComponent) => {
    setEditingId(c.id);
    setNewLabel(c.label);
    setNewAmount(toRupees(c.amountPaise).toString());
    setNewType(c.type);
    setNewCat(c.category);
    setNewMonths(c.applicableMonths || []);
    setShowForm(true);
  };

  const removeComponent = (id: string) => {
    if (!activeStructure) return;
    updateRevision(activeStructure.id, {
      components: activeStructure.components.filter(c => c.id !== id)
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setNewLabel('');
    setNewAmount('');
    setNewCat('basic');
    setNewMonths([]);
  };

  const toggleMonth = (mIdx: number) => {
    setNewMonths(prev => 
      prev.includes(mIdx) ? prev.filter(m => m !== mIdx) : [...prev, mIdx]
    );
  };

  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const isAlreadyPosted = postedMonths?.includes(monthKey) || false;
  
  // Disable if it's a future month (relative to today)
  const today = new Date();
  const currentMonthIdx = today.getMonth();
  const currentYear = today.getFullYear();
  const isFutureMonth = viewYear > currentYear || (viewYear === currentYear && viewMonth >= currentMonthIdx);

  const handlePostSalary = () => {
    if (isFutureMonth) return;

    const net = calculateNet(viewYear, viewMonth);
    const disbursementDate = new Date(viewYear, viewMonth + 1, 1);
    const dateStr = disbursementDate.toISOString().split('T')[0];
    const actualStructureUsed = getStructureForMonth(viewYear, viewMonth);

    const { incomeItems, addIncome, updateIncome } = useAppStore.getState();
    const existingSalary = incomeItems.find(i => 
      i.head === 'salary' && i.tags?.includes(`smk:${monthKey}`)
    );

    if (existingSalary) {
      updateIncome(existingSalary.id, {
        amountPaise: net,
        source: actualStructureUsed?.companyName || 'Salary',
        notes: `Salary for ${MONTHS[viewMonth]} ${viewYear} (${actualStructureUsed?.companyName}) [Synced]`,
      });
      alert(`Ledger entry for ${MONTHS[viewMonth]} has been updated to ₹${toRupees(net)}.`);
    } else {
      addIncome({
        id: crypto.randomUUID(),
        type: 'income',
        head: 'salary',
        amountPaise: net,
        source: actualStructureUsed?.companyName || 'Salary',
        fy: getFY(new Date(viewYear, viewMonth, 1)),
        isTaxable: true,
        notes: `Salary for ${MONTHS[viewMonth]} ${viewYear} (${actualStructureUsed?.companyName})`,
        tags: ['salary', 'auto', `smk:${monthKey}`],
        date: dateStr,
        createdAt: new Date().toISOString()
      });
      markMonthAsPosted(monthKey);
      alert(`Salary for ${MONTHS[viewMonth]} posted to ledger!`);
    }
  };

  if (revisions.length === 0) {
    return (
      <div className="glass-surface salary-empty animate-in">
        <span className="material-symbols-outlined icon-xl color-muted">payments</span>
        <h2 className="text-headline-md">NO_SALARY_HISTORY_FOUND</h2>
        <p className="text-body color-muted">Initialize your first salary structure to start modeling your career timeline.</p>
        <button className="salary-btn-primary" onClick={handleInitialize}>INITIALIZE_STRUCTURE</button>
      </div>
    );
  }

  const earnings = activeStructure?.components.filter(c => c.type === 'earning') || [];
  const deductions = activeStructure?.components.filter(c => c.type === 'deduction') || [];

  return (
    <div className="salary-page animate-in">
      <header className="salary-header">
        <div className="salary-title">
          <h1 className="text-headline-md">SALARY_ARCHITECTURE</h1>
          <div className="salary-view-controls">
            <span className="text-label-mono-sm color-muted">MODELING_FOR:</span>
            <select className="salary-month-select" value={viewMonth} onChange={e => setViewMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="salary-btn-action secondary" onClick={() => setShowImport(true)}>
            <span className="material-symbols-outlined icon-xs">auto_awesome</span>
            SMART_IMPORT
          </button>
          <button className="salary-btn-action secondary" onClick={() => setShowDocForm(true)}>
            <span className="material-symbols-outlined icon-xs">upload_file</span>
            UPLOAD_DOC
          </button>
          <button className="salary-btn-action" onClick={handlePostSalary}>
            <span className="material-symbols-outlined icon-sm">send</span>
            POST_{MONTHS[viewMonth]}_SALARY
          </button>
        </div>
      </header>

      <div className="salary-grid">
        <aside className="salary-sidebar">
          <div className="glass-surface-elevated salary-revisions">
            <div className="glass-card-header">
              <span className="text-label-mono color-subtle">REVISIONS_HISTORY</span>
              <button className="salary-btn-add" onClick={() => setShowRevisionForm(true)}>+</button>
            </div>
            <div className="revision-list">
              {revisions.map(rev => (
                <div 
                  key={rev.id} 
                  className={`revision-item ${activeRevisionId === rev.id ? 'active' : ''}`}
                  onClick={() => setActiveRevisionId(rev.id)}
                >
                  <div className="revision-meta">
                    <span className="text-label-mono-sm color-info">{rev.effectiveFrom}</span>
                    <span className="text-body-xs">{rev.companyName}</span>
                  </div>
                  <div className="revision-amount">
                    <span className="text-label-mono-sm">{rev.ctcPaise ? <CurrencyValue paise={rev.ctcPaise} /> : 'N/A'}</span>
                    <button className="revision-del" onClick={(e) => { e.stopPropagation(); deleteRevision(rev.id); }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-surface-elevated salary-documents" style={{ marginTop: '24px' }}>
            <div className="glass-card-header">
              <span className="text-label-mono color-subtle">DOCUMENTS_REGISTRY</span>
            </div>
            <div className="doc-list">
              {documents.length === 0 ? (
                <p className="text-label-mono-xs color-muted" style={{ padding: '16px', textAlign: 'center' }}>NO_DOCS_UPLOADED</p>
              ) : (
                documents.map(doc => (
                  <div key={doc.id} className="doc-item">
                    <div className="doc-info">
                      <span className="text-body-sm">{doc.label}</span>
                      <span className="text-label-mono-xs color-muted">{doc.date}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a href={doc.url} target="_blank" rel="noreferrer" className="doc-btn"><span className="material-symbols-outlined icon-xs">visibility</span></a>
                      <button className="doc-btn color-negative" onClick={() => deleteDocument(doc.id)}><span className="material-symbols-outlined icon-xs">delete</span></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        <main className="salary-main">
          <div className="salary-main-card glass-surface">
            <div className="glass-card-header">
              <span className="text-label-mono color-subtle">EARNINGS // {activeStructure?.effectiveFrom}</span>
              <button className="salary-btn-add" onClick={() => { setShowForm(true); setNewType('earning'); resetForm(); }}>
                <span className="material-symbols-outlined icon-xs">add</span>
              </button>
            </div>
            <div className="salary-comp-list">
              {earnings.map(c => {
                const isActive = !c.applicableMonths || c.applicableMonths.includes(viewMonth);
                return (
                  <div key={c.id} className={`salary-comp-row glass-row ${!isActive ? 'inactive' : ''}`} onClick={() => handleEdit(c)}>
                    <div className="salary-comp-info">
                      <span className="text-body">{c.label}</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="text-label-mono-xs color-muted">{c.category.toUpperCase()}</span>
                        {c.applicableMonths && (
                          <span className="salary-temporal-tag">
                            {c.applicableMonths.map(m => MONTHS[m].slice(0,1)).join(',')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="salary-comp-amount color-positive">
                      <CurrencyValue paise={c.amountPaise} />
                      <button className="salary-comp-del" onClick={(e) => { e.stopPropagation(); removeComponent(c.id); }}>×</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="glass-card-header" style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '24px' }}>
              <span className="text-label-mono color-subtle">DEDUCTIONS</span>
              <button className="salary-btn-add" onClick={() => { setShowForm(true); setNewType('deduction'); resetForm(); }}>
                <span className="material-symbols-outlined icon-xs">add</span>
              </button>
            </div>
            <div className="salary-comp-list">
              {deductions.map(c => {
                const isActive = !c.applicableMonths || c.applicableMonths.includes(viewMonth);
                return (
                  <div key={c.id} className={`salary-comp-row glass-row ${!isActive ? 'inactive' : ''}`} onClick={() => handleEdit(c)}>
                    <div className="salary-comp-info">
                      <span className="text-body">{c.label}</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="text-label-mono-xs color-muted">{c.category.toUpperCase()}</span>
                        {c.applicableMonths && (
                          <span className="salary-temporal-tag">
                            {c.applicableMonths.map(m => MONTHS[m].slice(0,1)).join(',')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="salary-comp-amount color-negative">
                      -<CurrencyValue paise={c.amountPaise} />
                      <button className="salary-comp-del" onClick={(e) => { e.stopPropagation(); removeComponent(c.id); }}>×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="salary-summary-card glass-surface-elevated" style={{ marginTop: '32px' }}>
            <div className="glass-card-header">
              <span className="text-label-mono color-info">FISCAL_PROJECTION // {MONTHS[viewMonth]} {viewYear}</span>
            </div>
            <div className="salary-summary-body" style={{ padding: '24px' }}>
              <div className="salary-view-controls" style={{ marginBottom: '16px' }}>
                <select className="salary-month-select" value={viewMonth} onChange={e => setViewMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select className="salary-month-select" value={viewYear} onChange={e => setViewYear(Number(e.target.value))}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <h2 className="text-headline-lg"><CurrencyValue paise={calculateNet(viewYear, viewMonth)} /></h2>
              <p className="text-label-mono-sm color-muted">
                {isAlreadyPosted ? 'SALARY_ALREADY_RECORDED' : isFutureMonth ? 'SCHEDULED_DISBURSEMENT' : `READY_FOR_DISBURSEMENT`}
              </p>
              
              <div className="salary-post-action" style={{ marginTop: '24px' }}>
                <button 
                  className={`salary-btn-post ${isFutureMonth ? 'disabled' : ''}`}
                  onClick={handlePostSalary}
                  disabled={isFutureMonth}
                >
                  <span className="material-symbols-outlined icon-sm">
                    {isAlreadyPosted ? 'sync' : isFutureMonth ? 'schedule' : 'account_balance_wallet'}
                  </span>
                  {isAlreadyPosted 
                    ? 'SYNC_WITH_LEDGER' 
                    : isFutureMonth 
                      ? 'MONTH_IN_PROGRESS' 
                      : `POST_TO_LEDGER`}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Annual Projection Grid */}
      <div className="glass-surface salary-annual-grid animate-in" style={{ marginTop: '24px' }}>
        <div className="glass-card-header">
          <span className="text-label-mono color-subtle">FISCAL_ANNUAL_OVERVIEW</span>
        </div>
        <div className="salary-annual-body">
          {MONTHS.map((m, i) => {
            const net = calculateNet(viewYear, i);
            const isCurrent = i === viewMonth;
            return (
              <div 
                key={m} 
                className={`salary-annual-month ${isCurrent ? 'active' : ''}`}
                onClick={() => setViewMonth(i)}
              >
                <span className="text-label-mono-sm color-muted">{m}</span>
                <span className={`text-data-display ${net > 0 ? 'color-positive' : 'color-negative'}`} style={{ fontSize: '11px' }}>
                  <CurrencyValue paise={net} />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {showForm && (
        <div className="salary-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="glass-surface-elevated salary-modal premium-modal" onClick={e => e.stopPropagation()}>
            <div className="glass-card-header">
              <span className="text-label-mono color-subtle">{editingId ? 'EDIT_COMPONENT' : 'NEW_COMPONENT'}</span>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            
            <div className="salary-modal-body">
              {/* Type Toggle */}
              <div className="salary-type-toggle">
                <button 
                  className={`toggle-btn ${newType === 'earning' ? 'active earning' : ''}`}
                  onClick={() => setNewType('earning')}
                >
                  <span className="material-symbols-outlined icon-xs">trending_up</span>
                  EARNING
                </button>
                <button 
                  className={`toggle-btn ${newType === 'deduction' ? 'active deduction' : ''}`}
                  onClick={() => setNewType('deduction')}
                >
                  <span className="material-symbols-outlined icon-xs">trending_down</span>
                  DEDUCTION
                </button>
              </div>

              <div className="salary-form-grid">
                <div className="salary-field full">
                  <label className="text-label-mono-sm color-muted">LABEL</label>
                  <input 
                    className="salary-input-premium" 
                    value={newLabel} 
                    onChange={e => setNewLabel(e.target.value)} 
                    placeholder="e.g. Basic Salary, TDS, HRA" 
                  />
                </div>

                <div className="salary-field">
                  <label className="text-label-mono-sm color-muted">AMOUNT (₹)</label>
                  <div className="salary-amount-input-wrapper">
                    <span className="currency-symbol">₹</span>
                    <input 
                      className="salary-input-premium amount" 
                      type="number" 
                      value={newAmount} 
                      onChange={e => setNewAmount(e.target.value)} 
                      placeholder="0.00" 
                    />
                  </div>
                </div>

                <div className="salary-field">
                  <label className="text-label-mono-sm color-muted">CATEGORY</label>
                  <select className="salary-select-premium" value={newCat} onChange={e => setNewCat(e.target.value as any)}>
                    <option value="basic">BASIC</option>
                    <option value="hra">HRA</option>
                    <option value="conveyance">CONVEYANCE</option>
                    <option value="special_allowance">SPECIAL ALLOWANCE</option>
                    <option value="communication">COMMUNICATION</option>
                    <option value="joola_gratuit">JOOLA GRATUIT</option>
                    <option value="lta">LTA</option>
                    <option value="personal_allowance">PERSONAL ALLOWANCE</option>
                    <option value="gratuity">GRATUITY</option>
                    <option value="joola_gratuity_arrears">JOOLA ARREARS</option>
                    <option value="pf">PF</option>
                    <option value="tax">TAX / TDS</option>
                    <option value="other">OTHER</option>
                  </select>
                </div>

                <div className="salary-field full">
                  <label className="text-label-mono-sm color-muted">TEMPORAL_APPLICABILITY</label>
                  <div className="salary-month-grid-premium">
                    {MONTHS.map((m, i) => (
                      <button 
                        key={m} 
                        className={`salary-month-chip-premium ${newMonths.includes(i) ? 'active' : ''}`}
                        onClick={() => toggleMonth(i)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <p className="text-label-mono-xs color-muted" style={{ marginTop: '8px' }}>
                    Leave unselected for permanent monthly components.
                  </p>
                </div>
              </div>
            </div>

            <div className="salary-modal-actions-premium">
              <button className="salary-btn-cancel" onClick={() => setShowForm(false)}>CANCEL</button>
              <button className="salary-btn-save" onClick={handleSaveComponent}>
                {editingId ? 'UPDATE_ENTRY' : 'SAVE_COMPONENT'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showRevisionForm && (
        <div className="salary-modal-overlay" onClick={() => setShowRevisionForm(false)}>
          <div className="glass-surface-elevated salary-modal" onClick={e => e.stopPropagation()}>
            <div className="glass-card-header">
              <span className="text-label-mono">NEW_SALARY_REVISION</span>
            </div>
            <div className="salary-modal-body">
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">EFFECTIVE_FROM (YYYY-MM)</label>
                <input className="salary-input" value={revEffective} onChange={e => setRevEffective(e.target.value)} placeholder="2024-04" />
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">COMPANY_NAME</label>
                <input className="salary-input" value={revCompany} onChange={e => setRevCompany(e.target.value)} placeholder="Company Ltd" />
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">ANNUAL_CTC (₹)</label>
                <input className="salary-input" type="number" value={revCTC} onChange={e => setRevCTC(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="salary-modal-actions">
              <button className="salary-btn-primary" onClick={handleSaveRevision}>CREATE_REVISION</button>
              <button className="salary-btn-secondary" onClick={() => setShowRevisionForm(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {showDocForm && (
        <div className="salary-modal-overlay" onClick={() => setShowDocForm(false)}>
          <div className="glass-surface-elevated salary-modal" onClick={e => e.stopPropagation()}>
            <div className="glass-card-header">
              <span className="text-label-mono">UPLOAD_PROFESSIONAL_DOC</span>
            </div>
            <div className="salary-modal-body">
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">DOCUMENT_LABEL</label>
                <input className="salary-input" value={docLabel} onChange={e => setDocLabel(e.target.value)} placeholder="e.g. Appointment Letter" />
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">DOCUMENT_URL</label>
                <input className="salary-input" value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://drive.google.com/..." />
              </div>
            </div>
            <div className="salary-modal-actions">
              <button className="salary-btn-primary" onClick={handleSaveDoc}>SAVE_DOC_METADATA</button>
              <button className="salary-btn-secondary" onClick={() => setShowDocForm(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
      {showImport && (
        <div className="salary-modal-overlay" onClick={() => setShowImport(false)}>
          <div className="glass-surface-elevated salary-modal premium-modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="glass-card-header">
              <span className="text-label-mono color-subtle">SMART_PAYSLIP_INGESTION</span>
              <button className="modal-close" onClick={() => setShowImport(false)}>×</button>
            </div>
            <div className="salary-modal-body">
              <SmartSalaryImport onComplete={handleSmartImportComplete} onCancel={() => setShowImport(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
