import React, { useState, useRef, useMemo } from 'react';
import { parsePayslip, type ParsedPayslip } from './lib/payslipParser';
import { toPaise, formatINR } from '../../shared/lib/currency';
import { useSalaryStore } from '../../shared/hooks/useSalaryStore';
import { useAppStore } from '../../shared/hooks/useAppStore';
import './Salary.css';

interface BatchResult {
  id: string;
  file: File;
  data: ParsedPayslip | null;
  status: 'pending' | 'analyzing' | 'success' | 'error';
  isDuplicate: boolean;
  error?: string;
  editedMonth?: string;
}

interface Props {
  onComplete: (results: BatchResult[]) => void;
  onCancel: () => void;
}

export function SmartSalaryImport({ onComplete, onCancel }: Props) {
  const [batch, setBatch] = useState<BatchResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  
  const { incomeItems } = useAppStore();
  const { postedMonths } = useSalaryStore();

  const progress = useMemo(() => {
    if (batch.length === 0) return 0;
    const completed = batch.filter(b => b.status === 'success' || b.status === 'error').length;
    return Math.round((completed / batch.length) * 100);
  }, [batch]);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems: BatchResult[] = files.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      data: null,
      status: 'pending',
      isDuplicate: false
    }));

    setBatch(prev => [...prev, ...newItems]);
    setIsProcessing(true);

    for (const item of newItems) {
      setBatch(prev => prev.map(it => it.id === item.id ? { ...it, status: 'analyzing' } : it));
      try {
        const data = await parsePayslip(item.file);
        const isDuplicate = postedMonths.includes(data.month) || 
                          incomeItems.some(i => i.head === 'salary' && i.tags?.includes(`smk:${data.month}`));

        setBatch(prev => prev.map(it => it.id === item.id ? { ...it, data, isDuplicate, status: 'success' } : it));
      } catch (err: any) {
        setBatch(prev => prev.map(it => it.id === item.id ? { ...it, status: 'error', error: err.message } : it));
      }
    }
    setIsProcessing(false);
  };

  const handleArchive = () => {
    const successful = batch.filter(b => b.status === 'success' && b.data);
    if (successful.length > 0) {
      onComplete(successful);
    }
  };

  return (
    <div className="smart-salary-import" style={{ padding: '0px', color: '#fff' }}>
      <div className="salary-dropzone" onClick={() => !isProcessing && fileRef.current?.click()}>
        <input ref={fileRef} type="file" multiple onChange={handleFiles} hidden />
        <span className="material-symbols-outlined icon-lg">cloud_upload</span>
        <p className="text-body-sm">DROP_PAYSLIPS_OR_CLICK_TO_UPLOAD</p>
      </div>

      {batch.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span className="text-label-mono-xs color-muted">ANALYZING_FILES</span>
            <span className="text-label-mono-xs color-info">{progress}%</span>
          </div>
          <div className="si-progress-track">
            <div className="si-progress-fill" style={{ width: `${progress}%` }} />
          </div>

          <div className="salary-batch-list" style={{ marginTop: '20px', maxHeight: '300px', overflowY: 'auto' }}>
            {batch.map(item => (
              <div key={item.id} className={`salary-batch-card ${item.status}`} style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '8px', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, overflow: 'hidden' }}>
                    <span className="text-body-sm truncate" style={{ fontWeight: 600, color: '#fff' }}>{item.file.name}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {item.status === 'analyzing' && <span className="text-label-mono-xs color-info animate-pulse">EXTRACTING...</span>}
                      {item.status === 'error' && <span className="text-label-mono-xs color-negative">{item.error}</span>}
                      {item.status === 'success' && item.data && (
                        <React.Fragment>
                          <input 
                            type="month" 
                            className="salary-input-xs" 
                            value={item.editedMonth || item.data.month} 
                            onChange={(e) => setBatch(b => b.map(x => x.id === item.id ? { ...x, editedMonth: e.target.value } : x))}
                            style={{ background: 'none', border: 'none', color: item.isDuplicate ? 'var(--warning)' : 'var(--info)', fontSize: '10px' }}
                          />
                          {item.isDuplicate && <span className="text-label-mono-xs color-warning">[DUPLICATE]</span>}
                        </React.Fragment>
                      )}
                    </div>
                  </div>
                  {item.status === 'success' && item.data && (
                    <span className="text-label-mono-sm color-positive" style={{ marginLeft: '12px' }}>
                      {formatINR(toPaise(item.data.netPay))}
                    </span>
                  )}
                  <button onClick={() => setBatch(b => b.filter(x => x.id !== item.id))} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginLeft: '12px', fontSize: '18px' }}>×</button>
                </div>
              </div>
            ))}
          </div>

          <div className="salary-batch-actions" style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            <button 
              className="salary-btn-primary" 
              disabled={isProcessing || !batch.some(b => b.status === 'success')}
              onClick={handleArchive}
              style={{ flex: 1 }}
            >
              ARCHIVE_VALIDATED_DATA
            </button>
            <button className="salary-btn-secondary" onClick={onCancel}>CANCEL</button>
          </div>
        </div>
      )}
    </div>
  );
}
