import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePlanningStore } from '../../shared/hooks/usePlanningStore';
import { useSettingsStore } from '../../shared/hooks/useSettingsStore';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { toPaise, formatINR } from '../../shared/lib/currency';
import './PlanningHub.css';

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type TabKey = 'budget' | 'debt' | 'education' | 'wealth' | 'fire';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'budget', label: 'BUDGET', icon: 'savings' },
  { key: 'debt', label: 'DEBT', icon: 'account_balance' },
  { key: 'education', label: 'EDUCATION', icon: 'school' },
  { key: 'wealth', label: 'WEALTH', icon: 'trending_up' },
  { key: 'fire', label: 'FIRE & FREEDOM', icon: 'local_fire_department' },
];

const COLOR_OPTIONS = [
  { label: 'Green', value: 'var(--positive)' },
  { label: 'Yellow', value: 'var(--warning)' },
  { label: 'Red', value: 'var(--error)' },
  { label: 'Blue', value: 'var(--accent)' },
];

export const PlanningHub: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabKey) || 'budget';

  const { buckets, addBucket, deleteBucket, loans, addLoan, deleteLoan } =
    usePlanningStore();
  const { baseInflationRate, educationInflationRate, expectedEquityReturn } =
    useSettingsStore();

  /* ── Budget local state ───────────────────────────── */
  const [bucketName, setBucketName] = useState('');
  const [bucketAmount, setBucketAmount] = useState('');
  const [bucketColor, setBucketColor] = useState(COLOR_OPTIONS[0].value);

  /* ── Debt local state ─────────────────────────────── */
  const [loanName, setLoanName] = useState('');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanRate, setLoanRate] = useState('');
  const [loanTenure, setLoanTenure] = useState('');

  /* ── Education local state ────────────────────────── */
  const [eduCost, setEduCost] = useState('2000000');
  const [eduYears, setEduYears] = useState('15');
  const [eduSaved, setEduSaved] = useState('0');

  /* ── Wealth local state ───────────────────────────── */
  const [wealthSavings, setWealthSavings] = useState('100000');
  const [wealthSip, setWealthSip] = useState('10000');
  const [wealthYears, setWealthYears] = useState('10');
  const [wealthStepUp, setWealthStepUp] = useState('10');

  /* ── Debt extra prepay state ──────────────────────── */
  const [debtPrepay, setDebtPrepay] = useState('5000');

  /* ── FIRE local state ─────────────────────────────── */
  const [fireMonthlyExpenses, setFireMonthlyExpenses] = useState('60000');
  const [fireCurrentAge, setFireCurrentAge] = useState('28');
  const [fireTargetAge, setFireTargetAge] = useState('45');
  const [fireCurrentCorpus, setFireCurrentCorpus] = useState('1000000');
  const [fireMonthlySip, setFireMonthlySip] = useState('40000');
  const [fireStepUp, setFireStepUp] = useState('10');

  /* ── Helpers ──────────────────────────────────────── */
  const switchTab = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  const computeEmi = (p: number, annualRate: number, months: number) => {
    const r = annualRate / 12 / 100;
    if (r === 0) return months > 0 ? p / months : 0;
    return (p * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  };

  const handleAddBucket = () => {
    const amt = parseFloat(bucketAmount);
    if (!bucketName.trim() || isNaN(amt) || amt <= 0) return;
    addBucket({
      id: generateId(),
      name: bucketName.trim(),
      allocatedPaise: toPaise(amt),
      color: bucketColor,
    });
    setBucketName('');
    setBucketAmount('');
    setBucketColor(COLOR_OPTIONS[0].value);
  };

  const handleAddLoan = () => {
    const p = parseFloat(loanPrincipal);
    const r = parseFloat(loanRate);
    const t = parseInt(loanTenure, 10);
    if (!loanName.trim() || isNaN(p) || isNaN(r) || isNaN(t) || p <= 0 || t <= 0)
      return;
    addLoan({
      id: generateId(),
      name: loanName.trim(),
      principalAmountPaise: toPaise(p),
      interestRate: r,
      tenureMonths: t,
      startDate: new Date().toISOString(),
    });
    setLoanName('');
    setLoanPrincipal('');
    setLoanRate('');
    setLoanTenure('');
  };

  /* ── Education computations ───────────────────────── */
  const eduCostNum = parseFloat(eduCost) || 0;
  const eduYearsNum = parseFloat(eduYears) || 0;
  const eduSavedNum = parseFloat(eduSaved) || 0;
  const eduInflation = educationInflationRate / 100;
  const eduReturn = expectedEquityReturn / 100;

  const futureCost = eduCostNum * Math.pow(1 + eduInflation, eduYearsNum);
  const futureSavings = eduSavedNum * Math.pow(1 + eduReturn, eduYearsNum);
  const shortfall = Math.max(0, futureCost - futureSavings);

  const monthlyReturnRate = eduReturn / 12;
  const totalMonths = eduYearsNum * 12;
  const requiredSip =
    monthlyReturnRate > 0 && totalMonths > 0
      ? (shortfall * monthlyReturnRate) /
        (Math.pow(1 + monthlyReturnRate, totalMonths) - 1)
      : totalMonths > 0
        ? shortfall / totalMonths
        : 0;

  /* ── Wealth computations ──────────────────────────── */
  const wSavings = parseFloat(wealthSavings) || 0;
  const wSip = parseFloat(wealthSip) || 0;
  const wYears = parseFloat(wealthYears) || 0;
  const wReturn = expectedEquityReturn / 100;
  const wInflation = baseInflationRate / 100;
  const wMonthlyReturn = wReturn / 12;
  const wTotalMonths = wYears * 12;

  const fvLumpsum = wSavings * Math.pow(1 + wReturn, wYears);
  const fvSip =
    wMonthlyReturn > 0 && wTotalMonths > 0
      ? wSip *
        ((Math.pow(1 + wMonthlyReturn, wTotalMonths) - 1) / wMonthlyReturn) *
        (1 + wMonthlyReturn)
      : wSip * wTotalMonths;
  const futureValueNominal = fvLumpsum + fvSip;
  const purchasingPower =
    futureValueNominal / Math.pow(1 + wInflation, wYears);

  // Step-Up SIP calculation (annual escalation)
  const wStepUpRate = (parseFloat(wealthStepUp) || 0) / 100;
  let fvStepUp = wSavings;
  let currentMonthSip = wSip;
  for (let yr = 1; yr <= wYears; yr++) {
    for (let m = 0; m < 12; m++) {
      fvStepUp = (fvStepUp + currentMonthSip) * (1 + wMonthlyReturn);
    }
    currentMonthSip = currentMonthSip * (1 + wStepUpRate);
  }

  /* ── Debt Prepayment acceleration ─────────────────── */
  const extraPmt = parseFloat(debtPrepay) || 0;
  const totalMonthlyEmi = loans.reduce((s, l) => s + computeEmi(l.principalAmountPaise / 100, l.interestRate, l.tenureMonths), 0);
  const totalBaselineInterest = loans.reduce((s, l) => {
    const p = l.principalAmountPaise / 100;
    const emi = computeEmi(p, l.interestRate, l.tenureMonths);
    return s + (emi * l.tenureMonths - p);
  }, 0);
  const prepayFactor = extraPmt > 0 && totalMonthlyEmi > 0 ? (totalMonthlyEmi / (totalMonthlyEmi + extraPmt)) : 1;
  const estAcceleratedInterest = totalBaselineInterest * Math.pow(prepayFactor, 1.25);
  const totalInterestSaved = Math.max(0, totalBaselineInterest - estAcceleratedInterest);
  const maxTenure = loans.reduce((max, l) => Math.max(max, l.tenureMonths), 0);
  const monthsSaved = extraPmt > 0 ? Math.round(maxTenure * (1 - prepayFactor)) : 0;

  /* ── FIRE computations ────────────────────────────── */
  const fExp = parseFloat(fireMonthlyExpenses) || 60000;
  const fCurAge = parseFloat(fireCurrentAge) || 28;
  const fTgtAge = parseFloat(fireTargetAge) || 45;
  const fCorpus = parseFloat(fireCurrentCorpus) || 0;
  const fSip = parseFloat(fireMonthlySip) || 0;
  const fStepUp = (parseFloat(fireStepUp) || 0) / 100;
  const fYears = Math.max(1, fTgtAge - fCurAge);

  const futureAnnualExp = fExp * 12 * Math.pow(1 + wInflation, fYears);
  const fullFireNumber = futureAnnualExp * 25; // 4% rule
  const leanFireNumber = fullFireNumber * 0.75;
  const fatFireNumber = fullFireNumber * 1.5;
  const coastFireNumber = fullFireNumber / Math.pow(1 + wReturn, fYears);

  // Simulation to find year when FIRE is hit
  let projPortfolio = fCorpus;
  let curSip = fSip;
  let yearsToFire = 0;
  let reachedFire = false;

  for (let yr = 1; yr <= 40; yr++) {
    for (let m = 0; m < 12; m++) {
      projPortfolio = (projPortfolio + curSip) * (1 + wMonthlyReturn);
    }
    curSip = curSip * (1 + fStepUp);
    const neededAtYr = fExp * 12 * Math.pow(1 + wInflation, yr) * 25;
    if (projPortfolio >= neededAtYr && !reachedFire) {
      yearsToFire = yr;
      reachedFire = true;
    }
  }
  if (!reachedFire) yearsToFire = 40;

  /* ── Total allocated budget ───────────────────────── */
  const totalAllocatedPaise = buckets.reduce(
    (sum, b) => sum + b.allocatedPaise,
    0
  );

  return (
    <div className="planning-hub animate-in">
      {/* ── Tab Bar ─────────────────────────────────── */}
      <div className="planning-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`planning-tab${activeTab === t.key ? ' active' : ''}`}
            onClick={() => switchTab(t.key)}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 16,
                marginRight: 6,
                verticalAlign: 'middle',
                fontVariationSettings: "'wght' 200",
              }}
            >
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BUDGET ──────────────────────────────────── */}
      {activeTab === 'budget' && (
        <div className="planning-tab-content" key="budget">
          <div className="planning-form-card">
            <div className="planning-form-grid cols-3">
              <div className="planning-field">
                <label>Bucket Name</label>
                <input
                  type="text"
                  placeholder="e.g. Groceries"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value)}
                />
              </div>
              <div className="planning-field">
                <label>Amount ₹</label>
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  value={bucketAmount}
                  onChange={(e) => setBucketAmount(e.target.value)}
                />
              </div>
              <div className="planning-field">
                <label>Color Theme</label>
                <select
                  value={bucketColor}
                  onChange={(e) => setBucketColor(e.target.value)}
                >
                  {COLOR_OPTIONS.map((c) => (
                    <option key={c.label} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="planning-btn-primary" onClick={handleAddBucket}>
                ADD_BUCKET
              </button>
            </div>
          </div>

          {/* Total allocated */}
          {buckets.length > 0 && (
            <div
              className="text-label-mono-sm"
              style={{
                color: 'rgba(255,255,255,0.45)',
                marginBottom: 12,
              }}
            >
              TOTAL ALLOCATED:{' '}
              <CurrencyValue paise={totalAllocatedPaise} compact />
            </div>
          )}

          {/* Bucket list */}
          {buckets.length > 0 ? (
            <div className="planning-item-list">
              {buckets.map((bucket) => (
                <div
                  key={bucket.id}
                  className="planning-item-card"
                  style={{ borderLeftColor: bucket.color }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>
                      {bucket.name}
                    </div>
                    <div
                      className="text-label-mono-sm"
                      style={{ marginTop: 4, color: 'rgba(255,255,255,0.5)' }}
                    >
                      <CurrencyValue paise={bucket.allocatedPaise} />
                    </div>
                  </div>
                  <div className="planning-actions">
                    <button
                      className="planning-icon-btn"
                      onClick={() => deleteBucket(bucket.id)}
                      title="Delete bucket"
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: 18,
                          fontVariationSettings: "'wght' 200",
                        }}
                      >
                        delete
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="planning-empty">
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 48,
                  color: 'rgba(255,255,255,0.15)',
                  fontVariationSettings: "'wght' 200",
                }}
              >
                savings
              </span>
              <span
                className="text-label-mono-sm"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                No buckets configured
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── DEBT ────────────────────────────────────── */}
      {activeTab === 'debt' && (
        <div className="planning-tab-content" key="debt">
          <div className="planning-form-card">
            <div className="planning-form-grid cols-4">
              <div className="planning-field">
                <label>Loan Name</label>
                <input
                  type="text"
                  placeholder="e.g. Home Loan"
                  value={loanName}
                  onChange={(e) => setLoanName(e.target.value)}
                />
              </div>
              <div className="planning-field">
                <label>Principal ₹</label>
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  value={loanPrincipal}
                  onChange={(e) => setLoanPrincipal(e.target.value)}
                />
              </div>
              <div className="planning-field">
                <label>Annual Rate %</label>
                <input
                  type="number"
                  placeholder="8.5"
                  min="0"
                  step="0.1"
                  value={loanRate}
                  onChange={(e) => setLoanRate(e.target.value)}
                />
              </div>
              <div className="planning-field">
                <label>Tenure Months</label>
                <input
                  type="number"
                  placeholder="240"
                  min="1"
                  value={loanTenure}
                  onChange={(e) => setLoanTenure(e.target.value)}
                />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="planning-btn-primary" onClick={handleAddLoan}>
                ADD_LOAN
              </button>
            </div>
          </div>

          {/* Loan list */}
          {loans.length > 0 ? (
            <div className="planning-item-list">
              {loans.map((loan) => {
                const principal = loan.principalAmountPaise / 100;
                const emi = computeEmi(
                  principal,
                  loan.interestRate,
                  loan.tenureMonths
                );
                const totalInterest = emi * loan.tenureMonths - principal;
                const start = new Date(loan.startDate).getTime();
                const now = Date.now();
                const elapsedMonths = Math.max(
                  0,
                  (now - start) / (1000 * 60 * 60 * 24 * 30.44)
                );
                const progressPct = Math.min(
                  100,
                  (elapsedMonths / loan.tenureMonths) * 100
                );

                return (
                  <div key={loan.id} className="planning-form-card" style={{ padding: 20 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 15 }}>
                          {loan.name}
                        </div>
                        <div
                          className="text-label-mono-sm"
                          style={{
                            marginTop: 4,
                            color: 'rgba(255,255,255,0.45)',
                          }}
                        >
                          {loan.interestRate}% &middot; {loan.tenureMonths} months
                        </div>
                      </div>
                      <button
                        className="planning-icon-btn"
                        onClick={() => deleteLoan(loan.id)}
                        title="Delete loan"
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: 18,
                            fontVariationSettings: "'wght' 200",
                          }}
                        >
                          delete
                        </span>
                      </button>
                    </div>

                    <div
                      className="planning-form-grid cols-3"
                      style={{ marginTop: 16 }}
                    >
                      <div>
                        <div
                          className="text-label-mono-sm"
                          style={{ color: 'rgba(255,255,255,0.45)' }}
                        >
                          PRINCIPAL
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <CurrencyValue paise={loan.principalAmountPaise} compact />
                        </div>
                      </div>
                      <div>
                        <div
                          className="text-label-mono-sm"
                          style={{ color: 'rgba(255,255,255,0.45)' }}
                        >
                          MONTHLY EMI
                        </div>
                        <div style={{ marginTop: 4, color: 'var(--warning)' }}>
                          <CurrencyValue paise={toPaise(emi)} compact />
                        </div>
                      </div>
                      <div>
                        <div
                          className="text-label-mono-sm"
                          style={{ color: 'rgba(255,255,255,0.45)' }}
                        >
                          TOTAL INTEREST
                        </div>
                        <div style={{ marginTop: 4, color: 'var(--error)' }}>
                          <CurrencyValue paise={toPaise(totalInterest)} compact />
                        </div>
                      </div>
                    </div>

                    <div className="planning-progress-bar">
                      <div
                        className="planning-progress-fill"
                        style={{
                          width: `${progressPct}%`,
                          background: 'var(--primary-container)',
                        }}
                      />
                    </div>
                    <div
                      className="text-label-mono-sm"
                      style={{
                        marginTop: 6,
                        color: 'rgba(255,255,255,0.35)',
                        fontSize: 10,
                      }}
                    >
                      {progressPct.toFixed(1)}% tenure elapsed
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="planning-empty">
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 48,
                  color: 'rgba(255,255,255,0.15)',
                  fontVariationSettings: "'wght' 200",
                }}
              >
                account_balance
              </span>
              <span
                className="text-label-mono-sm"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                No active loans
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── EDUCATION ───────────────────────────────── */}
      {activeTab === 'education' && (
        <div className="planning-tab-content" key="education">
          <div className="planning-form-card">
            <div className="planning-form-grid cols-3">
              <div className="planning-field">
                <label>Current Cost of Degree ₹</label>
                <input
                  type="number"
                  min="0"
                  value={eduCost}
                  onChange={(e) => setEduCost(e.target.value)}
                />
              </div>
              <div className="planning-field">
                <label>Years to College</label>
                <input
                  type="number"
                  min="0"
                  value={eduYears}
                  onChange={(e) => setEduYears(e.target.value)}
                />
              </div>
              <div className="planning-field">
                <label>Already Saved ₹</label>
                <input
                  type="number"
                  min="0"
                  value={eduSaved}
                  onChange={(e) => setEduSaved(e.target.value)}
                />
              </div>
            </div>
            <div
              className="text-label-mono-sm"
              style={{
                marginTop: 16,
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              Assumptions — Education Inflation: {educationInflationRate}% &middot;
              Equity Return: {expectedEquityReturn}%
            </div>
          </div>

          <div className="planning-form-grid cols-3">
            <div className="planning-stat-card">
              <div className="stat-label">FUTURE COST</div>
              <div className="stat-value" style={{ color: 'var(--error)' }}>
                <CurrencyValue paise={toPaise(futureCost)} compact />
              </div>
              <div className="stat-desc">
                Projected cost of degree after {eduYearsNum} years of education
                inflation
              </div>
            </div>
            <div className="planning-stat-card">
              <div className="stat-label">PROJECTED SHORTFALL</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>
                <CurrencyValue paise={toPaise(shortfall)} compact />
              </div>
              <div className="stat-desc">
                Gap between future cost and projected growth of current savings
              </div>
            </div>
            <div
              className="planning-stat-card"
              style={{ borderTop: '2px solid var(--accent)' }}
            >
              <div className="stat-label">REQUIRED MONTHLY SIP</div>
              <div className="stat-value" style={{ color: 'var(--accent)' }}>
                <CurrencyValue paise={toPaise(requiredSip)} compact />
              </div>
              <div className="stat-desc">
                Monthly investment needed at {expectedEquityReturn}% returns to
                bridge the shortfall
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── WEALTH ──────────────────────────────────── */}
      {activeTab === 'wealth' && (
        <div className="planning-tab-content" key="wealth">
          <div className="planning-form-card">
            <div className="planning-form-grid cols-3">
              <div className="planning-field">
                <label>Current Savings ₹</label>
                <input
                  type="number"
                  min="0"
                  value={wealthSavings}
                  onChange={(e) => setWealthSavings(e.target.value)}
                />
              </div>
              <div className="planning-field">
                <label>Monthly SIP ₹</label>
                <input
                  type="number"
                  min="0"
                  value={wealthSip}
                  onChange={(e) => setWealthSip(e.target.value)}
                />
              </div>
              <div className="planning-field">
                <label>Time Horizon Years</label>
                <input
                  type="number"
                  min="1"
                  value={wealthYears}
                  onChange={(e) => setWealthYears(e.target.value)}
                />
              </div>
              <div className="planning-field">
                <label>Annual Step-Up %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={wealthStepUp}
                  onChange={(e) => setWealthStepUp(e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>
            <div
              className="text-label-mono-sm"
              style={{
                marginTop: 16,
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              Assumptions — Equity Return: {expectedEquityReturn}% &middot;
              Inflation: {baseInflationRate}% &middot; Annual Step-Up: {wealthStepUp}%
            </div>
          </div>

          <div className="planning-form-grid cols-3">
            <div className="planning-stat-card">
              <div className="stat-label">FUTURE VALUE (FLAT SIP)</div>
              <div className="stat-value" style={{ color: 'var(--positive)' }}>
                <CurrencyValue paise={toPaise(futureValueNominal)} compact />
              </div>
              <div className="stat-desc">
                Projected portfolio value after {wYears} years at{' '}
                {expectedEquityReturn}% without annual salary hike increases
              </div>
            </div>
            <div className="planning-stat-card" style={{ borderTop: '2px solid var(--primary-container)' }}>
              <div className="stat-label">WITH {wealthStepUp}% ANNUAL STEP-UP</div>
              <div className="stat-value" style={{ color: 'var(--primary-container)' }}>
                <CurrencyValue paise={toPaise(fvStepUp)} compact />
              </div>
              <div className="stat-desc">
                Accelerated corpus from increasing SIP by {wealthStepUp}% each year (+{formatINR(toPaise(Math.max(0, fvStepUp - futureValueNominal)))} bonus!)
              </div>
            </div>
            <div className="planning-stat-card">
              <div className="stat-label">REAL PURCHASING POWER</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>
                <CurrencyValue paise={toPaise(purchasingPower)} compact />
              </div>
              <div className="stat-desc">
                Today's equivalent purchasing power after {baseInflationRate}% annual inflation
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FIRE & FREEDOM ───────────────────────────── */}
      {activeTab === 'fire' && (
        <div className="planning-tab-content" key="fire">
          <div className="planning-form-card">
            <div className="planning-form-grid cols-3">
              <div className="planning-field">
                <label>Current Monthly Living Expenses ₹</label>
                <input
                  type="number"
                  min="0"
                  value={fireMonthlyExpenses}
                  onChange={(e) => setFireMonthlyExpenses(e.target.value)}
                />
              </div>
              <div className="planning-field">
                <label>Current Age</label>
                <input
                  type="number"
                  min="18"
                  max="80"
                  value={fireCurrentAge}
                  onChange={(e) => setFireCurrentAge(e.target.value)}
                />
              </div>
              <div className="planning-field">
                <label>Target Financial Freedom Age</label>
                <input
                  type="number"
                  min="25"
                  max="90"
                  value={fireTargetAge}
                  onChange={(e) => setFireTargetAge(e.target.value)}
                />
              </div>
            </div>

            <div className="planning-form-grid cols-3" style={{ marginTop: '14px' }}>
              <div className="planning-field">
                <label>Current Invested Corpus ₹</label>
                <input
                  type="number"
                  min="0"
                  value={fireCurrentCorpus}
                  onChange={(e) => setFireCurrentCorpus(e.target.value)}
                />
              </div>
              <div className="planning-field">
                <label>Monthly Investment SIP ₹</label>
                <input
                  type="number"
                  min="0"
                  value={fireMonthlySip}
                  onChange={(e) => setFireMonthlySip(e.target.value)}
                />
              </div>
              <div className="planning-field">
                <label>Annual Step-Up %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={fireStepUp}
                  onChange={(e) => setFireStepUp(e.target.value)}
                />
              </div>
            </div>

            <div
              className="text-label-mono-sm"
              style={{
                marginTop: 16,
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              Model: Safe Withdrawal Rate (SWR) 4.0% (25x) &middot; Inflation: {baseInflationRate}% &middot; Returns: {expectedEquityReturn}%
            </div>
          </div>

          {/* FIRE Metrics Grid */}
          <div className="planning-form-grid cols-4">
            <div className="planning-stat-card" style={{ borderTop: '2px solid var(--primary-container)' }}>
              <div className="stat-label">FULL FIRE TARGET</div>
              <div className="stat-value" style={{ color: 'var(--primary-container)' }}>
                <CurrencyValue paise={toPaise(fullFireNumber)} compact />
              </div>
              <div className="stat-desc">
                25x projected annual expenses at age {fTgtAge} ({formatINR(toPaise(futureAnnualExp / 12))}/mo)
              </div>
            </div>

            <div className="planning-stat-card">
              <div className="stat-label">LEAN FIRE (SURVIVAL)</div>
              <div className="stat-value" style={{ color: 'var(--positive)' }}>
                <CurrencyValue paise={toPaise(leanFireNumber)} compact />
              </div>
              <div className="stat-desc">
                Core living expenses covered (75% baseline)
              </div>
            </div>

            <div className="planning-stat-card">
              <div className="stat-label">FAT FIRE (ABUNDANCE)</div>
              <div className="stat-value" style={{ color: 'var(--accent)' }}>
                <CurrencyValue paise={toPaise(fatFireNumber)} compact />
              </div>
              <div className="stat-desc">
                Luxury lifestyle with travel & upgrades (150% baseline)
              </div>
            </div>

            <div className="planning-stat-card">
              <div className="stat-label">COAST FIRE NUMBER</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>
                <CurrencyValue paise={toPaise(coastFireNumber)} compact />
              </div>
              <div className="stat-desc">
                Corpus required today to compound to FIRE without adding another rupee
              </div>
            </div>
          </div>

          {/* Freedom Trajectory Card */}
          <div className="planning-form-card" style={{ marginTop: '16px', background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.08) 0%, rgba(0, 0, 0, 0.3) 100%)', border: '1px solid rgba(0, 230, 118, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span className="text-label-mono-sm color-positive">PROJECTED FREEDOM TIMELINE</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
                  {reachedFire ? `Financial Freedom in ~${yearsToFire} years (Age ${Math.round(fCurAge + yearsToFire)})` : `Corpus growing — increase monthly SIP by 15% to hit target by Age ${fTgtAge}`}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                  Current portfolio ({formatINR(toPaise(fCorpus))}) represents {((fCorpus / fullFireNumber) * 100).toFixed(1)}% of your target retirement nest egg.
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>COAST STATUS</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: fCorpus >= coastFireNumber ? 'var(--positive)' : '#ffab00' }}>
                  {fCorpus >= coastFireNumber ? '✓ COAST FIRE ACHIEVED!' : `₹${Math.round((coastFireNumber - fCorpus) / 100000)}L to Coast`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
