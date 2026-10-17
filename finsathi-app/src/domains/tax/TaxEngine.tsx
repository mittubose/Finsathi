import { useState, useMemo, useEffect } from 'react';
import { useSalaryStore } from '../../shared/hooks/useSalaryStore';
import { compareRegimes, computePortfolioGains, type TradeEntry } from './engine';
import type { TaxInput, TaxResult, CapitalGainsInput } from './engine';
import { generateSuggestions } from './suggestions';
import { getCurrentFY } from '../../shared/lib/dates';
import { toPaise } from '../../shared/lib/currency';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import './TaxEngine.css';

function RupeeInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const privacyMode = useAppStore(s => s.privacyMode);
  return (
    <div className="tax-field">
      <label className="text-label-mono color-muted">{label}</label>
      <div className="tax-input-wrap">
        <span className="tax-input-prefix">₹</span>
        <input
          type="number"
          className={`tax-input ${privacyMode ? 'privacy-mask' : ''}`}
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          placeholder="0"
          min="0"
        />
      </div>
    </div>
  );
}

function ResultCard({ result, label }: { result: TaxResult; label: string }) {
  return (
    <div className="tax-result-card glass-surface">
      <div className="glass-card-header">
        <h3 className="text-label-mono color-subtle">{label}</h3>
        <span className={`text-label-mono-sm ${result.regime === 'new' ? 'color-positive' : 'color-warning'}`}>
          {result.regime.toUpperCase()}_REGIME
        </span>
      </div>
      <div className="tax-result-body">
        <div className="tax-result-row">
          <span className="color-muted">Gross Salary</span>
          <span><CurrencyValue paise={result.grossSalaryPaise} /></span>
        </div>
        <div className="tax-result-row">
          <span className="color-muted">Standard Deduction</span>
          <span className="color-positive">-<CurrencyValue paise={result.standardDeductionPaise} /></span>
        </div>
        {result.hraExemptionPaise > 0 && (
          <div className="tax-result-row">
            <span className="color-muted">HRA Exemption</span>
            <span className="color-positive">-<CurrencyValue paise={result.hraExemptionPaise} /></span>
          </div>
        )}
        <div className="tax-result-row">
          <span className="color-muted">Total Deductions</span>
          <span className="color-positive">-<CurrencyValue paise={result.totalDeductionsPaise} /></span>
        </div>
        <div className="tax-result-row tax-result-row--highlight">
          <span>Taxable Income</span>
          <span><CurrencyValue paise={result.taxableIncomePaise} /></span>
        </div>
        
        <div className="tax-result-divider" />
        
        <div className="tax-result-row">
          <span className="color-muted">Tax on Income</span>
          <span><CurrencyValue paise={result.taxOnIncomePaise} /></span>
        </div>

        {result.capitalGainsTaxPaise > 0 && (
          <div className="tax-result-row">
            <span className="color-muted">Capital Gains Tax</span>
            <span><CurrencyValue paise={result.capitalGainsTaxPaise} /></span>
          </div>
        )}

        {result.rebate87APaise > 0 && (
          <div className="tax-result-row">
            <span className="color-muted">Rebate u/s 87A</span>
            <span className="color-positive">-<CurrencyValue paise={result.rebate87APaise} /></span>
          </div>
        )}
        {result.surchargePaise > 0 && (
          <div className="tax-result-row">
            <span className="color-muted">Surcharge ({result.surchargeRate}%)</span>
            <span><CurrencyValue paise={result.surchargePaise} /></span>
          </div>
        )}
        <div className="tax-result-row">
          <span className="color-muted">H&E Cess (4%)</span>
          <span><CurrencyValue paise={result.cessPaise} /></span>
        </div>
        <div className="tax-result-divider" />
        <div className="tax-result-row tax-result-row--total">
          <span>TOTAL TAX</span>
          <span className="color-negative"><CurrencyValue paise={result.totalTaxPaise} /></span>
        </div>
        <div className="tax-result-row">
          <span className="color-muted">Effective Rate</span>
          <span className="text-data-display" style={{ fontSize: '14px' }}>{result.effectiveRate}%</span>
        </div>
        {result.tdsDeductedPaise > 0 && (
          <>
            <div className="tax-result-row">
              <span className="color-muted">TDS Deducted</span>
              <span className="color-positive">-<CurrencyValue paise={result.tdsDeductedPaise} /></span>
            </div>
            <div className="tax-result-row tax-result-row--highlight">
              <span>{result.balanceTaxPaise > 0 ? 'Balance Payable' : 'Refund'}</span>
              <span className={result.balanceTaxPaise > 0 ? 'color-negative' : 'color-positive'}>
                <CurrencyValue paise={Math.abs(result.balanceTaxPaise)} />
              </span>
            </div>
          </>
        )}
      </div>
      {/* Assumptions */}
      <div className="tax-assumptions">
        {result.assumptions.map((a, i) => (
          <div key={i} className="text-label-mono-sm color-muted" style={{ padding: '2px 0' }}>
            ↳ {a}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TaxEngine() {
  const { tradeItems } = useAppStore();
  const { revisions } = useSalaryStore();
  const activeStructure = revisions[0] || null;

  // Salary inputs (in rupees for UI, converted to paise for engine)
  const [basic, setBasic] = useState(0);
  const [hra, setHra] = useState(0);
  const [special, setSpecial] = useState(0);
  const [conveyance, setConveyance] = useState(0);
  const [lta, setLta] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [otherTaxable, setOtherTaxable] = useState(0);
  const [employerPf, setEmployerPf] = useState(0);
  const [profTax, setProfTax] = useState(0);

  // Deductions
  const [sec80C, setSec80C] = useState(0);
  const [sec80D, setSec80D] = useState(0);
  const [sec80E, setSec80E] = useState(0);
  const [sec80TTA, setSec80TTA] = useState(0);
  const [homeLoan, setHomeLoan] = useState(0);
  const [nps, setNps] = useState(0);
  const [otherDed, setOtherDed] = useState(0);

  // HRA
  const [rentPaid, setRentPaid] = useState(0);
  const [cityType, setCityType] = useState<'metro' | 'non-metro'>('metro');

  // TDS
  const [tds, setTds] = useState(0);

  const syncWithSalary = () => {
    if (!activeStructure) return;
    
    let b = 0, h = 0, s = 0, c = 0, l = 0, ot = 0, epf = 0, s80c = 0, td = 0;
    
    activeStructure.components.forEach(comp => {
      const monthsMultiplier = comp.applicableMonths && comp.applicableMonths.length > 0
        ? comp.applicableMonths.length
        : 12;
      const annualRupees = (comp.amountPaise / 100) * monthsMultiplier;
      
      if (comp.type === 'earning') {
        if (comp.category === 'basic') b += annualRupees;
        else if (comp.category === 'hra') h += annualRupees;
        else if (comp.category === 'special_allowance') s += annualRupees;
        else if (comp.category === 'conveyance') c += annualRupees;
        else if (comp.category === 'lta') l += annualRupees;
        else ot += annualRupees;
      } else {
        // deductions
        if (comp.category === 'pf') {
          epf += annualRupees;
          s80c += annualRupees; // Employee PF counts under 80C
        } else if (comp.category === 'tax') {
          td += annualRupees;
        }
      }
    });
    
    setBasic(b);
    setHra(h);
    setSpecial(s);
    setConveyance(c);
    setLta(l);
    setOtherTaxable(ot);
    setEmployerPf(epf);
    setSec80C(s80c);
    setTds(td);
  };

  // Auto-populate on first load if inputs are empty and salary structure exists
  useEffect(() => {
    if (activeStructure && basic === 0 && hra === 0 && special === 0) {
      syncWithSalary();
    }
  }, [activeStructure]);

  // Calculate Capital Gains from Trades
  const capitalGains: CapitalGainsInput = useMemo(() => {
    const entries: TradeEntry[] = tradeItems.map(t => ({
      instrument: t.instrument,
      buyDate: new Date(t.buyDate),
      sellDate: new Date(t.sellDate),
      qty: t.qty,
      buyPricePaise: t.buyPricePaise,
      sellPricePaise: t.sellPricePaise,
      chargesPaise: t.chargesPaise
    }));

    const summary = computePortfolioGains(entries);
    return {
      stcgPaise: summary.totalSTCGPaise - summary.totalSTCLPaise,
      ltcgPaise: summary.totalLTCGPaise - summary.totalLTCLPaise,
      intradayPaise: summary.totalIntradayPaise - summary.totalIntradayLossPaise,
      stcgTaxPaise: summary.stcgTaxPaise,
      ltcgTaxPaise: summary.ltcgTaxPaise,
      intradayTaxPaise: summary.intradayTaxPaise
    };
  }, [tradeItems]);

  const taxInput: TaxInput = useMemo(() => ({
    salary: {
      basicPaise: toPaise(basic), hraPaise: toPaise(hra), specialAllowancePaise: toPaise(special),
      conveyancePaise: toPaise(conveyance), ltaPaise: toPaise(lta), bonusPaise: toPaise(bonus),
      otherTaxablePaise: toPaise(otherTaxable), employerPfPaise: toPaise(employerPf), professionTaxPaise: toPaise(profTax),
    },
    deductions: {
      section80C_paise: toPaise(sec80C), section80D_paise: toPaise(sec80D), section80E_paise: toPaise(sec80E),
      section80TTA_paise: toPaise(sec80TTA), homeLoanInterestPaise: toPaise(homeLoan),
      nps80CCD_paise: toPaise(nps), otherDeductionsPaise: toPaise(otherDed),
    },
    hra: rentPaid > 0 ? { rentPaidPaise: toPaise(rentPaid), cityType } : undefined,
    tdsDeductedPaise: toPaise(tds), 
    fy: getCurrentFY(),
    capitalGains
  }), [basic, hra, special, conveyance, lta, bonus, otherTaxable, employerPf, profTax,
      sec80C, sec80D, sec80E, sec80TTA, homeLoan, nps, otherDed, rentPaid, cityType, tds, capitalGains]);

  const comparison = useMemo(() => {
    return compareRegimes(taxInput);
  }, [taxInput]);

  const gross = basic + hra + special + conveyance + lta + bonus + otherTaxable;

  const suggestions = useMemo(() => {
    if (gross <= 0) return [];
    return generateSuggestions(taxInput);
  }, [taxInput, gross]);

  return (
    <div className="tax-engine">
      <div className="tax-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="text-headline-md" style={{ margin: 0 }}>TAX_ENGINE</h1>
          <span className="text-label-mono color-muted">FY {getCurrentFY()} · OLD vs NEW REGIME</span>
        </div>
        {activeStructure && (
          <button 
            className="salary-btn-action secondary" 
            onClick={syncWithSalary}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '8px 16px',
              color: 'var(--primary-container)',
              fontFamily: 'var(--font-headline)',
              fontSize: '10px',
              letterSpacing: '1px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>sync</span>
            SYNC_WITH_SALARY
          </button>
        )}
      </div>

      <div className="tax-layout">
        {/* Input Panel */}
        <div className="tax-input-panel">
          {/* Salary Section */}
          <div className="tax-section glass-surface">
            <div className="glass-card-header">
              <h2 className="text-label-mono color-subtle">SALARY_BREAKUP</h2>
              <span className="text-label-mono-sm color-positive">
                GROSS: <CurrencyValue paise={toPaise(gross)} />
              </span>
            </div>
            <div className="tax-fields">
              <RupeeInput label="BASIC_SALARY" value={basic} onChange={setBasic} />
              <RupeeInput label="HRA" value={hra} onChange={setHra} />
              <RupeeInput label="SPECIAL_ALLOWANCE" value={special} onChange={setSpecial} />
              <RupeeInput label="CONVEYANCE" value={conveyance} onChange={setConveyance} />
              <RupeeInput label="LTA" value={lta} onChange={setLta} />
              <RupeeInput label="BONUS" value={bonus} onChange={setBonus} />
              <RupeeInput label="OTHER_TAXABLE" value={otherTaxable} onChange={setOtherTaxable} />
              <RupeeInput label="EMPLOYER_PF" value={employerPf} onChange={setEmployerPf} />
              <RupeeInput label="PROFESSION_TAX" value={profTax} onChange={setProfTax} />
            </div>
          </div>

          {/* HRA Section */}
          <div className="tax-section glass-surface">
            <div className="glass-card-header">
              <h2 className="text-label-mono color-subtle">HRA_DETAILS</h2>
              <span className="text-label-mono-sm color-muted">OLD_REGIME_ONLY</span>
            </div>
            <div className="tax-fields">
              <RupeeInput label="ANNUAL_RENT_PAID" value={rentPaid} onChange={setRentPaid} />
              <div className="tax-field">
                <label className="text-label-mono color-muted">CITY_TYPE</label>
                <div className="tax-city-toggle">
                  <button
                    className={`tax-city-btn ${cityType === 'metro' ? 'active' : ''}`}
                    onClick={() => setCityType('metro')}
                  >
                    METRO
                  </button>
                  <button
                    className={`tax-city-btn ${cityType === 'non-metro' ? 'active' : ''}`}
                    onClick={() => setCityType('non-metro')}
                  >
                    NON_METRO
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Deductions Section */}
          <div className="tax-section glass-surface">
            <div className="glass-card-header">
              <h2 className="text-label-mono color-subtle">DEDUCTIONS</h2>
              <span className="text-label-mono-sm color-muted">OLD_REGIME</span>
            </div>
            <div className="tax-fields">
              <RupeeInput label="80C (PF/PPF/ELSS — max ₹1.5L)" value={sec80C} onChange={setSec80C} />
              <RupeeInput label="80D (HEALTH INS — max ₹25K)" value={sec80D} onChange={setSec80D} />
              <RupeeInput label="80E (EDU LOAN INT)" value={sec80E} onChange={setSec80E} />
              <RupeeInput label="80TTA (SAVINGS INT — max ₹10K)" value={sec80TTA} onChange={setSec80TTA} />
              <RupeeInput label="HOME LOAN INT (24b — max ₹2L)" value={homeLoan} onChange={setHomeLoan} />
              <RupeeInput label="NPS 80CCD" value={nps} onChange={setNps} />
              <RupeeInput label="OTHER_DEDUCTIONS" value={otherDed} onChange={setOtherDed} />
            </div>
          </div>

          {/* TDS */}
          <div className="tax-section glass-surface">
            <div className="glass-card-header">
              <h2 className="text-label-mono color-subtle">TDS_DEDUCTED</h2>
            </div>
            <div className="tax-fields">
              <RupeeInput label="TDS_ALREADY_PAID" value={tds} onChange={setTds} />
            </div>
          </div>

          {/* Trading Desk Summary (Auto-Updated) */}
          <div className="tax-section glass-surface">
            <div className="glass-card-header">
              <h2 className="text-label-mono color-subtle">TRADING_DESK_SUMMARY</h2>
              <span className="text-label-mono-sm color-muted">AUTO_SYNCED</span>
            </div>
            <div className="tax-fields">
              <div className="tax-field">
                <label className="text-label-mono-sm color-muted">SHORT_TERM_GAINS (STCG)</label>
                <span className={`text-data-display ${capitalGains.stcgPaise >= 0 ? 'color-positive' : 'color-negative'}`} style={{ fontSize: '14px' }}>
                  <CurrencyValue paise={capitalGains.stcgPaise} />
                </span>
              </div>
              <div className="tax-field">
                <label className="text-label-mono-sm color-muted">LONG_TERM_GAINS (LTCG)</label>
                <span className={`text-data-display ${capitalGains.ltcgPaise >= 0 ? 'color-positive' : 'color-negative'}`} style={{ fontSize: '14px' }}>
                  <CurrencyValue paise={capitalGains.ltcgPaise} />
                </span>
              </div>
              <div className="tax-field">
                <label className="text-label-mono-sm color-muted">SPECULATIVE_INCOME (INTRADAY)</label>
                <span className={`text-data-display ${capitalGains.intradayPaise >= 0 ? 'color-positive' : 'color-negative'}`} style={{ fontSize: '14px' }}>
                  <CurrencyValue paise={capitalGains.intradayPaise} />
                </span>
              </div>
              <div className="tax-result-divider" />
              <div className="tax-field">
                <label className="text-label-mono-sm color-muted">TOTAL_TRADING_TAX_LIABILITY</label>
                <span className="text-data-display color-warning" style={{ fontSize: '16px' }}>
                  <CurrencyValue paise={capitalGains.stcgTaxPaise + capitalGains.ltcgTaxPaise + capitalGains.intradayTaxPaise} />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="tax-results-panel">
          {/* Recommendation Banner */}
          {gross > 0 && (
            <div className="tax-recommendation glass-surface-elevated">
              <div className="text-label-mono color-subtle" style={{ marginBottom: '4px' }}>RECOMMENDED_REGIME</div>
              <div className="text-headline-md color-positive" style={{ marginBottom: '4px' }}>
                {comparison.recommendation.toUpperCase()} REGIME
              </div>
              <div className="text-body color-subtle">
                Saves <CurrencyValue paise={comparison.savingsPaise} /> compared to {comparison.recommendation === 'new' ? 'Old' : 'New'} Regime
              </div>
            </div>
          )}

          <div className="tax-results-grid">
            <ResultCard result={comparison.newRegime} label="NEW_REGIME" />
            <ResultCard result={comparison.oldRegime} label="OLD_REGIME" />
          </div>

          {/* Tax Saving Suggestions */}
          {suggestions.length > 0 && (
            <div className="tax-suggestions">
              <div className="tax-suggestions-header">
                <span className="text-label-mono color-subtle">TAX_SAVING_SUGGESTIONS</span>
                <span className="text-label-mono-sm color-muted">{suggestions.length} ACTIONS</span>
              </div>
              {suggestions.map((s) => (
                <div key={s.id} className={`tax-suggestion-card glass-surface ${s.priority === 'high' ? 'tax-suggestion-card--high' : ''}`}>
                  <div className="glass-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'wght' 300", color: 'var(--primary-container)' }}>{s.icon}</span>
                      <span className="text-label-mono" style={{ fontSize: '11px' }}>{s.title}</span>
                    </div>
                    <span className={`text-label-mono-sm ${s.priority === 'high' ? 'color-positive' : 'color-muted'}`}>
                      {s.priority.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ padding: '8px 12px' }}>
                    <p className="text-body color-subtle" style={{ fontSize: '11px', lineHeight: 1.5 }}>{s.description}</p>
                    {s.potentialSavingPaise > 0 && (
                      <div className="tax-suggestion-saving">
                        <span className="text-label-mono-sm color-muted">POTENTIAL_SAVING</span>
                        <span className="text-data-display color-positive" style={{ fontSize: '12px' }}>
                          <CurrencyValue paise={s.potentialSavingPaise} />
                        </span>
                      </div>
                    )}
                    {s.limitPaise > 0 && (
                      <div className="tax-suggestion-progress">
                        <div className="tax-suggestion-progress-bar">
                          <div
                            className="tax-suggestion-progress-fill"
                            style={{ width: `${Math.min(100, Math.round((s.currentPaise / s.limitPaise) * 100))}%` }}
                          />
                        </div>
                        <span className="text-label-mono-sm color-muted">
                          {Math.round((s.currentPaise / s.limitPaise) * 100)}% USED
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
