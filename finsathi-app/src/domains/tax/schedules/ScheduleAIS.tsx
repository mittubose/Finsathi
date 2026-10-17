import { useMemo, useState, useRef, useCallback } from 'react';
import { useAppStore } from '../../../shared/hooks/useAppStore';
import { computeAISReconciliation } from '../itr3Engine';
import { NumberInput } from '../../../shared/forms/NumberInput';
import { InfoTooltip } from '../../../shared/ui/InfoTooltip';
import { formatINR } from '../../../shared/lib/currency';
import './schedules.css';

// ============ AIS FILE PARSER ============

interface AISParsedData {
  dividendPaise: number;
  savingsInterestPaise: number;
  fdInterestPaise: number;
  securitiesSalePaise: number;
  securitiesPurchasePaise: number;
  businessTrustIncomePaise: number;
}

/** Maps common AIS field names from CSV/JSON to our internal fields */
const AIS_FIELD_MAP: Record<string, keyof AISParsedData> = {
  'dividend': 'dividendPaise',
  'dividend income': 'dividendPaise',
  'interest from savings': 'savingsInterestPaise',
  'savings bank interest': 'savingsInterestPaise',
  'interest - savings': 'savingsInterestPaise',
  'interest from deposits': 'fdInterestPaise',
  'fixed deposit interest': 'fdInterestPaise',
  'interest - fd': 'fdInterestPaise',
  'interest - term deposit': 'fdInterestPaise',
  'sale of securities': 'securitiesSalePaise',
  'securities sale': 'securitiesSalePaise',
  'purchase of securities': 'securitiesPurchasePaise',
  'securities purchase': 'securitiesPurchasePaise',
  'business trust': 'businessTrustIncomePaise',
  'reit / invit': 'businessTrustIncomePaise',
};

function parseAISAmount(raw: string | number): number {
  if (typeof raw === 'number') return Math.round(raw * 100);
  const cleaned = String(raw).replace(/[₹,\s]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : Math.round(val * 100);
}

function parseAISJSON(text: string): AISParsedData | null {
  try {
    const data = JSON.parse(text);
    const result: AISParsedData = {
      dividendPaise: 0, savingsInterestPaise: 0, fdInterestPaise: 0,
      securitiesSalePaise: 0, securitiesPurchasePaise: 0,
      businessTrustIncomePaise: 0,
    };
    // Handle flat object: { "Dividend": 1234, "Savings Bank Interest": 567 }
    if (!Array.isArray(data)) {
      for (const [key, val] of Object.entries(data)) {
        const mappedField = AIS_FIELD_MAP[key.toLowerCase().trim()];
        if (mappedField) result[mappedField] = parseAISAmount(val as string | number);
      }
      return result;
    }
    // Handle array of { category, amount } rows
    for (const row of data) {
      const cat = String(row.category || row.type || row.information_category || '').toLowerCase().trim();
      const amt = row.amount || row.value || row.total || 0;
      const mappedField = AIS_FIELD_MAP[cat];
      if (mappedField) result[mappedField] += parseAISAmount(amt);
    }
    return result;
  } catch { return null; }
}

function parseAISCSV(text: string): AISParsedData | null {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const catIdx = headers.findIndex(h => ['category', 'type', 'information_category', 'information category'].includes(h));
  const amtIdx = headers.findIndex(h => ['amount', 'value', 'total', 'reported value'].includes(h));
  if (catIdx === -1 || amtIdx === -1) return null;

  const result: AISParsedData = {
    dividendPaise: 0, savingsInterestPaise: 0, fdInterestPaise: 0,
    securitiesSalePaise: 0, securitiesPurchasePaise: 0,
    businessTrustIncomePaise: 0,
  };

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    const cat = (cols[catIdx] || '').toLowerCase().trim();
    const amt = cols[amtIdx] || '0';
    const mappedField = AIS_FIELD_MAP[cat];
    if (mappedField) result[mappedField] += parseAISAmount(amt);
  }
  return result;
}

// ============ ROW CONFIG ============

interface ReconciliationRow {
  label: string;
  tooltip: string;
  aisField: 'dividendPaise' | 'savingsInterestPaise' | 'fdInterestPaise' | 'securitiesSalePaise' | 'securitiesPurchasePaise';
}

const INCOME_ROWS: ReconciliationRow[] = [
  { label: 'Dividend Income', tooltip: 'Total dividend paid to you by companies and mutual funds.', aisField: 'dividendPaise' },
  { label: 'Savings Bank Interest', tooltip: 'Interest from savings accounts. Eligible for 80TTA/80TTB deductions.', aisField: 'savingsInterestPaise' },
  { label: 'Fixed Deposit Interest', tooltip: 'Interest from FDs. Fully taxable under Other Sources.', aisField: 'fdInterestPaise' },
];

const SECURITIES_ROWS: ReconciliationRow[] = [
  { label: 'Sale of Securities', tooltip: 'Total sale value of all equity, MFs, and F&O.', aisField: 'securitiesSalePaise' },
  { label: 'Purchase of Securities', tooltip: 'Total purchase value of all equity, MFs, and F&O.', aisField: 'securitiesPurchasePaise' },
];

// ============ STATUS HELPERS ============

type RowStatus = 'matched' | 'mismatch' | 'not_entered';

function getRowStatus(aisValue: number, mismatch: number): RowStatus {
  if (aisValue === 0) return 'not_entered';
  return mismatch === 0 ? 'matched' : 'mismatch';
}

const STATUS_LABEL: Record<RowStatus, string> = {
  matched: 'MATCHED',
  mismatch: 'MISMATCH',
  not_entered: 'NOT ENTERED',
};

// ============ COMPONENT ============

export function ScheduleAIS() {
  const currentFY = useAppStore(s => s.currentFY);
  const privacyMode = useAppStore(s => s.privacyMode);
  const aisData = useAppStore(s => s.itr3Data.aisData) || {
    dividendPaise: 0, savingsInterestPaise: 0, fdInterestPaise: 0,
    securitiesSalePaise: 0, securitiesPurchasePaise: 0,
    businessTrustIncomePaise: 0,
  };
  const updateITR3Data = useAppStore(s => s.updateITR3Data);
  const incomeItems = useAppStore(s => s.incomeItems);
  const tradeItems = useAppStore(s => s.tradeItems);

  const [dragOver, setDragOver] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateAIS = useCallback((field: keyof typeof aisData, value: number) => {
    updateITR3Data({ aisData: { ...aisData, [field]: value } });
  }, [aisData, updateITR3Data]);

  // Compute ledger totals for current FY
  const fyLedgerTotals = useMemo(() => {
    const [startYearStr, endYearStr] = currentFY.split('-');
    const startYear = parseInt(startYearStr);
    const endYear = 2000 + parseInt(endYearStr);
    const start = new Date(startYear, 3, 1); // April 1 (month is 0-indexed)
    const end = new Date(endYear, 2, 31, 23, 59, 59); // March 31

    let dividendPaise = 0, savingsInterestPaise = 0, fdInterestPaise = 0;
    for (const i of incomeItems) {
      const d = new Date(i.date);
      if (d < start || d > end) continue;
      const text = `${i.source} ${i.notes} ${(i.tags || []).join(' ')}`.toLowerCase();
      if (i.head === 'dividend' || text.includes('dividend')) {
        dividendPaise += i.amountPaise;
      } else if (i.head === 'interest') {
        if (text.includes('fd') || text.includes('fixed deposit')) fdInterestPaise += i.amountPaise;
        else savingsInterestPaise += i.amountPaise;
      }
    }

    let securitiesSalePaise = 0, securitiesPurchasePaise = 0;
    for (const t of tradeItems) {
      const d = new Date(t.sellDate);
      if (d < start || d > end) continue;
      securitiesSalePaise += t.sellPricePaise * t.qty;
      securitiesPurchasePaise += t.buyPricePaise * t.qty;
    }

    return { dividendPaise, savingsInterestPaise, fdInterestPaise, securitiesSalePaise, securitiesPurchasePaise };
  }, [incomeItems, tradeItems, currentFY]);

  const reconciliation = useMemo(
    () => computeAISReconciliation(aisData, fyLedgerTotals),
    [aisData, fyLedgerTotals]
  );

  // ============ FILE IMPORT ============

  const processFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['json', 'csv'].includes(ext)) {
      setImportStatus('Unsupported format. Please upload a CSV or JSON file from the IT portal.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = ext === 'json' ? parseAISJSON(text) : parseAISCSV(text);
      if (!parsed) {
        setImportStatus('Could not parse file. Check the format matches the AIS download from incometax.gov.in.');
        return;
      }
      updateITR3Data({
        aisData: {
          ...aisData,
          ...parsed,
        }
      });
      setImportStatus(`Imported ${file.name} successfully.`);
    };
    reader.onerror = () => setImportStatus('Error reading file.');
    reader.readAsText(file);
  }, [aisData, updateITR3Data]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = ''; // reset for re-upload
  }, [processFile]);

  // ============ RENDER HELPERS ============

  const mismatchMap: Record<string, number> = {
    dividendPaise: reconciliation.dividendMismatchPaise,
    savingsInterestPaise: reconciliation.savingsMismatchPaise,
    fdInterestPaise: reconciliation.fdMismatchPaise,
    securitiesSalePaise: reconciliation.securitiesSaleMismatchPaise,
    securitiesPurchasePaise: reconciliation.securitiesPurchaseMismatchPaise,
  };

  const mask = (paise: number) => privacyMode ? '₹ •••••' : formatINR(paise);

  const renderSection = (title: string, rows: ReconciliationRow[]) => (
    <div className="schedule-section">
      <h2 className="schedule-section-title">{title}</h2>
      <div className="schedule-card">
        <div className="schedule-card-body">
          <table className="ais-table" role="table" aria-label={title}>
            <thead>
              <tr>
                <th scope="col" className="schedule-field-label">Category</th>
                <th scope="col" className="schedule-field-label">AIS Value</th>
                <th scope="col" className="schedule-field-label ais-col-right">Ledger</th>
                <th scope="col" className="schedule-field-label ais-col-right">Variance</th>
                <th scope="col" className="schedule-field-label ais-col-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const mismatch = mismatchMap[row.aisField];
                const status = getRowStatus(aisData[row.aisField], mismatch);
                return (
                  <tr key={row.aisField}>
                    <td className="schedule-field-label">
                      {row.label}
                      <InfoTooltip title={row.label} description={row.tooltip} />
                    </td>
                    <td>
                      <NumberInput
                        value={aisData[row.aisField]}
                        onChange={(val) => updateAIS(row.aisField, val)}
                        label=""
                        ariaLabel={`${row.label} from AIS`}
                        placeholder="From AIS"
                      />
                    </td>
                    <td className="ais-col-right">
                      <span className="schedule-field-value">{mask(fyLedgerTotals[row.aisField])}</span>
                    </td>
                    <td className="ais-col-right">
                      <span className={`schedule-field-value ais-variance-${status}`}>
                        {mismatch > 0 ? '+' : (mismatch < 0 ? '-' : '')}{mask(Math.abs(mismatch))}
                      </span>
                    </td>
                    <td className="ais-col-right">
                      <span className={`ais-status-badge ais-status-${status}`}>
                        {status === 'mismatch' && <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px' }}>warning</span>}
                        {status === 'matched' && <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px' }}>check_circle</span>}
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="schedule-page">
      <div className="schedule-header">
        <div>
          <h1 className="schedule-page-title">AIS RECONCILIATION</h1>
          <p className="schedule-page-subtitle">Annual Information Statement Check</p>
        </div>
        <div className="wizard-fy-badge">FY {currentFY}</div>
      </div>

      {/* File Import Drop Zone */}
      <div className="schedule-section">
        <h2 className="schedule-section-title">IMPORT AIS DATA</h2>
        <div
          className={`ais-dropzone ${dragOver ? 'ais-dropzone--over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
          aria-label="Upload AIS file"
        >
          <input ref={fileRef} type="file" accept=".csv,.json" onChange={handleFileInput} hidden aria-hidden="true" />
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '32px', opacity: 0.4 }}>upload_file</span>
          <p className="ais-dropzone-title">Drop AIS file here or click to browse</p>
          <p className="ais-dropzone-hint">Supports: CSV, JSON from incometax.gov.in</p>
        </div>
        {importStatus && (
          <div className={`ais-import-status ${importStatus.includes('successfully') ? 'ais-import-success' : 'ais-import-error'}`} role="status">
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '16px' }}>
              {importStatus.includes('successfully') ? 'check_circle' : 'error'}
            </span>
            {importStatus}
          </div>
        )}
      </div>

      {/* Mismatch Warning */}
      {reconciliation.isMismatch && (
        <div className="audit-warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">warning</span>
          <div>
            <strong>AIS Mismatch Detected</strong>
            <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
              Your internal ledger does not match the AIS data. The Income Tax Department will flag these discrepancies.
              Correct your ledger entries before filing.
            </p>
          </div>
        </div>
      )}

      {renderSection('INCOME RECONCILIATION', INCOME_ROWS)}
      {renderSection('SECURITIES RECONCILIATION (TURNOVER)', SECURITIES_ROWS)}
    </div>
  );
}
