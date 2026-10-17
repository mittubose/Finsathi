/**
 * Indian Salary Tax Engine — FY 2025-26
 * All amounts in PAISE (integer math only).
 * Supports Old and New regime comparison.
 */

// ============ TYPES ============

export type TaxRegime = 'old' | 'new';
export type CityType = 'metro' | 'non-metro';

export interface SalaryInput {
  basicPaise: number;
  hraPaise: number;
  specialAllowancePaise: number;
  conveyancePaise: number;
  ltaPaise: number;
  bonusPaise: number;
  otherTaxablePaise: number;
  employerPfPaise: number;
  professionTaxPaise: number;
}

export interface DeductionInput {
  section80C_paise: number;      // PF, PPF, ELSS, LIC etc — max 1.5L
  section80D_paise: number;      // Health insurance — max 25K/50K
  section80E_paise: number;      // Education loan interest — no limit
  section80TTA_paise: number;    // Savings interest — max 10K
  homeLoanInterestPaise: number; // Sec 24b — max 2L
  nps80CCD_paise: number;       // NPS employer — max 10% of basic
  otherDeductionsPaise: number;
}

export interface HRAInput {
  rentPaidPaise: number;
  cityType: CityType;
}

export interface CapitalGainsInput {
  stcgPaise: number;
  ltcgPaise: number;
  intradayPaise: number;
  stcgTaxPaise: number;
  ltcgTaxPaise: number;
  intradayTaxPaise: number;
}

export interface TaxInput {
  salary: SalaryInput;
  deductions: DeductionInput;
  hra?: HRAInput;
  tdsDeductedPaise: number;
  fy: string;
  capitalGains?: CapitalGainsInput;
}

export interface TaxSlab {
  fromPaise: number;
  toPaise: number | null; // null = unlimited
  rate: number; // percentage
}

export interface TaxResult {
  regime: TaxRegime;
  grossSalaryPaise: number;
  standardDeductionPaise: number;
  hraExemptionPaise: number;
  totalDeductionsPaise: number;
  taxableIncomePaise: number;
  taxOnIncomePaise: number;
  capitalGainsTaxPaise: number;
  rebate87APaise: number;
  surchargeRate: number;
  surchargePaise: number;
  cessPaise: number;
  totalTaxPaise: number;
  effectiveRate: number;
  tdsDeductedPaise: number;
  balanceTaxPaise: number;
  assumptions: string[];
}

export interface RegimeComparison {
  oldRegime: TaxResult;
  newRegime: TaxResult;
  recommendation: TaxRegime;
  savingsPaise: number;
}

// ============ SLAB DEFINITIONS (FY 2025-26) ============

const NEW_REGIME_SLABS: TaxSlab[] = [
  { fromPaise: 0, toPaise: 400000_00, rate: 0 },
  { fromPaise: 400000_00, toPaise: 800000_00, rate: 5 },
  { fromPaise: 800000_00, toPaise: 1200000_00, rate: 10 },
  { fromPaise: 1200000_00, toPaise: 1600000_00, rate: 15 },
  { fromPaise: 1600000_00, toPaise: 2000000_00, rate: 20 },
  { fromPaise: 2000000_00, toPaise: 2400000_00, rate: 25 },
  { fromPaise: 2400000_00, toPaise: null, rate: 30 },
];

const OLD_REGIME_SLABS: TaxSlab[] = [
  { fromPaise: 0, toPaise: 250000_00, rate: 0 },
  { fromPaise: 250000_00, toPaise: 500000_00, rate: 5 },
  { fromPaise: 500000_00, toPaise: 1000000_00, rate: 20 },
  { fromPaise: 1000000_00, toPaise: null, rate: 30 },
];

const CESS_RATE = 4; // 4% Health & Education Cess

// Standard deductions
const NEW_REGIME_STD_DEDUCTION_PAISE = 75000_00;
const OLD_REGIME_STD_DEDUCTION_PAISE = 50000_00;

// Deduction limits (Old Regime)
const LIMIT_80C_PAISE = 150000_00;
const LIMIT_80D_PAISE = 25000_00;
const LIMIT_80D_SENIOR_PAISE = 50000_00;
const LIMIT_80TTA_PAISE = 10000_00;
const LIMIT_HOME_LOAN_PAISE = 200000_00;

// Rebate u/s 87A
const NEW_REGIME_87A_INCOME_LIMIT_PAISE = 1200000_00;
const NEW_REGIME_87A_MAX_REBATE_PAISE = 25000_00;
const OLD_REGIME_87A_INCOME_LIMIT_PAISE = 500000_00;
const OLD_REGIME_87A_MAX_REBATE_PAISE = 12500_00;

// ============ CALCULATION FUNCTIONS ============

function calculateGrossSalary(salary: SalaryInput): number {
  return (
    salary.basicPaise +
    salary.hraPaise +
    salary.specialAllowancePaise +
    salary.conveyancePaise +
    salary.ltaPaise +
    salary.bonusPaise +
    salary.otherTaxablePaise
  );
}

function calculateHRAExemption(salary: SalaryInput, hra?: HRAInput): number {
  if (!hra || hra.rentPaidPaise <= 0) return 0;

  const basicAnnual = salary.basicPaise;
  const hraReceived = salary.hraPaise;
  const rentPaid = hra.rentPaidPaise;
  const tenPercentBasic = Math.floor(basicAnnual * 10 / 100);
  const hraPct = hra.cityType === 'metro' ? 50 : 40;
  const pctOfBasic = Math.floor(basicAnnual * hraPct / 100);

  // HRA exemption = MIN of:
  // 1. Actual HRA received
  // 2. Rent paid - 10% of basic
  // 3. 50%/40% of basic (metro/non-metro)
  const option2 = Math.max(0, rentPaid - tenPercentBasic);
  return Math.min(hraReceived, option2, pctOfBasic);
}

function capDeduction(amount: number, limit: number): number {
  return Math.min(amount, limit);
}

function calculateOldRegimeDeductions(input: TaxInput): { total: number; breakdown: Record<string, number> } {
  const d = input.deductions;
  const breakdown: Record<string, number> = {};

  breakdown['Standard Deduction'] = OLD_REGIME_STD_DEDUCTION_PAISE;
  breakdown['Section 80C'] = capDeduction(d.section80C_paise, LIMIT_80C_PAISE);
  breakdown['Section 80D'] = capDeduction(d.section80D_paise, LIMIT_80D_PAISE);
  breakdown['Section 80E'] = d.section80E_paise; // no limit
  breakdown['Section 80TTA'] = capDeduction(d.section80TTA_paise, LIMIT_80TTA_PAISE);
  breakdown['Home Loan Interest (24b)'] = capDeduction(d.homeLoanInterestPaise, LIMIT_HOME_LOAN_PAISE);
  breakdown['NPS 80CCD'] = d.nps80CCD_paise;
  breakdown['Profession Tax'] = input.salary.professionTaxPaise;
  breakdown['Other Deductions'] = d.otherDeductionsPaise;

  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return { total, breakdown };
}

function calculateSlabTax(taxableIncome: number, slabs: TaxSlab[]): number {
  let tax = 0;

  for (const slab of slabs) {
    if (taxableIncome <= slab.fromPaise) break;

    const upper = slab.toPaise !== null ? Math.min(taxableIncome, slab.toPaise) : taxableIncome;
    const taxableInSlab = upper - slab.fromPaise;
    tax += Math.floor(taxableInSlab * slab.rate / 100);
  }

  return tax;
}

function calculateSurcharge(taxPaise: number, taxableIncomePaise: number): { rate: number; amount: number } {
  const income = taxableIncomePaise;

  // Surcharge slabs
  if (income > 500000000_00) return { rate: 37, amount: Math.floor(taxPaise * 37 / 100) };
  if (income > 200000000_00) return { rate: 25, amount: Math.floor(taxPaise * 25 / 100) };
  if (income > 100000000_00) return { rate: 15, amount: Math.floor(taxPaise * 15 / 100) };
  if (income > 50000000_00) return { rate: 10, amount: Math.floor(taxPaise * 10 / 100) };

  return { rate: 0, amount: 0 };
}

function calculateRebate87A(taxableIncome: number, tax: number, regime: TaxRegime): number {
  if (regime === 'new') {
    if (taxableIncome <= NEW_REGIME_87A_INCOME_LIMIT_PAISE) {
      return Math.min(tax, NEW_REGIME_87A_MAX_REBATE_PAISE);
    }
  } else {
    if (taxableIncome <= OLD_REGIME_87A_INCOME_LIMIT_PAISE) {
      return Math.min(tax, OLD_REGIME_87A_MAX_REBATE_PAISE);
    }
  }
  return 0;
}

// ============ MAIN COMPUTATION ============

export function computeTax(input: TaxInput, regime: TaxRegime): TaxResult {
  const assumptions: string[] = [];
  const grossSalary = calculateGrossSalary(input.salary);

  let hraExemption = 0;
  let totalDeductions = 0;
  let standardDeduction = 0;

  if (regime === 'new') {
    standardDeduction = NEW_REGIME_STD_DEDUCTION_PAISE;
    totalDeductions = standardDeduction + input.salary.professionTaxPaise;
    assumptions.push('New Regime: No 80C, 80D, HRA exemptions available');
    assumptions.push(`Standard deduction: ₹${(NEW_REGIME_STD_DEDUCTION_PAISE / 100).toLocaleString('en-IN')}`);
  } else {
    standardDeduction = OLD_REGIME_STD_DEDUCTION_PAISE;
    hraExemption = calculateHRAExemption(input.salary, input.hra);
    const oldDed = calculateOldRegimeDeductions(input);
    totalDeductions = oldDed.total + hraExemption;
    assumptions.push('Old Regime: Deductions applied based on declared amounts');
    if (hraExemption > 0) {
      assumptions.push(`HRA exemption: ₹${(hraExemption / 100).toLocaleString('en-IN')}`);
    }
  }

  const taxableIncome = Math.max(0, grossSalary - totalDeductions);
  const slabs = regime === 'new' ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
  let taxOnIncome = calculateSlabTax(taxableIncome, slabs);

  const rebate = calculateRebate87A(taxableIncome, taxOnIncome, regime);
  taxOnIncome = Math.max(0, taxOnIncome - rebate);

  // Capital Gains are taxed at special rates (pre-calculated in input)
  const capitalGainsTax = input.capitalGains ? input.capitalGains.stcgTaxPaise + input.capitalGains.ltcgTaxPaise + input.capitalGains.intradayTaxPaise : 0;
  if (capitalGainsTax > 0) {
    assumptions.push(`Capital Gains Tax added: ₹${(capitalGainsTax / 100).toLocaleString('en-IN')}`);
  }

  const totalTaxBeforeCess = taxOnIncome + capitalGainsTax;
  const surcharge = calculateSurcharge(totalTaxBeforeCess, taxableIncome); // Surcharge is on total tax
  const taxAfterSurcharge = totalTaxBeforeCess + surcharge.amount;
  const cess = Math.floor(taxAfterSurcharge * CESS_RATE / 100);
  const totalTax = taxAfterSurcharge + cess;

  const effectiveRate = grossSalary > 0
    ? Math.round((totalTax / grossSalary) * 10000) / 100
    : 0;

  assumptions.push(`Health & Education Cess: ${CESS_RATE}%`);
  assumptions.push('This is an estimate. Verify before filing.');

  return {
    regime,
    grossSalaryPaise: grossSalary,
    standardDeductionPaise: standardDeduction,
    hraExemptionPaise: hraExemption,
    totalDeductionsPaise: totalDeductions,
    taxableIncomePaise: taxableIncome,
    taxOnIncomePaise: taxOnIncome,
    capitalGainsTaxPaise: capitalGainsTax,
    rebate87APaise: rebate,
    surchargeRate: surcharge.rate,
    surchargePaise: surcharge.amount,
    cessPaise: cess,
    totalTaxPaise: totalTax,
    effectiveRate,
    tdsDeductedPaise: input.tdsDeductedPaise,
    balanceTaxPaise: totalTax - input.tdsDeductedPaise,
    assumptions,
  };
}

export function compareRegimes(input: TaxInput): RegimeComparison {
  const oldResult = computeTax(input, 'old');
  const newResult = computeTax(input, 'new');

  const recommendation = oldResult.totalTaxPaise <= newResult.totalTaxPaise ? 'old' : 'new';
  const savingsPaise = Math.abs(oldResult.totalTaxPaise - newResult.totalTaxPaise);

  return {
    oldRegime: oldResult,
    newRegime: newResult,
    recommendation,
    savingsPaise,
  };
}

// ============ CAPITAL GAINS ============

export type GainType = 'STCG' | 'LTCG' | 'INTRADAY';

export interface TradeEntry {
  instrument: string;
  buyDate: Date;
  sellDate: Date;
  qty: number;
  buyPricePaise: number;
  sellPricePaise: number;
  chargesPaise: number;
}

export interface TradeResult {
  trade: TradeEntry;
  gainType: GainType;
  holdingDays: number;
  grossPnlPaise: number;
  netPnlPaise: number;
  taxPaise: number;
}

// FY 2025-26 rates
const STCG_RATE = 20;
const LTCG_RATE = 12.5;
const INTRADAY_RATE = 30; // Speculative income (taxed at slab, using 30% as safe max)
const LTCG_EXEMPTION_PAISE = 125000_00; // ₹1.25L

export function classifyTrade(buyDate: Date, sellDate: Date): GainType {
  const isSameDay = 
    buyDate.getFullYear() === sellDate.getFullYear() &&
    buyDate.getMonth() === sellDate.getMonth() &&
    buyDate.getDate() === sellDate.getDate();
  
  if (isSameDay) return 'INTRADAY';

  const months =
    (sellDate.getFullYear() - buyDate.getFullYear()) * 12 +
    (sellDate.getMonth() - buyDate.getMonth());
  return months >= 12 ? 'LTCG' : 'STCG';
}

export function computeTradeGain(trade: TradeEntry): TradeResult {
  const gainType = classifyTrade(trade.buyDate, trade.sellDate);
  const diffMs = trade.sellDate.getTime() - trade.buyDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const grossPnl = (trade.sellPricePaise - trade.buyPricePaise) * trade.qty;
  const netPnl = grossPnl - trade.chargesPaise;

  // Tax only on positive gains
  let tax = 0;
  if (netPnl > 0) {
    if (gainType === 'STCG') {
      tax = Math.floor(netPnl * STCG_RATE / 100);
    } else if (gainType === 'INTRADAY') {
      tax = Math.floor(netPnl * INTRADAY_RATE / 100);
    } else {
      tax = Math.floor(netPnl * LTCG_RATE / 100);
    }
  }

  return {
    trade,
    gainType,
    holdingDays: days,
    grossPnlPaise: grossPnl,
    netPnlPaise: netPnl,
    taxPaise: tax,
  };
}

export function computePortfolioGains(trades: TradeEntry[]): {
  results: TradeResult[];
  totalSTCGPaise: number;
  totalLTCGPaise: number;
  totalIntradayPaise: number;
  totalSTCLPaise: number;
  totalLTCLPaise: number;
  totalIntradayLossPaise: number;
  stcgTaxPaise: number;
  ltcgTaxPaise: number;
  intradayTaxPaise: number;
  netTaxPaise: number;
} {
  const results = trades.map(computeTradeGain);

  let totalSTCG = 0;
  let totalLTCG = 0;
  let totalIntraday = 0;
  let totalSTCL = 0;
  let totalLTCL = 0;
  let totalIntradayLoss = 0;

  for (const r of results) {
    if (r.gainType === 'INTRADAY') {
      if (r.netPnlPaise >= 0) totalIntraday += r.netPnlPaise;
      else totalIntradayLoss += Math.abs(r.netPnlPaise);
    } else if (r.gainType === 'STCG') {
      if (r.netPnlPaise >= 0) totalSTCG += r.netPnlPaise;
      else totalSTCL += Math.abs(r.netPnlPaise);
    } else {
      if (r.netPnlPaise >= 0) totalLTCG += r.netPnlPaise;
      else totalLTCL += Math.abs(r.netPnlPaise);
    }
  }

  // Loss set-off rules:
  // Intraday loss can ONLY offset Intraday profit
  // STCL can offset STCG + LTCG
  // LTCL can only offset LTCG
  let netIntraday = Math.max(0, totalIntraday - totalIntradayLoss);
  let netSTCG = Math.max(0, totalSTCG - totalSTCL);
  let remainingSTCL = Math.max(0, totalSTCL - totalSTCG);
  let netLTCG = Math.max(0, totalLTCG - totalLTCL - remainingSTCL);

  // Apply LTCG exemption
  const ltcgAfterExemption = Math.max(0, netLTCG - LTCG_EXEMPTION_PAISE);

  const stcgTax = Math.floor(netSTCG * STCG_RATE / 100);
  const ltcgTax = Math.floor(ltcgAfterExemption * LTCG_RATE / 100);
  const intradayTax = Math.floor(netIntraday * INTRADAY_RATE / 100);

  return {
    results,
    totalSTCGPaise: totalSTCG,
    totalLTCGPaise: totalLTCG,
    totalIntradayPaise: totalIntraday,
    totalSTCLPaise: totalSTCL,
    totalLTCLPaise: totalLTCL,
    totalIntradayLossPaise: totalIntradayLoss,
    stcgTaxPaise: stcgTax,
    ltcgTaxPaise: ltcgTax,
    intradayTaxPaise: intradayTax,
    netTaxPaise: stcgTax + ltcgTax + intradayTax,
  };
}
