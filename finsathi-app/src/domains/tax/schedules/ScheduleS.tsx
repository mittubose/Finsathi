import { useAppStore } from '../../../shared/hooks/useAppStore';
import { InfoTooltip } from '../../../shared/ui/InfoTooltip';
import './schedules.css';

export function ScheduleS() {
  const currentFY = useAppStore(s => s.currentFY);
  const itr3Data = useAppStore(s => s.itr3Data);
  const updateITR3Data = useAppStore(s => s.updateITR3Data);
  const privacyMode = useAppStore(s => s.privacyMode);

  const incomeItems = useAppStore(s => s.incomeItems);
  
  const salaryData = itr3Data.salaryData || {
    basicPaise: 0,
    hraPaise: 0,
    specialAllowancePaise: 0,
    conveyancePaise: 0,
    ltaPaise: 0,
    bonusPaise: 0,
    otherTaxablePaise: 0,
    employerPfPaise: 0,
    professionTaxPaise: 0
  };

  const updateSalary = (key: string, val: string) => {
    const num = Math.floor(parseFloat(val) * 100) || 0;
    updateITR3Data({
      salaryData: {
        ...salaryData,
        [key]: num
      }
    });
  };

  const updateTDS = (val: string) => {
    const num = Math.floor(parseFloat(val) * 100) || 0;
    updateITR3Data({ tdsData: num });
  };

  const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
  const displayVal = (paise: number) => privacyMode ? '₹ •••••' : fmt(paise);

  const grossSalary = Object.keys(salaryData).reduce((sum, key) => {
    if (key === 'professionTaxPaise') return sum;
    return sum + ((salaryData as any)[key] || 0);
  }, 0);

  // Sync from ledger function
  const handleSyncFromLedger = () => {
    // Determine start/end dates for currentFY (e.g. "2023-24")
    const [startYearStr, endYearStr] = currentFY.split('-');
    const startYear = parseInt(startYearStr);
    const endYear = 2000 + parseInt(endYearStr); // Assumes 21st century

    const start = new Date(`${startYear}-04-01T00:00:00Z`);
    const end = new Date(`${endYear}-03-31T23:59:59Z`);

    const fySalaryItems = incomeItems
      .filter(i => i.head === 'salary')
      .filter(i => {
        const d = new Date(i.date);
        return d >= start && d <= end;
      });

    if (fySalaryItems.length === 0) {
      alert("No salary income found in the ledger for this Financial Year.");
      return;
    }

    const newSalaryData = {
      basicPaise: 0,
      hraPaise: 0,
      specialAllowancePaise: 0,
      conveyancePaise: 0,
      ltaPaise: 0,
      bonusPaise: 0,
      otherTaxablePaise: 0,
      employerPfPaise: 0,
      professionTaxPaise: salaryData.professionTaxPaise || 0, // Keep existing if any
    };

    fySalaryItems.forEach(item => {
      const textToMatch = `${item.source} ${item.notes} ${(item.tags || []).join(' ')}`.toLowerCase();

      if (textToMatch.includes('hra') || textToMatch.includes('house rent')) {
        newSalaryData.hraPaise += item.amountPaise;
      } else if (textToMatch.includes('pf') || textToMatch.includes('provident')) {
        newSalaryData.employerPfPaise += item.amountPaise;
      } else if (textToMatch.includes('bonus') || textToMatch.includes('leave encashment')) {
        newSalaryData.bonusPaise += item.amountPaise;
      } else if (textToMatch.includes('special allowance')) {
        newSalaryData.specialAllowancePaise += item.amountPaise;
      } else if (textToMatch.includes('allowance')) {
        newSalaryData.otherTaxablePaise += item.amountPaise;
      } else {
        // Default to basic if no specific component matched
        newSalaryData.basicPaise += item.amountPaise;
      }
    });

    updateITR3Data({
      salaryData: newSalaryData
    });

    const totalSynced = Object.values(newSalaryData).reduce((sum, val) => sum + val, 0) - newSalaryData.professionTaxPaise;
    alert(`Successfully synced ₹${(totalSynced / 100).toLocaleString('en-IN')} across different salary components from the ledger!`);
  };

  return (
    <div className="schedule-page">
      <div className="schedule-header">
        <div>
          <h1 className="schedule-page-title">SCHEDULE S</h1>
          <div className="schedule-page-subtitle">Salary Income & TDS</div>
        </div>
        <div className="wizard-fy-badge">FY {currentFY}</div>
      </div>

      <div className="schedule-section">
        <div className="schedule-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>SALARY BREAKUP (FROM FORM 16)</span>
          <button className="wizard-nav-btn" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={handleSyncFromLedger}>
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', marginRight: '4px' }}>sync</span>
            SYNC FROM LEDGER
          </button>
        </div>
        <div className="schedule-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          
          <div className="tax-field">
            <label className="schedule-field-label">
              Basic Salary
              <InfoTooltip 
                title="Basic Salary" 
                description="The core of your salary before any allowances or deductions. This is fully taxable."
                dateContext="Total amount received in the financial year (1st Apr to 31st Mar)."
                example="If basic is ₹50,000/month, enter ₹6,00,000 here."
              />
            </label>
            <input 
              type="number" 
              className="wizard-select" 
              style={{ width: '100%', marginTop: '8px' }}
              value={(salaryData.basicPaise || 0) / 100 || ''}
              onChange={e => updateSalary('basicPaise', e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="tax-field">
            <label className="schedule-field-label">
              HRA
              <InfoTooltip 
                title="House Rent Allowance" 
                description="Allowance given by employer to meet rent expenses. The exemption is calculated automatically if you have rent payments."
                dateContext="Financial year (1st Apr to 31st Mar)"
                example="Received ₹20,000/month as HRA? Enter ₹2,40,000."
              />
            </label>
            <input 
              type="number" 
              className="wizard-select" 
              style={{ width: '100%', marginTop: '8px' }}
              value={(salaryData.hraPaise || 0) / 100 || ''}
              onChange={e => updateSalary('hraPaise', e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="tax-field">
            <label className="schedule-field-label">
              Special Allowance
              <InfoTooltip 
                title="Special Allowance" 
                description="A fixed allowance given by employers that doesn't fall under specific exemptions. It is fully taxable."
                example="Entered as a generic 'Special Allowance' on your payslip."
              />
            </label>
            <input 
              type="number" 
              className="wizard-select" 
              style={{ width: '100%', marginTop: '8px' }}
              value={(salaryData.specialAllowancePaise || 0) / 100 || ''}
              onChange={e => updateSalary('specialAllowancePaise', e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="tax-field">
            <label className="schedule-field-label">
              Bonus / Leave Encashment
              <InfoTooltip 
                title="Bonus / Leave Encashment" 
                description="Performance bonuses or cash received in lieu of unused leaves during employment. Fully taxable on receipt."
                dateContext="Amounts received between 1st Apr and 31st Mar."
              />
            </label>
            <input 
              type="number" 
              className="wizard-select" 
              style={{ width: '100%', marginTop: '8px' }}
              value={(salaryData.bonusPaise || 0) / 100 || ''}
              onChange={e => updateSalary('bonusPaise', e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="tax-field">
            <label className="schedule-field-label">
              Employer PF Contribution
              <InfoTooltip 
                title="Employer PF" 
                description="The employer's contribution to your Provident Fund. While generally tax-free up to 12% of basic, include it here if it's part of your gross taxable salary on Form 16."
              />
            </label>
            <input 
              type="number" 
              className="wizard-select" 
              style={{ width: '100%', marginTop: '8px' }}
              value={(salaryData.employerPfPaise || 0) / 100 || ''}
              onChange={e => updateSalary('employerPfPaise', e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="tax-field">
            <label className="schedule-field-label">
              Other Taxable Allowances
              <InfoTooltip 
                title="Other Allowances" 
                description="Any other taxable components like Medical, LTA (if unexempted), Internet, or joining bonus."
              />
            </label>
            <input 
              type="number" 
              className="wizard-select" 
              style={{ width: '100%', marginTop: '8px' }}
              value={(salaryData.otherTaxablePaise || 0) / 100 || ''}
              onChange={e => updateSalary('otherTaxablePaise', e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div className="schedule-summary-row" style={{ marginTop: '24px', background: 'rgba(255,255,255,0.05)', padding: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="schedule-field-label">GROSS SALARY</span>
          <span className="schedule-field-value" style={{ color: '#00ff41' }}>{displayVal(grossSalary)}</span>
        </div>
      </div>

      <div className="schedule-section">
        <div className="schedule-section-title">PROFESSION TAX & TDS</div>
        <div className="schedule-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          
          <div className="tax-field">
            <label className="schedule-field-label">
              Profession Tax Paid (Sec 16)
              <InfoTooltip 
                title="Profession Tax (Sec 16)" 
                description="State-level tax deducted by your employer. It is allowed as a deduction from your gross salary."
                example="Usually ₹200/month or ₹2,500/year depending on your state."
              />
            </label>
            <input 
              type="number" 
              className="wizard-select" 
              style={{ width: '100%', marginTop: '8px' }}
              value={(salaryData.professionTaxPaise || 0) / 100 || ''}
              onChange={e => updateSalary('professionTaxPaise', e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="tax-field">
            <label className="schedule-field-label">
              Total TDS Deducted
              <InfoTooltip 
                title="TDS Deducted" 
                description="Total Tax Deducted at Source by your employer from your salary during the financial year."
                dateContext="Check your Form 16 Part A for this exact amount."
              />
            </label>
            <input 
              type="number" 
              className="wizard-select" 
              style={{ width: '100%', marginTop: '8px', borderColor: '#00ff41' }}
              value={(itr3Data.tdsData || 0) / 100 || ''}
              onChange={e => updateTDS(e.target.value)}
              placeholder="0"
            />
          </div>

        </div>
      </div>

      <div className="assumption-list">
        <div className="schedule-section-title">NOTES & ASSUMPTIONS</div>
        <div className="assumption-item">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>circle</span>
          Standard Deduction of ₹50,000 (Old) or ₹75,000 (New) is applied automatically in the final computation.
        </div>
        <div className="assumption-item">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>circle</span>
          HRA exemption is calculated separately during final computation.
        </div>
      </div>
    </div>
  );
}
