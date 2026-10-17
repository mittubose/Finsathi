import React, { useState, useRef, useCallback } from 'react';
import { detectDocument, type DetectionResult, type ExtractedField } from './idu/documentIntelligence';
import { auditLog } from '../../shared/hooks/useAuditStore';
import { useAppStore, type ImportSession } from '../../shared/hooks/useAppStore';
import { toPaise } from '../../shared/lib/currency';
import './SmartImport.css';

type Step = 'upload' | 'analyzing' | 'review' | 'done';

const INTENT_ICON: Record<string, string> = {
  payslip: 'badge',
  form16: 'description',
  bank_statement: 'account_balance',
  broker_statement: 'query_stats',
  utility_bill: 'electric_bolt',
  subscription_invoice: 'receipt_long',
  tax_notice: 'gavel',
  unknown: 'help_outline',
};

const INTENT_COLOR: Record<string, string> = {
  payslip: 'positive',
  form16: 'positive',
  bank_statement: 'info',
  broker_statement: 'info',
  utility_bill: 'warning',
  subscription_invoice: 'warning',
  tax_notice: 'negative',
  unknown: 'muted',
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 75 ? 'var(--primary-container)' : value >= 50 ? 'var(--secondary-container)' : 'var(--error)';
  return (
    <div className="si-conf-bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={`Confidence level: ${value}%`}>
      <div className="si-conf-track">
        <div className="si-conf-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-label-mono-sm" style={{ color, minWidth: '30px', textAlign: 'right' }}>{value}%</span>
    </div>
  );
}

function FieldRow({
  field,
  onValueChange,
}: {
  field: ExtractedField;
  onValueChange: (key: string, val: string) => void;
}) {
  const isLowConf = field.confidence < 60;
  const isMedConf = field.confidence >= 60 && field.confidence < 80;

  return (
    <div className={`si-field-row ${isLowConf ? 'si-field-row--low' : isMedConf ? 'si-field-row--med' : ''}`}>
      <div className="si-field-meta">
        <span className="text-label-mono-sm color-muted">{field.label}</span>
        <ConfidenceBar value={field.confidence} />
        <span className="text-label-mono-sm si-field-source">{field.source}</span>
      </div>
      <div className="si-field-input-wrap">
        {isLowConf && (
          <span className="material-symbols-outlined si-field-warn-icon icon-xs" title="Low confidence — please verify">
            warning
          </span>
        )}
        <input
          className="si-field-input"
          type="text"
          defaultValue={String(field.value ?? '')}
          onChange={(e) => onValueChange(field.key, e.target.value)}
        />
      </div>
      <div className="si-field-raw text-label-mono-sm color-muted truncate" title={field.rawValue}>
        {field.rawValue}
      </div>
    </div>
  );
}

export function SmartImport({ 
  onConfirm,
  onBatchConfirm,
  onCheckDuplicate,
  extraReviewContent 
}: { 
  onConfirm?: (result: DetectionResult, confirmedFields: Record<string, string>) => void,
  onBatchConfirm?: (records: any[]) => string[], // Returns IDs of created trades
  onCheckDuplicate?: (record: any) => 'new' | 'duplicate' | 'conflict',
  extraReviewContent?: React.ReactNode
}) {
  const { addImportSession, importHistory, undoImport, addExpense, addIncome, currentFY } = useAppStore();
  const [step, setStep] = useState<Step>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [confirmedFields, setConfirmedFields] = useState<Record<string, string>>({});
  const [batchRecords, setBatchRecords] = useState<any[]>([]);
  const [saveSummaryAsLedger, setSaveSummaryAsLedger] = useState(true);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setStep('analyzing');
    setError('');
    try {
      const detection = await detectDocument(file);
      setResult(detection);
      
      const initialFields: Record<string, string> = {};
      detection.fields.forEach((f) => { initialFields[f.key] = String(f.value ?? ''); });
      setConfirmedFields(initialFields);

      if (detection.records) {
        const enriched = detection.records.map((rec, i) => ({
          ...rec,
          id: `rec-${i}-${Math.random().toString(36).substr(2, 5)}`,
          status: onCheckDuplicate ? onCheckDuplicate(rec) : 'new',
          selected: (onCheckDuplicate ? onCheckDuplicate(rec) : 'new') !== 'duplicate'
        }));
        setBatchRecords(enriched);
      } else {
        setBatchRecords([]);
      }

      setStep('review');
    } catch (e) {
      setError('Analysis failed. Please try again or use manual CSV import.');
      setStep('upload');
    }
  }, [onCheckDuplicate]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleConfirm = () => {
    if (!result) return;
    
    const session: ImportSession = {
      id: `session-${Date.now()}`,
      date: new Date().toISOString(),
      fileName: fileName,
      intent: result.intentLabel,
      fileType: result.fileType,
      format: result.format,
      rowCount: batchRecords.length || 1,
      recordIds: { trades: [], income: [], expenses: [] },
      summary: result.summarizedData || {}
    };

    if (batchRecords.length > 0) {
      if (onBatchConfirm) {
        const createdIds = onBatchConfirm(batchRecords.filter(r => r.selected));
        session.recordIds.trades = createdIds;
      }
    } else if (onConfirm) {
      onConfirm(result, confirmedFields);
    }

    // Handle Summary to Ledger
    if (saveSummaryAsLedger && result.summarizedData) {
      const date = new Date().toISOString().split('T')[0];
      if (result.summarizedData['Charges']) {
        const expId = `exp-${Math.random().toString(36).substr(2, 9)}`;
        addExpense({
          id: expId,
          type: 'expense',
          category: 'Trading Charges',
          amountPaise: toPaise(Number(result.summarizedData['Charges'])),
          date,
          merchant: result.intentLabel,
          notes: `Imported from ${fileName}`,
          tags: ['automated', 'trading'],
          isRecurring: false,
          createdAt: new Date().toISOString()
        });
        session.recordIds.expenses.push(expId);
      }
      if (result.summarizedData['Dividends']) {
        const incId = `inc-${Math.random().toString(36).substr(2, 9)}`;
        addIncome({
          id: incId,
          type: 'income',
          head: 'dividend',
          amountPaise: toPaise(Number(result.summarizedData['Dividends'])),
          source: 'Stock Portfolio',
          fy: currentFY,
          isTaxable: true,
          notes: `Imported from ${fileName}`,
          tags: ['automated', 'dividend'],
          date,
          createdAt: new Date().toISOString()
        });
        session.recordIds.income.push(incId);
      }
    }

    addImportSession(session);
    auditLog({
      action: 'IMPORT',
      entity: 'import',
      label: `Smart import confirmed: ${result.intentLabel}`,
      details: `File: ${fileName} · Records: ${batchRecords.length || 1} · Confidence: ${result.confidence}%`,
    });
    setStep('done');
  };

  const handleReset = () => {
    setStep('upload');
    setResult(null);
    setFileName('');
    setConfirmedFields({});
    setBatchRecords([]);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const toggleRecord = (id: string) => {
    setBatchRecords(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  return (
    <div className="smart-import">
      <div className="si-steps">
        {(['upload', 'analyzing', 'review', 'done'] as Step[]).map((s, i) => (
          <div key={s} className={`si-step ${step === s ? 'active' : ['analyzing', 'review', 'done'].indexOf(step) > i - 1 || step === 'done' ? 'done' : ''}`}>
            <div className="si-step-dot">{i + 1}</div>
            <span className="text-label-mono-sm">{s.toUpperCase()}</span>
          </div>
        ))}
      </div>

      {step === 'upload' && (
        <div className="si-upload-wrapper">
          <div
            className={`glass-surface si-dropzone ${dragOver ? 'si-dropzone--over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.txt,.docx" onChange={handleFileInput} hidden />
            <span className="material-symbols-outlined si-upload-icon" style={{ fontVariationSettings: "'wght' 200" }}>upload_file</span>
            <p className="text-headline-sm si-upload-title">DROP_FILE_HERE</p>
            <p className="text-label-mono-sm color-muted si-upload-hint">Supports: CSV · Excel · PDF · Image</p>
          </div>

          {importHistory.length > 0 && (
            <div className="glass-surface si-history animate-in">
              <div className="glass-card-header"><span className="text-label-mono-sm color-muted">RECENT_IMPORTS</span></div>
              <div className="si-history-list">
                {importHistory.slice(0, 10).map(session => (
                  <div key={session.id} className="si-history-item">
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <p className="text-body" style={{ fontWeight: 600, fontSize: '11px' }}>{session.fileName}</p>
                        <span className="text-label-mono-sm si-format-badge">{session.format}</span>
                      </div>
                      <div className="si-history-meta">
                        <span className="text-label-mono-sm color-positive">{session.fileType?.toUpperCase()}</span>
                        <span className="si-meta-dot" />
                        <span className="text-label-mono-sm color-muted">{session.rowCount || 0} RECORDS</span>
                        <span className="si-meta-dot" />
                        <span className="text-label-mono-sm color-muted">{new Date(session.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button className="si-history-undo" onClick={() => undoImport(session.id)} title="Revert all changes from this import">
                      <span className="material-symbols-outlined icon-xs">undo</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'analyzing' && (
        <div className="glass-surface si-analyzing">
          <div className="si-spinner" />
          <p className="text-label-mono color-positive" style={{ marginTop: '16px' }}>ANALYZING_DOCUMENT...</p>
        </div>
      )}

      {step === 'review' && result && (
        <div className="si-review animate-in">
          {batchRecords.some(r => r.status === 'conflict') && (
            <div className="glass-surface si-intent-banner si-intent-banner--negative">
              <div className="si-intent-icon" style={{ color: 'var(--error)' }}><span className="material-symbols-outlined">warning</span></div>
              <div className="si-intent-info">
                <span className="text-label-mono color-negative">DATA_CONFLICT_DETECTED</span>
                <p className="text-body" style={{ marginTop: '4px', fontSize: '11px' }}>Records already exist but have different prices. Review carefully.</p>
              </div>
            </div>
          )}

          <div className={`glass-surface si-intent-banner si-intent-banner--${INTENT_COLOR[result.intent]}`}>
            <div className="si-intent-icon"><span className="material-symbols-outlined" style={{ fontSize: '28px' }}>{INTENT_ICON[result.intent]}</span></div>
            <div className="si-intent-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="text-label-mono color-positive">{result.intentLabel.toUpperCase()}</span>
                <ConfidenceBar value={result.confidence} />
              </div>
              <p className="text-body" style={{ marginTop: '4px', fontSize: '12px' }}>{result.intentDescription}</p>
            </div>
          </div>

          {result.summarizedData && Object.keys(result.summarizedData).length > 0 && (
            <div className="glass-surface si-summary-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div className="text-label-mono-sm color-subtle">DOCUMENT_SUMMARY</div>
                <label className="si-summary-toggle">
                  <input type="checkbox" checked={saveSummaryAsLedger} onChange={e => setSaveSummaryAsLedger(e.target.checked)} />
                  <span className="text-label-mono-sm color-muted">SAVE_SUMMARIES_TO_LEDGER</span>
                </label>
              </div>
              <div className="si-summary-grid">
                {Object.entries(result.summarizedData).map(([key, val]) => (
                  <div key={key} className="si-summary-item">
                    <span className="text-label-mono-sm color-muted">{key.toUpperCase()}</span>
                    <span className={`text-data-display ${typeof val === 'number' && val < 0 ? 'color-negative' : 'color-positive'}`}>
                      {typeof val === 'number' ? `₹${val.toLocaleString()}` : String(val ?? '')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.mappingReport && (
            <div className="glass-surface si-mapping-panel animate-in">
              <div className="glass-card-header">
                <span className="text-label-mono-sm color-subtle">MAPPING_INSPECTOR</span>
                <span className="text-label-mono-sm color-muted" style={{ fontSize: '9px' }}>VERIFY_COLUMN_ALIGNMENT</span>
              </div>
              <div className="si-mapping-grid">
                {Object.entries(result.mappingReport).map(([key, index]) => (
                  <div key={key} className="si-mapping-chip">
                    <span className="text-label-mono-sm color-info">{key.toUpperCase()}</span>
                    <span className="si-mapping-arrow">→</span>
                    <span className="text-label-mono-sm">COL_{String(index)}</span>
                  </div>
                ))}
              </div>
              <p className="text-label-mono-sm color-muted" style={{ marginTop: '8px', fontSize: '9px' }}>
                If columns seem wrong, ensure your file has headers like "Quantity", "Buy Price", or "ISIN".
              </p>
            </div>
          )}

          {extraReviewContent}

          {batchRecords.length > 0 ? (
            <div className="glass-surface si-batch-panel">
              <div className="glass-card-header">
                <h2 className="text-label-mono color-subtle">EXTRACTED_TRADES</h2>
                <div className="si-batch-stats">
                  <span className="text-label-mono-sm color-positive">{batchRecords.filter(r => r.status === 'new').length} NEW</span>
                  <span className="text-label-mono-sm color-warning">{batchRecords.filter(r => r.status === 'duplicate').length} DUPS</span>
                </div>
              </div>
              <div className="si-batch-table">
                <div className="si-batch-header">
                  <div className="si-checkbox-wrap">
                    <input type="checkbox" checked={batchRecords.every(r => r.selected)} onChange={(e) => {
                      const checked = e.target.checked;
                      setBatchRecords(prev => prev.map(r => ({ ...r, selected: checked })));
                    }} />
                  </div>
                  <span style={{ flex: 2 }}>INSTRUMENT</span>
                  <span style={{ flex: 1.5 }}>DATE</span>
                  <span style={{ flex: 1 }}>QTY</span>
                  <span style={{ flex: 1.5, textAlign: 'right' }}>P&L</span>
                  <span style={{ width: '80px', textAlign: 'right' }}>STATUS</span>
                </div>
                <div className="si-batch-list">
                  {batchRecords.map((rec) => (
                    <div key={rec.id} className={`si-batch-row ${rec.status === 'duplicate' ? 'si-row--muted' : ''}`} onClick={() => toggleRecord(rec.id)}>
                      <div className="si-checkbox-wrap"><input type="checkbox" checked={rec.selected} readOnly /></div>
                      <div className="text-body" style={{ flex: 2, fontWeight: 600 }}>{rec.instrument}</div>
                      <div className="text-label-mono-sm color-muted" style={{ flex: 1.5 }}>{rec.sellDate || rec.buyDate}</div>
                      <div className="text-data-display" style={{ flex: 1 }}>{rec.qty}</div>
                      <div className={`text-data-display ${rec.pnl >= 0 ? 'color-positive' : 'color-negative'}`} style={{ flex: 1.5, textAlign: 'right' }}>
                        ₹{Math.round(rec.pnl).toLocaleString()}
                      </div>
                      <div style={{ width: '80px', textAlign: 'right' }}><span className={`si-status-badge si-status--${rec.status}`}>{rec.status.toUpperCase()}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : result.fields.length > 0 && (
            <div className="glass-surface si-fields-panel">
              <div className="si-fields-list">
                {result.fields.map((f) => (
                  <FieldRow key={f.key} field={f} onValueChange={(key, val) => setConfirmedFields((prev) => ({ ...prev, [key]: val }))} />
                ))}
              </div>
            </div>
          )}

          <div className="si-action-row">
            <div>
              <p className="text-label-mono-sm color-muted">File: {fileName}</p>
              <p className="text-label-mono-sm color-muted">{batchRecords.length} records found</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="si-back-btn" onClick={handleReset}>START_OVER</button>
              <button className="si-confirm-btn" onClick={handleConfirm}>
                {batchRecords.length > 0 ? `IMPORT_SELECTED (${batchRecords.filter(r => r.selected).length})` : 'CONFIRM_IMPORT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="glass-surface si-done">
          <span className="material-symbols-outlined si-done-icon">task_alt</span>
          <p className="text-headline-sm" style={{ marginTop: '16px' }}>INGESTION_COMPLETE</p>
          <p className="text-body color-muted" style={{ marginTop: '4px', fontSize: '12px' }}>Session archived. All records are now in your ledger.</p>
          <button className="si-confirm-btn" style={{ marginTop: '20px' }} onClick={handleReset}>IMPORT_ANOTHER</button>
        </div>
      )}
    </div>
  );
}
