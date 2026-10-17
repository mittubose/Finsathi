import { useState, useMemo } from 'react';
import { useAppStore } from '../../../shared/hooks/useAppStore';
import { computeScheduleHP, generatePortalFieldMappings, type HousePropertyEntry } from '../itr3Engine';
import { InfoTooltip } from '../../../shared/ui/InfoTooltip';
import './schedules.css';

export function ScheduleHP() {
  const currentFY = useAppStore(s => s.currentFY);
  const itr3Data = useAppStore(s => s.itr3Data);
  const addHouseProperty = useAppStore(s => s.addHouseProperty);
  const deleteHouseProperty = useAppStore(s => s.deleteHouseProperty);
  const privacyMode = useAppStore(s => s.privacyMode);

  const [newProp, setNewProp] = useState<Partial<HousePropertyEntry>>({
    propertyType: 'self_occupied',
    annualRentPaise: 0,
    municipalTaxesPaise: 0,
    homeLoanInterestPaise: 0,
    preLettingInterestPaise: 0,
  });

  const scheduleHP = useMemo(() => computeScheduleHP(itr3Data.houseProperties), [itr3Data.houseProperties]);

  const portalMappings = useMemo(() => {
    return generatePortalFieldMappings({
      assessmentYear: '',
      financialYear: currentFY,
      filingSection: '139(1)',
      form10IEA: { filed: false, regime: 'new' },
      scheduleCG: { preSplit: {} as any, postSplit: {} as any, assumptions: [], tradeResults: [] } as any,
      scheduleBP: { totalTurnoverPaise: 0 } as any,
      scheduleHP,
      scheduleOS: { totalIncomePaise: 0 } as any,
      scheduleVIA: { totalAllowedPaise: 0 } as any,
      totalIncomePaise: 0,
      totalTaxPaise: 0,
      totalTDSPaise: 0,
      balanceTaxPaise: 0,
    }).filter(m => m.scheduleName === 'Schedule HP');
  }, [scheduleHP, currentFY]);

  const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
  const displayVal = (paise: number) => privacyMode ? '₹ •••••' : fmt(paise);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addHouseProperty({
      id: crypto.randomUUID(),
      propertyType: newProp.propertyType as any,
      annualRentPaise: newProp.annualRentPaise || 0,
      municipalTaxesPaise: newProp.municipalTaxesPaise || 0,
      homeLoanInterestPaise: newProp.homeLoanInterestPaise || 0,
      preLettingInterestPaise: newProp.preLettingInterestPaise || 0,
    });
    setNewProp({
      propertyType: 'self_occupied',
      annualRentPaise: 0,
      municipalTaxesPaise: 0,
      homeLoanInterestPaise: 0,
      preLettingInterestPaise: 0,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="schedule-page">
      <div className="schedule-header">
        <div>
          <h1 className="schedule-page-title">SCHEDULE HP</h1>
          <div className="schedule-page-subtitle">Income from House Property</div>
        </div>
        <div className="wizard-fy-badge">FY {currentFY}</div>
      </div>

      <div className="schedule-section">
        <div className="schedule-section-title">YOUR PROPERTIES</div>
        
        {itr3Data.houseProperties.map((prop, i) => {
          const breakdown = scheduleHP.breakdown.find(b => b.id === prop.id);
          return (
            <div key={prop.id} className="schedule-card">
              <div className="schedule-card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span className="asset-badge" style={{ borderColor: '#81c995', color: '#81c995', background: 'rgba(129,201,149,0.1)' }}>
                    {prop.propertyType.replace('_', ' ').toUpperCase()}
                  </span>
                  <span style={{ marginLeft: '12px' }}>Property {i + 1}</span>
                </div>
                <button className="field-copy-btn" onClick={() => deleteHouseProperty(prop.id)}>
                  <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '16px', color: '#ffb4ab' }}>delete</span>
                </button>
              </div>
              <div className="schedule-card-body">
                <div className="schedule-grid">
                  {prop.propertyType !== 'self_occupied' && (
                    <>
                      <div className="schedule-field-row">
                        <span className="schedule-field-label">
                          Gross Rent Received
                          <InfoTooltip 
                            title="Gross Rent" 
                            description="Total rent received or receivable during the financial year before any deductions."
                            dateContext="1st April to 31st March"
                            example="If rent is ₹20,000/month for 12 months, enter ₹2,40,000."
                          />
                        </span>
                        <span className="schedule-field-value">{displayVal(prop.annualRentPaise)}</span>
                      </div>
                      <div className="schedule-field-row">
                        <span className="schedule-field-label">
                          Municipal Taxes Paid
                          <InfoTooltip 
                            title="Municipal Taxes" 
                            description="Property or municipal taxes ACTUALLY paid during the financial year by the owner. Cannot be claimed if paid by tenant or if unpaid."
                            example="Property tax to BBMP/BMC paid on 15th May: ₹5,000."
                          />
                        </span>
                        <span className="schedule-field-value">{displayVal(prop.municipalTaxesPaise)}</span>
                      </div>
                      <div className="schedule-field-row">
                        <span className="schedule-field-label">Net Annual Value (NAV)</span>
                        <span className="schedule-field-value">{displayVal(breakdown?.navPaise || 0)}</span>
                      </div>
                      <div className="schedule-field-row">
                        <span className="schedule-field-label">
                          Standard Deduction (30%)
                          <InfoTooltip 
                            title="Standard Deduction" 
                            description="Flat 30% deduction on Net Annual Value (Gross Rent - Municipal Taxes) for repairs and maintenance. Actual expenses don't matter."
                          />
                        </span>
                        <span className="schedule-field-value" style={{ color: '#ffb4ab' }}>
                          - {displayVal(breakdown?.stdDeductionPaise || 0)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="schedule-field-row">
                    <span className="schedule-field-label">
                      Home Loan Interest (Sec 24b)
                      <InfoTooltip 
                        title="Home Loan Interest" 
                        description="Interest payable on capital borrowed for acquisition, construction, repair, or renewal of the property. For self-occupied, max limit is ₹2 Lakhs. For let out, no limit on claiming."
                        dateContext="Accrued during 1st April to 31st March (even if not paid)."
                        example="As per your home loan interest certificate from the bank."
                      />
                    </span>
                    <span className="schedule-field-value" style={{ color: '#ffb4ab' }}>
                      - {displayVal(breakdown?.interestPaise || 0)}
                    </span>
                  </div>
                </div>
                <div className="schedule-summary-row" style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                  <span className="schedule-field-label">NET INCOME / (LOSS)</span>
                  <span className="schedule-field-value" style={{ color: (breakdown?.netPaise || 0) >= 0 ? '#00ff41' : '#ffb4ab' }}>
                    {displayVal(breakdown?.netPaise || 0)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        <form onSubmit={handleAdd} className="schedule-card" style={{ borderStyle: 'dashed' }}>
          <div className="schedule-card-header">ADD PROPERTY</div>
          <div className="schedule-card-body">
            <div className="schedule-grid">
              <div className="tax-field">
                <label className="schedule-field-label">
                  Property Type
                  <InfoTooltip 
                    title="Property Type" 
                    description="Self Occupied: Used for your own residence (Max 2 properties). Let Out: Rented out. Deemed Let Out: If you own >2 properties, the 3rd onwards is treated as let out and notionally taxed."
                  />
                </label>
                <select 
                  className="wizard-select" 
                  style={{ width: '100%', marginTop: '8px' }}
                  value={newProp.propertyType}
                  onChange={e => setNewProp({...newProp, propertyType: e.target.value as any})}
                >
                  <option value="self_occupied">Self Occupied</option>
                  <option value="let_out">Let Out</option>
                  <option value="deemed_let_out">Deemed Let Out</option>
                </select>
              </div>

              {newProp.propertyType !== 'self_occupied' && (
                <>
                  <div className="tax-field">
                    <label className="schedule-field-label">
                      Annual Rent Received
                      <InfoTooltip 
                        title="Annual Rent" 
                        description="Total rent received or receivable. For deemed let out, enter expected market rent."
                      />
                    </label>
                    <input 
                      type="number" 
                      className="wizard-select" 
                      style={{ width: '100%', marginTop: '8px' }}
                      value={(newProp.annualRentPaise || 0) / 100 || ''}
                      onChange={e => setNewProp({...newProp, annualRentPaise: (parseFloat(e.target.value) || 0) * 100})}
                      placeholder="0"
                    />
                  </div>
                  <div className="tax-field">
                    <label className="schedule-field-label">
                      Municipal Taxes Paid
                      <InfoTooltip 
                        title="Municipal Taxes" 
                        description="Must be paid by you (the owner) in the current financial year."
                      />
                    </label>
                    <input 
                      type="number" 
                      className="wizard-select" 
                      style={{ width: '100%', marginTop: '8px' }}
                      value={(newProp.municipalTaxesPaise || 0) / 100 || ''}
                      onChange={e => setNewProp({...newProp, municipalTaxesPaise: (parseFloat(e.target.value) || 0) * 100})}
                      placeholder="0"
                    />
                  </div>
                </>
              )}

              <div className="tax-field">
                <label className="schedule-field-label">
                  Home Loan Interest Paid
                  <InfoTooltip 
                    title="Home Loan Interest" 
                    description="Interest portion of EMI. Get the provisional certificate from your bank."
                  />
                </label>
                <input 
                  type="number" 
                  className="wizard-select" 
                  style={{ width: '100%', marginTop: '8px' }}
                  value={(newProp.homeLoanInterestPaise || 0) / 100 || ''}
                  onChange={e => setNewProp({...newProp, homeLoanInterestPaise: (parseFloat(e.target.value) || 0) * 100})}
                  placeholder="0"
                />
              </div>
            </div>
            <button type="submit" className="wizard-nav-btn secondary" style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }}>
              ADD PROPERTY
            </button>
          </div>
        </form>
      </div>

      <div className="schedule-summary">
        <div className="schedule-summary-row">
          <span className="schedule-field-label">TOTAL INCOME FROM HOUSE PROPERTY</span>
          <span className="schedule-field-value" style={{ fontSize: '24px', color: scheduleHP.totalIncomePaise >= 0 ? '#00ff41' : '#ffb4ab' }}>
            {displayVal(scheduleHP.totalIncomePaise)}
          </span>
        </div>
      </div>

      {portalMappings.length > 0 && (
        <div className="portal-mapping" style={{ marginTop: '24px' }}>
          <div className="portal-mapping-title">
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '18px' }}>content_copy</span>
            PORTAL FIELD MAPPING
          </div>
          {portalMappings.map((m, i) => (
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
      )}

      <div className="assumption-list">
        <div className="schedule-section-title">NOTES & ASSUMPTIONS</div>
        <div className="assumption-item">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>circle</span>
          Self-occupied property is limited to ₹2,00,000 deduction on home loan interest.
        </div>
        <div className="assumption-item">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>circle</span>
          Let-out property allows actual interest and provides a flat 30% standard deduction on NAV.
        </div>
        <div className="assumption-item">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>circle</span>
          If loss under House Property exceeds ₹2,00,000, only ₹2,00,000 can be set off against other heads (balance carried forward).
        </div>
      </div>
    </div>
  );
}
