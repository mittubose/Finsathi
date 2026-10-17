import { useState, useMemo } from 'react';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { formatINRMasked } from '../../shared/lib/currency';
import {
  computeITR3Tax,
  generatePortalFieldMappings,
  type ITR3TradeInput,
  type ITR3FilingData,
  type AssetType,
} from './itr3Engine';
import { ScheduleBookkeeping } from './schedules/ScheduleBookkeeping';
import './ITR3Wizard.css';

// ============ WIZARD STEP DEFINITIONS ============

interface WizardStep {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
  scheduleName: string;
}

const WIZARD_STEPS: WizardStep[] = [
  { id: 'general', label: 'General Information', shortLabel: 'General', icon: 'person', scheduleName: 'General' },
  { id: 'ais', label: 'AIS Reconciliation', shortLabel: 'AIS Check', icon: 'receipt_long', scheduleName: 'Schedule AIS' },
  { id: 'salary', label: 'Schedule S: Salary', shortLabel: 'Salary', icon: 'payments', scheduleName: 'Schedule S' },
  { id: 'house_property', label: 'Schedule HP: House Property', shortLabel: 'House', icon: 'home', scheduleName: 'Schedule HP' },
  { id: 'bookkeeping', label: 'Bookkeeping & Balance Sheet', shortLabel: 'Books', icon: 'account_balance', scheduleName: 'Bookkeeping' },
  { id: 'business', label: 'Schedule BP: Business/Profession', shortLabel: 'Business', icon: 'business_center', scheduleName: 'Schedule BP' },
  { id: 'capital_gains', label: 'Schedule CG: Capital Gains', shortLabel: 'Cap Gains', icon: 'trending_up', scheduleName: 'Schedule CG' },
  { id: 'other_sources', label: 'Schedule OS: Other Sources', shortLabel: 'Other', icon: 'account_balance', scheduleName: 'Schedule OS' },
  { id: 'deductions', label: 'Schedule VI-A: Deductions', shortLabel: 'Deductions', icon: 'savings', scheduleName: 'Schedule VI-A' },
  { id: 'tax_computation', label: 'Tax Computation', shortLabel: 'Tax', icon: 'calculate', scheduleName: 'Tax Computation' },
  { id: 'verification', label: 'Verification & Export', shortLabel: 'Verify', icon: 'verified', scheduleName: 'Verification' },
];

// ============ HELPERS ============

function fmt(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

/** Convert store TradeItem to ITR3TradeInput */
function toITR3TradeInput(trade: ReturnType<typeof useAppStore.getState>['tradeItems'][number]): ITR3TradeInput {
  // Legacy 'mf' -> 'equity_mf' mapping
  let assetType: AssetType = trade.assetType === 'mf' ? 'equity_mf' : trade.assetType as AssetType;
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

// ============ MAIN COMPONENT ============

export function ITR3Wizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const tradeItems = useAppStore((s) => s.tradeItems);
  // Component state
  const currentFY = useAppStore((s) => s.currentFY);
  const preferredRegime = useAppStore((s) => s.preferredRegime);
  const privacyMode = useAppStore((s) => s.privacyMode);
  const itr3Data = useAppStore((s) => s.itr3Data);
  const setFilingProgress = useAppStore((s) => s.setFilingProgress);

  // Filter trades for current FY
  const fyTrades = useMemo(() => {
    const fyStart = parseInt(currentFY.split('-')[0]);
    const start = new Date(fyStart, 3, 1); // April 1
    const end = new Date(fyStart + 1, 2, 31); // March 31
    return tradeItems
      .filter((t) => {
        const sellDate = new Date(t.sellDate);
        return sellDate >= start && sellDate <= end;
      })
      .map(toITR3TradeInput);
  }, [tradeItems, currentFY]);

  // Compute ITR-3 data
  const filingData = useMemo((): ITR3FilingData => {
    const regime = preferredRegime === 'compare' ? 'new' : preferredRegime;
    
    // Construct salary input if data exists
    const salaryInput = itr3Data.salaryData ? {
      salary: itr3Data.salaryData,
      deductions: {
        section80C_paise: 0, section80D_paise: 0, section80E_paise: 0, section80TTA_paise: 0, homeLoanInterestPaise: 0, nps80CCD_paise: 0, otherDeductionsPaise: 0
      }, // Deductions are handled in computeScheduleVIA, so pass 0 here to prevent double counting
      tdsDeductedPaise: itr3Data.tdsData || 0,
      fy: currentFY,
      capitalGains: { stcgPaise: 0, ltcgPaise: 0, intradayPaise: 0, stcgTaxPaise: 0, ltcgTaxPaise: 0, intradayTaxPaise: 0 } // Computed by computeITR3Tax
    } : undefined;

    return computeITR3Tax({
      salaryTaxInput: salaryInput,
      trades: fyTrades,
      businessExpenses: itr3Data.businessExpenses,
      houseProperties: itr3Data.houseProperties,
      otherSources: itr3Data.otherSourceIncome,
      deductions: itr3Data.deductionEntries,
      regime,
      fy: currentFY,
    });
  }, [fyTrades, itr3Data, preferredRegime, currentFY]);

  const portalMappings = useMemo(() => generatePortalFieldMappings(filingData), [filingData]);

  const step = WIZARD_STEPS[currentStep];

  // Step completion status
  const getStepStatus = (stepId: string): 'completed' | 'in_progress' | 'not_started' => {
    return itr3Data.filingProgress[stepId] || 'not_started';
  };

  const goNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setFilingProgress(step.id, 'completed');
      setCurrentStep(currentStep + 1);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="schedule-page">
      {/* Header */}
      <div className="schedule-header">
        <div>
          <h1 className="schedule-page-title">ITR-3 FILING ASSISTANT</h1>
          <div className="schedule-page-subtitle">
            AY {filingData.assessmentYear} · FY {filingData.financialYear}
          </div>
        </div>
        <div className="wizard-fy-badge">FY {currentFY}</div>
      </div>

      {/* Wizard Navigation */}
      <div className="schedule-wizard-nav">
        {WIZARD_STEPS.map((s, i) => {
          const status = getStepStatus(s.id);
          return (
            <button
              key={s.id}
              className={`wizard-step ${i === currentStep ? 'active' : ''} ${status === 'completed' ? 'completed' : ''} ${status === 'not_started' && i !== currentStep ? 'pending' : ''}`}
              onClick={() => setCurrentStep(i)}
            >
              <span className="wizard-step-number">{i + 1}</span>
              <span className="wizard-step-label">{s.shortLabel}</span>
              {status === 'completed' && (
                <span className="material-symbols-outlined wizard-step-check" style={{ fontSize: '12px' }}>check</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="wizard-content">
        <div className="schedule-card">
          <div className="schedule-card-header">
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '18px', fontVariationSettings: "'wght' 300" }}>
              {step.icon}
            </span>
            <span>{step.label}</span>
            <span className={`completion-badge ${getStepStatus(step.id)}`}>
              {getStepStatus(step.id) === 'completed' ? '✅' : getStepStatus(step.id) === 'in_progress' ? '⚠️' : '⬜'}
            </span>
          </div>
          <div className="schedule-card-body">
            {/* Step 1: General Information */}
            {currentStep === 0 && (
              <GeneralInfoStep filingData={filingData} />
            )}

            {/* Step 2: AIS */}
            {currentStep === 1 && (
              <AISStep />
            )}

            {/* Step 3: Salary */}
            {currentStep === 2 && (
              <SalaryStep filingData={filingData} privacyMode={privacyMode} />
            )}

            {/* Step 4: House Property */}
            {currentStep === 3 && (
              <HousePropertyStep filingData={filingData} privacyMode={privacyMode} />
            )}

            {/* Step 5: Bookkeeping */}
            {currentStep === 4 && (
              <ScheduleBookkeeping />
            )}

            {/* Step 6: Business/Profession */}
            {currentStep === 5 && (
              <BusinessStep filingData={filingData} privacyMode={privacyMode} />
            )}

            {/* Step 7: Capital Gains */}
            {currentStep === 6 && (
              <CapitalGainsStep filingData={filingData} privacyMode={privacyMode} />
            )}

            {/* Step 8: Other Sources */}
            {currentStep === 7 && (
              <OtherSourcesStep filingData={filingData} privacyMode={privacyMode} />
            )}

            {/* Step 9: Deductions */}
            {currentStep === 8 && (
              <DeductionsStep filingData={filingData} privacyMode={privacyMode} />
            )}

            {/* Step 10: Tax Computation */}
            {currentStep === 9 && (
              <TaxComputationStep filingData={filingData} privacyMode={privacyMode} />
            )}

            {/* Step 11: Verification */}
            {currentStep === 10 && (
              <VerificationStep filingData={filingData} portalMappings={portalMappings} privacyMode={privacyMode} copyToClipboard={copyToClipboard} />
            )}
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="schedule-action-bar">
        <button className="wizard-nav-btn secondary" onClick={goPrev} disabled={currentStep === 0}>
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '16px' }}>chevron_left</span>
          Previous
        </button>
        <div className="wizard-step-indicator">
          Step {currentStep + 1} of {WIZARD_STEPS.length}
        </div>
        <button className="wizard-nav-btn primary" onClick={goNext} disabled={currentStep === WIZARD_STEPS.length - 1}>
          {currentStep === WIZARD_STEPS.length - 2 ? 'Finish' : 'Next'}
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '16px' }}>chevron_right</span>
        </button>
      </div>
    </div>
  );
}

// ============ STEP COMPONENTS ============

function GeneralInfoStep({ filingData }: { filingData: ITR3FilingData }) {
  const itr3Data = useAppStore((s) => s.itr3Data);
  const updateITR3Data = useAppStore((s) => s.updateITR3Data);
  const preferredRegime = useAppStore((s) => s.preferredRegime);

  return (
    <div className="wizard-step-content">
      <p className="schedule-step-desc">
        Confirm your filing details before preparing the ITR-3 schedules.
      </p>

      <div className="schedule-grid">
        <div className="schedule-field-row">
          <span className="schedule-field-label">ASSESSMENT YEAR</span>
          <span className="schedule-field-value">{filingData.assessmentYear}</span>
        </div>
        <div className="schedule-field-row">
          <span className="schedule-field-label">FINANCIAL YEAR</span>
          <span className="schedule-field-value">{filingData.financialYear}</span>
        </div>
        <div className="schedule-field-row">
          <span className="schedule-field-label">TAX REGIME</span>
          <span className="schedule-field-value" style={{ color: '#00ff41' }}>
            {preferredRegime === 'compare' ? 'Comparing Both' : preferredRegime === 'new' ? 'New Regime' : 'Old Regime'}
          </span>
        </div>
        <div className="schedule-field-row">
          <span className="schedule-field-label">FILING SECTION</span>
          <select
            className="wizard-select"
            value={itr3Data.filingSection}
            onChange={(e) => updateITR3Data({ filingSection: e.target.value as any })}
          >
            <option value="139(1)">139(1): Normal</option>
            <option value="139(4)">139(4): Belated</option>
            <option value="139(5)">139(5): Revised</option>
          </select>
        </div>
      </div>

      <div className="schedule-section">
        <div className="schedule-section-title">FORM 10-IEA STATUS</div>
        <div className="schedule-grid">
          <div className="schedule-field-row">
            <span className="schedule-field-label">FORM FILED?</span>
            <label className="wizard-toggle">
              <input
                type="checkbox"
                checked={itr3Data.form10IEA.filed}
                onChange={(e) => updateITR3Data({
                  form10IEA: { ...itr3Data.form10IEA, filed: e.target.checked }
                })}
              />
              <span>{itr3Data.form10IEA.filed ? 'YES' : 'NO'}</span>
            </label>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">REGIME OPTED</span>
            <select
              className="wizard-select"
              value={itr3Data.form10IEA.regime}
              onChange={(e) => updateITR3Data({
                form10IEA: { ...itr3Data.form10IEA, regime: e.target.value as 'old' | 'new' }
              })}
            >
              <option value="new">New Regime</option>
              <option value="old">Old Regime</option>
            </select>
          </div>
        </div>
        <div className="assumption-list">
          <div className="assumption-item">
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', color: '#ffb211' }}>info</span>
            Form 10-IEA must be filed before the due date u/s 139(1) to opt out of the new regime. One-time switch back is allowed for business income.
          </div>
        </div>
      </div>
    </div>
  );
}

function AISStep() {
  const itr3Data = useAppStore((s) => s.itr3Data);
  const aisData = itr3Data.aisData;
  const hasAisData = aisData && Object.values(aisData).some(v => v > 0);

  return (
    <div className="wizard-step-content">
      <p className="schedule-step-desc">
        Reconcile your internal ledger with the Income Tax Department's Annual Information Statement (AIS).
      </p>
      
      {!hasAisData ? (
        <div className="schedule-empty">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '48px', color: 'rgba(255,255,255,0.15)' }}>receipt_long</span>
          <p>No AIS data entered yet.</p>
          <p className="schedule-field-label">Go to Schedule AIS to enter and reconcile your data.</p>
        </div>
      ) : (
        <div className="schedule-grid">
          <div className="schedule-field-row">
            <span className="schedule-field-label">AIS DATA</span>
            <span className="schedule-field-value" style={{ color: '#00ff41' }}>Entered</span>
          </div>
          <div className="schedule-field-row" style={{ marginTop: '16px' }}>
            <p className="schedule-field-label">Please visit the Schedule AIS page to view detailed reconciliation variances against your ledger.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SalaryStep({ filingData, privacyMode }: { filingData: ITR3FilingData; privacyMode: boolean }) {
  const salaryResult = filingData.salaryTaxResult;
  return (
    <div className="wizard-step-content">
      <p className="schedule-step-desc">
        Salary income from your employer. Data is pulled from your Salary Structure and Form 16 imports.
      </p>
      {!salaryResult ? (
        <div className="schedule-empty">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '48px', color: 'rgba(255,255,255,0.15)' }}>payments</span>
          <p>No salary data entered yet.</p>
          <p className="schedule-field-label">Go to Schedule S to enter your salary details.</p>
        </div>
      ) : (
        <div className="schedule-grid">
          <div className="schedule-field-row">
            <span className="schedule-field-label">GROSS SALARY</span>
            <span className="schedule-field-value">{formatINRMasked(salaryResult.grossSalaryPaise, privacyMode)}</span>
            <span className="schedule-field-portal">Income from Salary (Gross)</span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">STANDARD DEDUCTION</span>
            <span className="schedule-field-value">{formatINRMasked(salaryResult.standardDeductionPaise, privacyMode)}</span>
          </div>
          {salaryResult.hraExemptionPaise > 0 && (
            <div className="schedule-field-row">
              <span className="schedule-field-label">HRA EXEMPTION</span>
              <span className="schedule-field-value">{formatINRMasked(salaryResult.hraExemptionPaise, privacyMode)}</span>
            </div>
          )}
          <div className="schedule-field-row">
            <span className="schedule-field-label">TOTAL DEDUCTIONS</span>
            <span className="schedule-field-value">{formatINRMasked(salaryResult.totalDeductionsPaise, privacyMode)}</span>
          </div>
          <div className="schedule-summary-row">
            <span className="schedule-field-label">TAXABLE SALARY</span>
            <span className="schedule-field-value" style={{ color: '#00ff41' }}>
              {formatINRMasked(salaryResult.taxableIncomePaise, privacyMode)}
            </span>
            <span className="schedule-field-portal">Net Taxable Salary</span>
          </div>
        </div>
      )}
    </div>
  );
}

function HousePropertyStep({ filingData, privacyMode }: { filingData: ITR3FilingData; privacyMode: boolean }) {
  const hp = filingData.scheduleHP;
  return (
    <div className="wizard-step-content">
      <p className="schedule-step-desc">
        Income or loss from house property. Add your rental income and home loan details.
      </p>
      {hp.properties.length === 0 ? (
        <div className="schedule-empty">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '48px', color: 'rgba(255,255,255,0.15)' }}>home</span>
          <p>No house property entries.</p>
          <p className="schedule-field-label">If you have rental income or home loan interest, add entries via the Schedule HP page.</p>
        </div>
      ) : (
        <>
          {hp.breakdown.map((b) => (
            <div key={b.id} className="schedule-card" style={{ marginBottom: '12px' }}>
              <div className="schedule-card-body">
                <div className="schedule-grid">
                  <div className="schedule-field-row">
                    <span className="schedule-field-label">NET ANNUAL VALUE</span>
                    <span className="schedule-field-value">{formatINRMasked(b.navPaise, privacyMode)}</span>
                  </div>
                  <div className="schedule-field-row">
                    <span className="schedule-field-label">STD DEDUCTION (30%)</span>
                    <span className="schedule-field-value">{formatINRMasked(b.stdDeductionPaise, privacyMode)}</span>
                  </div>
                  <div className="schedule-field-row">
                    <span className="schedule-field-label">INTEREST ON LOAN</span>
                    <span className="schedule-field-value">{formatINRMasked(b.interestPaise, privacyMode)}</span>
                  </div>
                  <div className="schedule-summary-row">
                    <span className="schedule-field-label">NET INCOME</span>
                    <span className="schedule-field-value" style={{ color: b.netPaise >= 0 ? '#00ff41' : '#ffb4ab' }}>
                      {formatINRMasked(b.netPaise, privacyMode)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="schedule-summary">
            <div className="schedule-summary-row">
              <span className="schedule-field-label">TOTAL HP INCOME</span>
              <span className="schedule-field-value" style={{ color: hp.totalIncomePaise >= 0 ? '#00ff41' : '#ffb4ab' }}>
                {formatINRMasked(hp.totalIncomePaise, privacyMode)}
              </span>
              <span className="schedule-field-portal">Income from House Property - Total</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BusinessStep({ filingData, privacyMode }: { filingData: ITR3FilingData; privacyMode: boolean }) {
  const bp = filingData.scheduleBP;
  const hasBusiness = bp.fnoTradeCount > 0 || bp.intradayTradeCount > 0;

  return (
    <div className="wizard-step-content">
      <p className="schedule-step-desc">
        Business income from F&O and intraday trading. Turnover is auto-computed from your trade data.
      </p>
      {!hasBusiness ? (
        <div className="schedule-empty">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '48px', color: 'rgba(255,255,255,0.15)' }}>business_center</span>
          <p>No F&O or intraday trades found for this FY.</p>
          <p className="schedule-field-label">Import your F&O trades or mark trades as futures/options to populate this schedule.</p>
        </div>
      ) : (
        <>
          {bp.isAuditRequired && (
            <div className="audit-warning">
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '18px' }}>warning</span>
              <span>{bp.auditReason}</span>
            </div>
          )}

          <div className="schedule-section">
            <div className="schedule-section-title">TURNOVER</div>
            <div className="schedule-grid">
              <div className="schedule-field-row">
                <span className="schedule-field-label">F&O TURNOVER ({bp.fnoTradeCount} trades)</span>
                <span className="schedule-field-value">{formatINRMasked(bp.fnoTurnoverPaise, privacyMode)}</span>
              </div>
              <div className="schedule-field-row">
                <span className="schedule-field-label">INTRADAY TURNOVER ({bp.intradayTradeCount} trades)</span>
                <span className="schedule-field-value">{formatINRMasked(bp.intradayTurnoverPaise, privacyMode)}</span>
              </div>
              <div className="schedule-summary-row">
                <span className="schedule-field-label">TOTAL TURNOVER</span>
                <span className="schedule-field-value">{formatINRMasked(bp.totalTurnoverPaise, privacyMode)}</span>
                <span className="schedule-field-portal">Sl 47 - Turnover</span>
              </div>
            </div>
          </div>

          <div className="schedule-section">
            <div className="schedule-section-title">PROFIT & LOSS</div>
            <div className="schedule-grid">
              <div className="schedule-field-row">
                <span className="schedule-field-label">F&O NET P&L</span>
                <span className="schedule-field-value" style={{ color: bp.netFnoPaise >= 0 ? '#00ff41' : '#ffb4ab' }}>
                  {formatINRMasked(bp.netFnoPaise, privacyMode)}
                </span>
              </div>
              <div className="schedule-field-row">
                <span className="schedule-field-label">INTRADAY NET P&L</span>
                <span className="schedule-field-value" style={{ color: bp.netSpeculativePaise >= 0 ? '#00ff41' : '#ffb4ab' }}>
                  {formatINRMasked(bp.netSpeculativePaise, privacyMode)}
                </span>
              </div>
              <div className="schedule-field-row">
                <span className="schedule-field-label">BUSINESS EXPENSES</span>
                <span className="schedule-field-value">{formatINRMasked(bp.totalExpensesPaise, privacyMode)}</span>
              </div>
              <div className="schedule-summary-row">
                <span className="schedule-field-label">NET BUSINESS INCOME</span>
                <span className="schedule-field-value" style={{ color: bp.netBusinessIncomePaise >= 0 ? '#00ff41' : '#ffb4ab' }}>
                  {formatINRMasked(bp.netBusinessIncomePaise, privacyMode)}
                </span>
                <span className="schedule-field-portal">Sl 48 - Net Profit</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CapitalGainsStep({ filingData, privacyMode }: { filingData: ITR3FilingData; privacyMode: boolean }) {
  const [period, setPeriod] = useState<'combined' | 'pre' | 'post'>('combined');
  const cg = filingData.scheduleCG;

  return (
    <div className="wizard-step-content">
      <p className="schedule-step-desc">
        Capital gains from equity, mutual funds, property, and other assets. Split by the Finance Act 2024 date (23 July 2024).
      </p>

      <div className="date-split-toggle">
        <button className={period === 'combined' ? 'active' : ''} onClick={() => setPeriod('combined')}>Combined</button>
        <button className={period === 'pre' ? 'active' : ''} onClick={() => setPeriod('pre')}>Before 23 July</button>
        <button className={period === 'post' ? 'active' : ''} onClick={() => setPeriod('post')}>On/After 23 July</button>
      </div>

      <div className="schedule-section">
        <div className="schedule-section-title">SUMMARY</div>
        <div className="schedule-grid">
          <div className="schedule-field-row">
            <span className="schedule-field-label">TOTAL STCG</span>
            <span className="schedule-field-value" style={{ color: '#00ff41' }}>
              {formatINRMasked(cg.totalSTCGPaise, privacyMode)}
            </span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">TOTAL LTCG</span>
            <span className="schedule-field-value" style={{ color: '#00ff41' }}>
              {formatINRMasked(cg.totalLTCGPaise, privacyMode)}
            </span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">STCL (LOSSES)</span>
            <span className="schedule-field-value" style={{ color: '#ffb4ab' }}>
              {formatINRMasked(cg.totalSTCLPaise, privacyMode)}
            </span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">LTCL (LOSSES)</span>
            <span className="schedule-field-value" style={{ color: '#ffb4ab' }}>
              {formatINRMasked(cg.totalLTCLPaise, privacyMode)}
            </span>
          </div>
        </div>
      </div>

      <div className="schedule-section">
        <div className="schedule-section-title">AFTER LOSS SET-OFF & EXEMPTIONS</div>
        <div className="schedule-grid">
          <div className="schedule-field-row">
            <span className="schedule-field-label">NET STCG</span>
            <span className="schedule-field-value">{formatINRMasked(cg.netSTCGPaise, privacyMode)}</span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">NET LTCG</span>
            <span className="schedule-field-value">{formatINRMasked(cg.netLTCGPaise, privacyMode)}</span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">LTCG EXEMPTION (PRE-JULY)</span>
            <span className="schedule-field-value" style={{ color: '#ffb211' }}>
              {formatINRMasked(cg.preSplitLTCGExemptionUsedPaise, privacyMode)}
            </span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">LTCG EXEMPTION (POST-JULY)</span>
            <span className="schedule-field-value" style={{ color: '#ffb211' }}>
              {formatINRMasked(cg.postSplitLTCGExemptionUsedPaise, privacyMode)}
            </span>
          </div>
        </div>
      </div>

      <div className="schedule-summary">
        <div className="schedule-summary-row">
          <span className="schedule-field-label">STCG TAX</span>
          <span className="schedule-field-value">{formatINRMasked(cg.totalSTCGTaxPaise, privacyMode)}</span>
        </div>
        <div className="schedule-summary-row">
          <span className="schedule-field-label">LTCG TAX</span>
          <span className="schedule-field-value">{formatINRMasked(cg.totalLTCGTaxPaise, privacyMode)}</span>
        </div>
        <div className="schedule-summary-row" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
          <span className="schedule-field-label">TOTAL CG TAX</span>
          <span className="schedule-field-value" style={{ color: '#00ff41', fontSize: '22px' }}>
            {formatINRMasked(cg.netCGTaxPaise, privacyMode)}
          </span>
        </div>
      </div>

      {(cg.carryForwardSTCLPaise > 0 || cg.carryForwardLTCLPaise > 0) && (
        <div className="assumption-list" style={{ marginTop: '16px' }}>
          <div className="assumption-item" style={{ color: '#ffb211' }}>
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px' }}>info</span>
            Carry-forward: STCL {formatINRMasked(cg.carryForwardSTCLPaise, privacyMode)}, LTCL {formatINRMasked(cg.carryForwardLTCLPaise, privacyMode)} (available for 8 AYs)
          </div>
        </div>
      )}
    </div>
  );
}

function OtherSourcesStep({ filingData, privacyMode }: { filingData: ITR3FilingData; privacyMode: boolean }) {
  const os = filingData.scheduleOS;
  return (
    <div className="wizard-step-content">
      <p className="schedule-step-desc">
        Income from interest (FD, savings), dividends, and other sources.
      </p>
      {os.entries.length === 0 ? (
        <div className="schedule-empty">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '48px', color: 'rgba(255,255,255,0.15)' }}>account_balance</span>
          <p>No other source income entries.</p>
          <p className="schedule-field-label">Add FD interest, dividends, and other income via the Schedule OS page.</p>
        </div>
      ) : (
        <>
          {os.entries.map((e) => (
            <div key={e.id} className="schedule-field-row" style={{ marginBottom: '8px' }}>
              <span className="schedule-field-label">{e.type.replace(/_/g, ' ').toUpperCase()}</span>
              <span className="schedule-field-value">{formatINRMasked(e.amountPaise, privacyMode)}</span>
              {e.tdsSection && <span className="schedule-field-portal">TDS: Sec {e.tdsSection}</span>}
            </div>
          ))}
          <div className="schedule-summary">
            <div className="schedule-summary-row">
              <span className="schedule-field-label">TOTAL OTHER INCOME</span>
              <span className="schedule-field-value" style={{ color: '#00ff41' }}>
                {formatINRMasked(os.totalIncomePaise, privacyMode)}
              </span>
            </div>
            <div className="schedule-summary-row">
              <span className="schedule-field-label">TDS PAID</span>
              <span className="schedule-field-value">{formatINRMasked(os.totalTDSPaise, privacyMode)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DeductionsStep({ filingData, privacyMode }: { filingData: ITR3FilingData; privacyMode: boolean }) {
  const via = filingData.scheduleVIA;
  const preferredRegime = useAppStore((s) => s.preferredRegime);

  return (
    <div className="wizard-step-content">
      <p className="schedule-step-desc">
        Deductions under Chapter VI-A. {via.regimeNote}
      </p>
      {via.deductions.length === 0 ? (
        <div className="schedule-empty">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '48px', color: 'rgba(255,255,255,0.15)' }}>savings</span>
          <p>No deductions entered yet.</p>
          <p className="schedule-field-label">Add your 80C, 80D, and other deductions via the Schedule VI-A page.</p>
        </div>
      ) : (
        <>
          {via.deductions.map((d) => (
            <div key={d.id} className="schedule-field-row" style={{ marginBottom: '8px' }}>
              <span className="schedule-field-label">
                SECTION {d.section}
                {d.regimeEligibility === 'old_only' && preferredRegime === 'new' && (
                  <span style={{ color: '#ffb4ab', fontSize: '10px', marginLeft: '8px' }}>NOT AVAILABLE IN NEW REGIME</span>
                )}
              </span>
              <span className="schedule-field-value">{formatINRMasked(d.amountPaise, privacyMode)}</span>
              <span className={`completion-badge ${d.proofStatus === 'verified' ? 'completed' : d.proofStatus === 'pending' ? 'in_progress' : 'not_started'}`}>
                {d.proofStatus === 'verified' ? '✅' : d.proofStatus === 'pending' ? '⚠️' : '⬜'}
              </span>
            </div>
          ))}
          <div className="schedule-summary">
            <div className="schedule-summary-row">
              <span className="schedule-field-label">TOTAL ALLOWED DEDUCTIONS</span>
              <span className="schedule-field-value" style={{ color: '#00ff41' }}>
                {formatINRMasked(via.totalAllowedPaise, privacyMode)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TaxComputationStep({ filingData, privacyMode }: { filingData: ITR3FilingData; privacyMode: boolean }) {
  const regime = filingData.form10IEA.regime;

  return (
    <div className="wizard-step-content">
      <p className="schedule-step-desc">
        Final tax computation combining all schedules. Regime: {regime === 'new' ? 'New' : 'Old'}.
      </p>

      <div className="schedule-section">
        <div className="schedule-section-title">INCOME SUMMARY</div>
        <div className="schedule-grid">
          <div className="schedule-field-row">
            <span className="schedule-field-label">SALARY INCOME</span>
            <span className="schedule-field-value">{formatINRMasked(filingData.salaryTaxResult?.grossSalaryPaise || 0, privacyMode)}</span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">HOUSE PROPERTY</span>
            <span className="schedule-field-value">{formatINRMasked(filingData.scheduleHP.totalIncomePaise, privacyMode)}</span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">BUSINESS INCOME</span>
            <span className="schedule-field-value">{formatINRMasked(filingData.scheduleBP.netBusinessIncomePaise, privacyMode)}</span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">CAPITAL GAINS</span>
            <span className="schedule-field-value">{formatINRMasked(filingData.scheduleCG.netSTCGPaise + filingData.scheduleCG.netLTCGPaise, privacyMode)}</span>
          </div>
          <div className="schedule-field-row">
            <span className="schedule-field-label">OTHER SOURCES</span>
            <span className="schedule-field-value">{formatINRMasked(filingData.scheduleOS.totalIncomePaise, privacyMode)}</span>
          </div>
        </div>
      </div>

      <div className="schedule-summary" style={{ marginTop: '16px' }}>
        <div className="schedule-summary-row">
          <span className="schedule-field-label">GROSS TOTAL INCOME</span>
          <span className="schedule-field-value" style={{ fontSize: '22px' }}>
            {formatINRMasked(filingData.totalIncomePaise, privacyMode)}
          </span>
          <span className="schedule-field-portal">Gross Total Income</span>
        </div>
        <div className="schedule-summary-row">
          <span className="schedule-field-label">DEDUCTIONS (VI-A)</span>
          <span className="schedule-field-value" style={{ color: '#ffb211' }}>
            - {formatINRMasked(filingData.scheduleVIA.totalAllowedPaise, privacyMode)}
          </span>
        </div>
        <div className="schedule-summary-row" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
          <span className="schedule-field-label">TOTAL TAX LIABILITY</span>
          <span className="schedule-field-value" style={{ color: '#ffb4ab', fontSize: '24px' }}>
            {formatINRMasked(filingData.totalTaxPaise, privacyMode)}
          </span>
          <span className="schedule-field-portal">Total Tax + Surcharge + Cess</span>
        </div>
        <div className="schedule-summary-row">
          <span className="schedule-field-label">TDS ALREADY PAID</span>
          <span className="schedule-field-value" style={{ color: '#00ff41' }}>
            - {formatINRMasked(filingData.totalTDSPaise, privacyMode)}
          </span>
        </div>
        <div className="schedule-summary-row" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
          <span className="schedule-field-label">
            {filingData.balanceTaxPaise >= 0 ? 'BALANCE TAX PAYABLE' : 'REFUND DUE'}
          </span>
          <span className="schedule-field-value" style={{
            color: filingData.balanceTaxPaise >= 0 ? '#ffb4ab' : '#00ff41',
            fontSize: '28px'
          }}>
            {formatINRMasked(Math.abs(filingData.balanceTaxPaise), privacyMode)}
          </span>
          <span className="schedule-field-portal">Tax Payable / Refund</span>
        </div>
      </div>
    </div>
  );
}

function VerificationStep({
  filingData,
  portalMappings,
  privacyMode,
  copyToClipboard,
}: {
  filingData: ITR3FilingData;
  portalMappings: ReturnType<typeof generatePortalFieldMappings>;
  privacyMode: boolean;
  copyToClipboard: (text: string) => void;
}) {
  // Group mappings by schedule
  const grouped = portalMappings.reduce((acc, m) => {
    if (!acc[m.scheduleName]) acc[m.scheduleName] = [];
    acc[m.scheduleName].push(m);
    return acc;
  }, {} as Record<string, typeof portalMappings>);

  return (
    <div className="wizard-step-content">
      <p className="schedule-step-desc">
        Review your ITR-3 data and copy values to the Income Tax e-filing portal.
      </p>

      <div className="portal-mapping">
        <div className="portal-mapping-title">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '18px', color: '#00ff41' }}>content_copy</span>
          PORTAL FIELD MAPPING
        </div>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
          When on the Income Tax e-filing portal, enter these values in the corresponding fields.
          Click the copy button to copy a value.
        </p>

        {Object.entries(grouped).map(([schedule, mappings]) => (
          <div key={schedule} className="schedule-section" style={{ marginBottom: '16px' }}>
            <div className="schedule-section-title">{schedule}</div>
            {mappings.map((m, i) => (
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
        ))}
      </div>

      <div className="assumption-list" style={{ marginTop: '24px' }}>
        <div className="schedule-section-title">ASSUMPTIONS & NOTES</div>
        {filingData.scheduleCG.assumptions.map((a, i) => (
          <div key={i} className="assumption-item">
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>circle</span>
            {a}
          </div>
        ))}
      </div>

      <div className="schedule-action-bar" style={{ marginTop: '24px' }}>
        <button className="wizard-nav-btn secondary" onClick={() => {
          const csv = portalMappings.map(m =>
            `"${m.scheduleName}","${m.fieldLabel}","${m.portalFieldName}","${m.value / 100}"`
          ).join('\n');
          const blob = new Blob([`Schedule,Field,Portal Field,Value\n${csv}`], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ITR3_${filingData.assessmentYear}_portal_mapping.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }}>
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '16px' }}>download</span>
          Export CSV
        </button>
        <button className="wizard-nav-btn secondary" onClick={() => window.print()}>
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '16px' }}>print</span>
          Print Summary
        </button>
      </div>
    </div>
  );
}
