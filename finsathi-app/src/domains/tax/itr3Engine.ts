/**
 * ITR-3 Filing Engine — AY 2025-26 (FY 2024-25)
 * 
 * Handles:
 * - Capital Gains with pre/post 23 July 2024 date split (Finance Act 2024)
 * - Multi-asset capital gains (equity, equity MF, debt MF, property, VDA, bonds, gold)
 * - F&O and Intraday turnover computation (Schedule BP)
 * - Business income P&L with expense tracking
 * - Section 44AB audit requirement flags
 * - Presumptive taxation (44AD/44ADA)
 * - Loss set-off rules with date-split awareness
 * - LTCG exemption apportionment
 * 
 * All amounts in PAISE (integer math only).
 */

import { computeTax, compareRegimes, type TaxInput, type TaxResult, type RegimeComparison } from './engine';

// ============ CONSTANTS ============

/** The Finance Act 2024 split date — rates changed on/after this date */
export const SPLIT_DATE = new Date(2024, 6, 23); // 23 July 2024 (month is 0-indexed)

// Pre-23 July 2024 rates
const PRE_SPLIT_STCG_EQUITY_RATE = 15;     // Section 111A
const PRE_SPLIT_LTCG_EQUITY_RATE = 10;     // Section 112A
const PRE_SPLIT_LTCG_EXEMPTION_PAISE = 100000_00; // ₹1,00,000

// Post-23 July 2024 rates
const POST_SPLIT_STCG_EQUITY_RATE = 20;    // Section 111A amended
const POST_SPLIT_LTCG_EQUITY_RATE = 12.5;  // Section 112A amended
const POST_SPLIT_LTCG_EXEMPTION_PAISE = 125000_00; // ₹1,25,000

// Debt MF rates (post April 2023 — no indexation, taxed at slab for LTCG if purchased after)
// For FY 2024-25, debt MFs purchased after 1 Apr 2023 have NO LTCG benefit
const DEBT_MF_STCG_RATE_PRE = 30;   // Taxed at slab, using 30% as safe max
const DEBT_MF_LTCG_RATE_PRE = 20;   // With indexation (pre-2023 purchases only)
const DEBT_MF_STCG_RATE_POST = 30;  // Still at slab
const DEBT_MF_LTCG_RATE_POST = 12.5; // New rate, no indexation

// Property rates
const PROPERTY_STCG_RATE = 30;      // Taxed at slab
const PROPERTY_LTCG_RATE_PRE = 20;  // With indexation
const PROPERTY_LTCG_RATE_POST = 12.5; // Without indexation

// VDA (crypto) rates
const VDA_RATE = 30; // Flat 30% regardless of holding period, no deductions

// F&O / Business
const PRESUMPTIVE_44AD_RATE_DIGITAL = 6;    // 6% for digital receipts
const PRESUMPTIVE_44AD_RATE_CASH = 8;       // 8% for cash receipts
const AUDIT_THRESHOLD_PAISE = 1000000000_00; // ₹10 Crore
const AUDIT_THRESHOLD_REDUCED_PAISE = 600000000_00; // ₹6 Crore (if cash < 5%)

// Intraday (speculative business) — taxed at slab rate, using 30% as conservative
const INTRADAY_SPECULATIVE_RATE = 30;

// ============ TYPES ============

export type AssetType = 'equity' | 'equity_mf' | 'debt_mf' | 'property' | 'vda' | 'bonds' | 'gold' | 'other';
export type TradeSubType = 'delivery' | 'intraday' | 'futures' | 'options';
export type GainClassification = 'STCG' | 'LTCG' | 'INTRADAY' | 'BUSINESS';
export type DateSplitPeriod = 'pre_split' | 'post_split';

/** Holding period thresholds for LTCG determination */
const HOLDING_PERIOD_MONTHS: Record<AssetType, number> = {
  equity: 12,
  equity_mf: 12,
  debt_mf: 36,      // 3 years for debt (pre-2023 purchases)
  property: 24,      // 2 years
  vda: 12,           // Crypto — doesn't really have LTCG but tracking anyway
  bonds: 12,
  gold: 36,          // 3 years
  other: 36,
};

// ============ SCHEDULE CG TYPES ============

export interface AssetGains {
  stcgPaise: number;
  ltcgPaise: number;
  stclPaise: number;
  ltclPaise: number;
  stcgTaxPaise: number;
  ltcgTaxPaise: number;
  tradeCount: number;
}

export interface DateSplitGains {
  equity: AssetGains;
  equity_mf: AssetGains;
  debt_mf: AssetGains;
  property: AssetGains;
  vda: AssetGains;
  bonds: AssetGains;
  gold: AssetGains;
  other: AssetGains;
}

function emptyAssetGains(): AssetGains {
  return { stcgPaise: 0, ltcgPaise: 0, stclPaise: 0, ltclPaise: 0, stcgTaxPaise: 0, ltcgTaxPaise: 0, tradeCount: 0 };
}

function emptyDateSplitGains(): DateSplitGains {
  return {
    equity: emptyAssetGains(),
    equity_mf: emptyAssetGains(),
    debt_mf: emptyAssetGains(),
    property: emptyAssetGains(),
    vda: emptyAssetGains(),
    bonds: emptyAssetGains(),
    gold: emptyAssetGains(),
    other: emptyAssetGains(),
  };
}

export interface ITR3ScheduleCG {
  preSplit: DateSplitGains;
  postSplit: DateSplitGains;
  /** Aggregates */
  totalSTCGPaise: number;
  totalLTCGPaise: number;
  totalSTCLPaise: number;
  totalLTCLPaise: number;
  /** After loss set-off */
  netSTCGPaise: number;
  netLTCGPaise: number;
  /** Tax */
  preSplitLTCGExemptionUsedPaise: number;
  postSplitLTCGExemptionUsedPaise: number;
  totalSTCGTaxPaise: number;
  totalLTCGTaxPaise: number;
  netCGTaxPaise: number;
  /** Carry forward */
  carryForwardSTCLPaise: number;
  carryForwardLTCLPaise: number;
  /** Assumptions */
  assumptions: string[];
  /** Per-trade results for drill-down */
  tradeResults: ITR3TradeResult[];
}

export interface ITR3TradeResult {
  tradeId: string;
  instrument: string;
  assetType: AssetType;
  subType?: TradeSubType;
  buyDate: Date;
  sellDate: Date;
  qty: number;
  buyPricePaise: number;
  sellPricePaise: number;
  chargesPaise: number;
  holdingDays: number;
  holdingMonths: number;
  classification: GainClassification;
  dateSplitPeriod: DateSplitPeriod;
  grossPnlPaise: number;
  netPnlPaise: number;
  taxRate: number;
  taxPaise: number;
}

// ============ SCHEDULE BP TYPES ============

export interface BusinessExpenseEntry {
  id: string;
  category: 'brokerage' | 'software' | 'internet' | 'advisory' | 'depreciation' | 'office' | 'other';
  label: string;
  amountPaise: number;
}

export interface ITR3ScheduleBP {
  /** F&O turnover = abs(profit) + abs(loss) for each contract */
  fnoTurnoverPaise: number;
  /** Intraday turnover = abs(profit) + abs(loss) per scrip */
  intradayTurnoverPaise: number;
  /** Combined turnover */
  totalTurnoverPaise: number;
  /** Gross trading receipts (profit side only) */
  grossReceiptsPaise: number;
  /** Trading losses */
  tradingLossPaise: number;
  /** Net trading income (can be negative = loss) */
  netTradingIncomePaise: number;
  /** Business expenses */
  expenses: BusinessExpenseEntry[];
  totalExpensesPaise: number;
  /** Net business income after expenses */
  netBusinessIncomePaise: number;
  /** Presumptive income under 44AD */
  presumptiveIncome6PctPaise: number;
  presumptiveIncome8PctPaise: number;
  /** Flags */
  isAuditRequired: boolean;
  auditReason: string | null;
  isPresumptiveEligible: boolean;
  booksOfAccountRequired: boolean;
  /** Speculative (intraday) tracked separately */
  speculativeIncomePaise: number;
  speculativeLossPaise: number;
  netSpeculativePaise: number;
  /** F&O (non-speculative) */
  fnoIncomePaise: number;
  fnoLossPaise: number;
  netFnoPaise: number;
  /** Trade counts */
  fnoTradeCount: number;
  intradayTradeCount: number;
  /** Assumptions */
  assumptions: string[];
}

export interface BookkeepingComputed {
  /** Trading Account - Intraday */
  intradaySalesPaise: number;
  intradayPurchasesPaise: number;
  intradayChargesPaise: number;
  intradayGrossProfitPaise: number;
  
  /** Trading Account - F&O */
  fnoSalesPaise: number;
  fnoPurchasesPaise: number;
  fnoChargesPaise: number;
  fnoGrossProfitPaise: number;
  
  /** P&L Account */
  totalGrossProfitPaise: number;
  otherIncomePaise: number; // dividends, interest
  indirectExpensesPaise: number; // business expenses
  netProfitPaise: number;

  /** Capital Account */
  openingCapitalPaise: number;
  drawingsPaise: number;
  closingCapitalPaise: number;

  /** Balance Sheet */
  assets: {
    fixedAssetsPaise: number;
    investmentsPaise: number;
    bankBalancePaise: number;
    brokerBalancePaise: number;
    cashBalancePaise: number;
    totalAssetsPaise: number;
  };
  liabilities: {
    capitalAccountPaise: number;
    loansPaise: number;
    totalLiabilitiesPaise: number;
  };
  isBalanced: boolean;
  imbalancePaise: number;
}

// ============ COMBINED ITR-3 TYPES ============

export interface HousePropertyEntry {
  id: string;
  propertyType: 'self_occupied' | 'let_out' | 'deemed_let_out';
  annualRentPaise: number;
  municipalTaxesPaise: number;
  homeLoanInterestPaise: number;
  preLettingInterestPaise: number;
}

export interface OtherSourceEntry {
  id: string;
  type: 'fd_interest' | 'savings_interest' | 'dividend' | 'gift' | 'other';
  amountPaise: number;
  tdsSection?: string;
  tdsPaidPaise: number;
  source: string;
}

export interface DeductionEntry {
  id: string;
  section: '80C' | '80CCC' | '80CCD1' | '80CCD1B' | '80CCD2' | '80D' | '80E' | '80EEA' | '80G' | '80GG' | '80TTA' | '80TTB' | '80U';
  amountPaise: number;
  limitPaise: number;
  proofStatus: 'verified' | 'pending' | 'missing';
  regimeEligibility: 'old_only' | 'both';
  notes: string;
}

export interface ITR3ScheduleHP {
  properties: HousePropertyEntry[];
  totalIncomePaise: number;
  breakdown: { id: string; navPaise: number; stdDeductionPaise: number; interestPaise: number; netPaise: number }[];
}

export interface ITR3ScheduleOS {
  entries: OtherSourceEntry[];
  totalIncomePaise: number;
  totalTDSPaise: number;
}

export interface ITR3ScheduleVIA {
  deductions: DeductionEntry[];
  totalAllowedPaise: number;
  regimeNote: string;
}

export interface ITR3FilingData {
  assessmentYear: string;
  financialYear: string;
  filingSection: '139(1)' | '139(4)' | '139(5)';
  form10IEA: { filed: boolean; regime: 'old' | 'new'; switchDate?: string };
  
  scheduleCG: ITR3ScheduleCG;
  scheduleBP: ITR3ScheduleBP;
  scheduleHP: ITR3ScheduleHP;
  scheduleOS: ITR3ScheduleOS;
  scheduleVIA: ITR3ScheduleVIA;
  
  /** From existing salary tax engine */
  salaryTaxResult?: TaxResult;
  regimeComparison?: RegimeComparison;
  
  /** Combined */
  totalIncomePaise: number;
  totalTaxPaise: number;
  totalTDSPaise: number;
  balanceTaxPaise: number;
}

// ============ TRADE INPUT ============

export interface ITR3TradeInput {
  id: string;
  instrument: string;
  assetType: AssetType;
  subType?: TradeSubType;
  buyDate: string;  // ISO date string
  sellDate: string; // ISO date string
  qty: number;
  buyPricePaise: number;
  sellPricePaise: number;
  chargesPaise: number;
  sttPaidPaise?: number;
  chargeBreakdown?: import('../../shared/hooks/useAppStore').ChargeBreakdown;
}

// ============ CORE CALCULATION FUNCTIONS ============

/**
 * Determine the date-split period for a transaction.
 * Based on the SELL date (realization date).
 */
export function getDateSplitPeriod(sellDate: Date): DateSplitPeriod {
  return sellDate < SPLIT_DATE ? 'pre_split' : 'post_split';
}

/**
 * Calculate holding period in months (for LTCG determination).
 */
function holdingMonths(buyDate: Date, sellDate: Date): number {
  return (
    (sellDate.getFullYear() - buyDate.getFullYear()) * 12 +
    (sellDate.getMonth() - buyDate.getMonth())
  );
}

/**
 * Classify a trade into STCG/LTCG/INTRADAY/BUSINESS based on asset type and holding period.
 */
export function classifyITR3Trade(
  buyDate: Date,
  sellDate: Date,
  assetType: AssetType,
  subType?: TradeSubType
): GainClassification {
  // F&O trades are always business income
  if (subType === 'futures' || subType === 'options') return 'BUSINESS';
  
  // Intraday equity is speculative business income
  if (subType === 'intraday') return 'INTRADAY';
  
  // Same-day delivery trades are also intraday
  const isSameDay =
    buyDate.getFullYear() === sellDate.getFullYear() &&
    buyDate.getMonth() === sellDate.getMonth() &&
    buyDate.getDate() === sellDate.getDate();
  if (isSameDay && (assetType === 'equity' || assetType === 'equity_mf')) return 'INTRADAY';
  
  // VDA (crypto) — technically no LTCG benefit at 30%, but we still classify for display
  // All VDA gains are taxed at 30% flat regardless
  
  // Check holding period against asset-specific threshold
  const months = holdingMonths(buyDate, sellDate);
  const threshold = HOLDING_PERIOD_MONTHS[assetType] || 36;
  
  return months >= threshold ? 'LTCG' : 'STCG';
}

/**
 * Get the applicable tax rate for a trade based on classification, asset type, and date period.
 */
export function getTaxRate(
  classification: GainClassification,
  assetType: AssetType,
  period: DateSplitPeriod
): number {
  // VDA is always 30% flat
  if (assetType === 'vda') return VDA_RATE;
  
  // Business income (F&O) — taxed at slab rates, return 30% as conservative max
  if (classification === 'BUSINESS') return 30; // Actually at slab
  
  // Intraday (speculative) — taxed at slab rates
  if (classification === 'INTRADAY') return INTRADAY_SPECULATIVE_RATE;
  
  const isPre = period === 'pre_split';
  
  if (classification === 'STCG') {
    switch (assetType) {
      case 'equity':
      case 'equity_mf':
        return isPre ? PRE_SPLIT_STCG_EQUITY_RATE : POST_SPLIT_STCG_EQUITY_RATE;
      case 'debt_mf':
        return isPre ? DEBT_MF_STCG_RATE_PRE : DEBT_MF_STCG_RATE_POST;
      case 'property':
        return PROPERTY_STCG_RATE; // At slab
      default:
        return 30; // Default to slab rate
    }
  }
  
  if (classification === 'LTCG') {
    switch (assetType) {
      case 'equity':
      case 'equity_mf':
        return isPre ? PRE_SPLIT_LTCG_EQUITY_RATE : POST_SPLIT_LTCG_EQUITY_RATE;
      case 'debt_mf':
        return isPre ? DEBT_MF_LTCG_RATE_PRE : DEBT_MF_LTCG_RATE_POST;
      case 'property':
        return isPre ? PROPERTY_LTCG_RATE_PRE : PROPERTY_LTCG_RATE_POST;
      case 'gold':
      case 'bonds':
        return isPre ? 20 : 12.5;
      default:
        return isPre ? 20 : 12.5;
    }
  }
  
  return 30; // Fallback
}

// ============ SCHEDULE CG COMPUTATION ============

/**
 * Compute Schedule CG (Capital Gains) from a list of trades.
 * Handles pre/post 23 July 2024 date split, multi-asset classification,
 * and loss set-off rules.
 */
export function computeScheduleCG(trades: ITR3TradeInput[]): ITR3ScheduleCG {
  const assumptions: string[] = [];
  const tradeResults: ITR3TradeResult[] = [];
  
  const preSplit = emptyDateSplitGains();
  const postSplit = emptyDateSplitGains();
  
  // Step 1: Classify and compute each trade
  for (const trade of trades) {
    const buyDate = new Date(trade.buyDate);
    const sellDate = new Date(trade.sellDate);
    const classification = classifyITR3Trade(buyDate, sellDate, trade.assetType, trade.subType);
    
    // Skip business/intraday trades — they go to Schedule BP
    if (classification === 'BUSINESS' || classification === 'INTRADAY') continue;
    
    const period = getDateSplitPeriod(sellDate);
    const days = Math.floor((sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24));
    const months = holdingMonths(buyDate, sellDate);
    
    const grossPnl = (trade.sellPricePaise - trade.buyPricePaise) * trade.qty;
    
    // For Capital Gains, STT cannot be claimed as an expense (Section 48 proviso).
    let deductibleCharges = trade.chargesPaise;
    if (trade.chargeBreakdown && trade.chargeBreakdown.sttPaise !== undefined) {
      deductibleCharges = trade.chargesPaise - trade.chargeBreakdown.sttPaise;
    } else if (trade.sttPaidPaise) {
      deductibleCharges = trade.chargesPaise - trade.sttPaidPaise;
    }
    
    const netPnl = grossPnl - deductibleCharges;
    const taxRate = getTaxRate(classification, trade.assetType, period);
    
    // Tax is computed on positive gains only (losses = 0 tax)
    const tax = netPnl > 0 ? Math.floor(netPnl * taxRate / 100) : 0;
    
    tradeResults.push({
      tradeId: trade.id,
      instrument: trade.instrument,
      assetType: trade.assetType,
      subType: trade.subType,
      buyDate,
      sellDate,
      qty: trade.qty,
      buyPricePaise: trade.buyPricePaise,
      sellPricePaise: trade.sellPricePaise,
      chargesPaise: trade.chargesPaise,
      holdingDays: days,
      holdingMonths: months,
      classification,
      dateSplitPeriod: period,
      grossPnlPaise: grossPnl,
      netPnlPaise: netPnl,
      taxRate,
      taxPaise: tax,
    });
    
    // Accumulate into the correct bucket
    const bucket = period === 'pre_split' ? preSplit : postSplit;
    const assetBucket = bucket[trade.assetType];
    assetBucket.tradeCount++;
    
    if (classification === 'STCG') {
      if (netPnl >= 0) {
        assetBucket.stcgPaise += netPnl;
      } else {
        assetBucket.stclPaise += Math.abs(netPnl);
      }
    } else if (classification === 'LTCG') {
      if (netPnl >= 0) {
        assetBucket.ltcgPaise += netPnl;
      } else {
        assetBucket.ltclPaise += Math.abs(netPnl);
      }
    }
  }
  
  // Step 2: Aggregate totals
  const allAssetTypes: AssetType[] = ['equity', 'equity_mf', 'debt_mf', 'property', 'vda', 'bonds', 'gold', 'other'];
  
  let totalSTCG = 0, totalLTCG = 0, totalSTCL = 0, totalLTCL = 0;
  
  for (const period of [preSplit, postSplit]) {
    for (const at of allAssetTypes) {
      totalSTCG += period[at].stcgPaise;
      totalLTCG += period[at].ltcgPaise;
      totalSTCL += period[at].stclPaise;
      totalLTCL += period[at].ltclPaise;
    }
  }
  
  // Step 3: Loss set-off
  // Rules:
  // - STCL can offset STCG first, then LTCG (within same period first, then cross-period)
  // - LTCL can only offset LTCG
  // - VDA losses CANNOT be set off against any other income
  // - Speculative (intraday) losses can only offset speculative gains (handled in BP)
  
  // For simplicity, we do aggregate loss set-off across periods
  // (The portal does period-wise first, but aggregate is a reasonable approximation)
  
  // Remove VDA losses from set-off pool (VDA losses can't offset anything)
  const vdaSTCL = preSplit.vda.stclPaise + postSplit.vda.stclPaise;
  const vdaLTCL = preSplit.vda.ltclPaise + postSplit.vda.ltclPaise;
  const adjustedSTCL = totalSTCL - vdaSTCL;
  const adjustedLTCL = totalLTCL - vdaLTCL;
  
  // STCL offsets STCG first
  let netSTCG = Math.max(0, totalSTCG - adjustedSTCL);
  let remainingSTCL = Math.max(0, adjustedSTCL - totalSTCG);
  
  // Remaining STCL offsets LTCG
  let netLTCG = Math.max(0, totalLTCG - adjustedLTCL - remainingSTCL);
  // let remainingLTCL = Math.max(0, adjustedLTCL - totalLTCG + remainingSTCL);
  // Correct: LTCL only offsets LTCG
  netLTCG = Math.max(0, totalLTCG - adjustedLTCL - remainingSTCL);
  
  // Carry forward unadjusted losses
  const carryForwardSTCL = Math.max(0, adjustedSTCL - totalSTCG);
  // Only the portion of STCL that couldn't offset STCG goes to LTCG, the rest carries forward
  const stclUsedOnLTCG = Math.min(remainingSTCL, totalLTCG - Math.max(0, totalLTCG - adjustedLTCL));
  const carryForwardLTCL = Math.max(0, adjustedLTCL + remainingSTCL - stclUsedOnLTCG - totalLTCG);
  
  // Step 4: Apply LTCG exemptions
  // Pre-split: ₹1L exemption on equity/equity_mf LTCG
  // Post-split: ₹1.25L exemption on equity/equity_mf LTCG
  const preSplitEquityLTCG = preSplit.equity.ltcgPaise + preSplit.equity_mf.ltcgPaise;
  const postSplitEquityLTCG = postSplit.equity.ltcgPaise + postSplit.equity_mf.ltcgPaise;
  
  const preSplitExemptionUsed = Math.min(preSplitEquityLTCG, PRE_SPLIT_LTCG_EXEMPTION_PAISE);
  const postSplitExemptionUsed = Math.min(postSplitEquityLTCG, POST_SPLIT_LTCG_EXEMPTION_PAISE);
  
  // Step 5: Compute taxes per period per asset
  let totalSTCGTax = 0;
  let totalLTCGTax = 0;
  
  // Pre-split taxes
  for (const at of allAssetTypes) {
    const ag = preSplit[at];
    if (ag.stcgPaise > 0) {
      const rate = getTaxRate('STCG', at, 'pre_split');
      ag.stcgTaxPaise = Math.floor(ag.stcgPaise * rate / 100);
      totalSTCGTax += ag.stcgTaxPaise;
    }
    if (ag.ltcgPaise > 0) {
      let taxableLTCG = ag.ltcgPaise;
      // Apply exemption for equity types
      if ((at === 'equity' || at === 'equity_mf') && preSplitExemptionUsed > 0) {
        // Proportional exemption across equity asset types
        const proportion = preSplitEquityLTCG > 0 ? ag.ltcgPaise / preSplitEquityLTCG : 0;
        const exemption = Math.floor(preSplitExemptionUsed * proportion);
        taxableLTCG = Math.max(0, taxableLTCG - exemption);
      }
      const rate = getTaxRate('LTCG', at, 'pre_split');
      ag.ltcgTaxPaise = Math.floor(taxableLTCG * rate / 100);
      totalLTCGTax += ag.ltcgTaxPaise;
    }
  }
  
  // Post-split taxes
  for (const at of allAssetTypes) {
    const ag = postSplit[at];
    if (ag.stcgPaise > 0) {
      const rate = getTaxRate('STCG', at, 'post_split');
      ag.stcgTaxPaise = Math.floor(ag.stcgPaise * rate / 100);
      totalSTCGTax += ag.stcgTaxPaise;
    }
    if (ag.ltcgPaise > 0) {
      let taxableLTCG = ag.ltcgPaise;
      if ((at === 'equity' || at === 'equity_mf') && postSplitExemptionUsed > 0) {
        const proportion = postSplitEquityLTCG > 0 ? ag.ltcgPaise / postSplitEquityLTCG : 0;
        const exemption = Math.floor(postSplitExemptionUsed * proportion);
        taxableLTCG = Math.max(0, taxableLTCG - exemption);
      }
      const rate = getTaxRate('LTCG', at, 'post_split');
      ag.ltcgTaxPaise = Math.floor(taxableLTCG * rate / 100);
      totalLTCGTax += ag.ltcgTaxPaise;
    }
  }
  
  const netCGTax = totalSTCGTax + totalLTCGTax;
  
  // Build assumptions
  assumptions.push('Capital gains split at 23 July 2024 per Finance (No.2) Act, 2024');
  if (preSplitEquityLTCG > 0) {
    assumptions.push(`Pre-23 July: LTCG exemption ₹${(preSplitExemptionUsed / 100).toLocaleString('en-IN')} of ₹1,00,000 used`);
  }
  if (postSplitEquityLTCG > 0) {
    assumptions.push(`Post-23 July: LTCG exemption ₹${(postSplitExemptionUsed / 100).toLocaleString('en-IN')} of ₹1,25,000 used`);
  }
  if (vdaSTCL > 0 || vdaLTCL > 0) {
    assumptions.push('VDA (crypto) losses cannot be set off against other income');
  }
  if (carryForwardSTCL > 0 || carryForwardLTCL > 0) {
    assumptions.push(`Unadjusted losses can be carried forward for 8 assessment years (requires ITR filing before due date)`);
  }
  assumptions.push('Loss set-off applied as aggregate across date periods (portal may apply period-wise first)');
  assumptions.push('This is an estimate. Verify with your CA before filing.');
  
  return {
    preSplit,
    postSplit,
    totalSTCGPaise: totalSTCG,
    totalLTCGPaise: totalLTCG,
    totalSTCLPaise: totalSTCL,
    totalLTCLPaise: totalLTCL,
    netSTCGPaise: netSTCG,
    netLTCGPaise: netLTCG,
    preSplitLTCGExemptionUsedPaise: preSplitExemptionUsed,
    postSplitLTCGExemptionUsedPaise: postSplitExemptionUsed,
    totalSTCGTaxPaise: totalSTCGTax,
    totalLTCGTaxPaise: totalLTCGTax,
    netCGTaxPaise: netCGTax,
    carryForwardSTCLPaise: Math.max(0, carryForwardSTCL),
    carryForwardLTCLPaise: Math.max(0, carryForwardLTCL),
    assumptions,
    tradeResults,
  };
}

// ============ SCHEDULE BP COMPUTATION ============

/**
 * Compute Schedule BP (Business/Profession) for F&O and intraday trades.
 */
export function computeScheduleBP(
  trades: ITR3TradeInput[],
  expenses: BusinessExpenseEntry[]
): ITR3ScheduleBP {
  const assumptions: string[] = [];
  
  let fnoTurnover = 0;
  let intradayTurnover = 0;
  let fnoIncome = 0;
  let fnoLoss = 0;
  let speculativeIncome = 0;
  let speculativeLoss = 0;
  let fnoTradeCount = 0;
  let intradayTradeCount = 0;
  
  for (const trade of trades) {
    const buyDate = new Date(trade.buyDate);
    const sellDate = new Date(trade.sellDate);
    const classification = classifyITR3Trade(buyDate, sellDate, trade.assetType, trade.subType);
    
    if (classification !== 'BUSINESS' && classification !== 'INTRADAY') continue;
    
    const grossPnl = (trade.sellPricePaise - trade.buyPricePaise) * trade.qty;
    const netPnl = grossPnl - trade.chargesPaise;
    
    if (classification === 'BUSINESS') {
      // F&O: Turnover = sum of absolute profit/loss per contract
      fnoTurnover += Math.abs(grossPnl);
      fnoTradeCount++;
      
      if (netPnl >= 0) {
        fnoIncome += netPnl;
      } else {
        fnoLoss += Math.abs(netPnl);
      }
    } else {
      // Intraday: Turnover = sum of absolute profit/loss per trade
      intradayTurnover += Math.abs(grossPnl);
      intradayTradeCount++;
      
      if (netPnl >= 0) {
        speculativeIncome += netPnl;
      } else {
        speculativeLoss += Math.abs(netPnl);
      }
    }
  }
  
  const totalTurnover = fnoTurnover + intradayTurnover;
  const grossReceipts = fnoIncome + speculativeIncome;
  const tradingLoss = fnoLoss + speculativeLoss;
  const netTradingIncome = grossReceipts - tradingLoss;
  
  // Expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amountPaise, 0);
  const netBusinessIncome = netTradingIncome - totalExpenses;
  
  // Presumptive income
  const presumptive6 = Math.floor(totalTurnover * PRESUMPTIVE_44AD_RATE_DIGITAL / 100);
  const presumptive8 = Math.floor(totalTurnover * PRESUMPTIVE_44AD_RATE_CASH / 100);
  
  // Audit requirement
  let isAuditRequired = false;
  let auditReason: string | null = null;
  
  if (totalTurnover > AUDIT_THRESHOLD_PAISE) {
    isAuditRequired = true;
    auditReason = `Turnover exceeds ₹10 Crore (Section 44AB)`;
  } else if (totalTurnover > AUDIT_THRESHOLD_REDUCED_PAISE) {
    // ₹6Cr threshold if cash receipts < 5%
    // For digital trading, cash is usually < 5%, so ₹10Cr applies
    // But flag it as a warning
    assumptions.push('Turnover between ₹6Cr and ₹10Cr — audit required if cash receipts ≥ 5% of total');
  }
  
  // Also audit if opted for presumptive and income < presumptive threshold
  // and total income > basic exemption limit
  const isPresumptiveEligible = totalTurnover <= AUDIT_THRESHOLD_PAISE;
  
  // If not opting for presumptive and profit < 6% of turnover, audit required
  if (!isAuditRequired && totalTurnover > 0) {
    const profitPct = totalTurnover > 0 ? (netTradingIncome / totalTurnover) * 100 : 0;
    if (profitPct < PRESUMPTIVE_44AD_RATE_DIGITAL && netTradingIncome > 0) {
      assumptions.push(`Profit (${profitPct.toFixed(1)}%) is below 6% of turnover — audit may be required if not opting for presumptive taxation u/s 44AD`);
    }
  }
  
  const booksOfAccountRequired = totalTurnover > 0 && !isPresumptiveEligible;
  
  // Assumptions
  assumptions.push('F&O turnover = sum of absolute profit/loss per contract');
  assumptions.push('Intraday turnover = sum of absolute profit/loss per scrip');
  if (intradayTradeCount > 0) {
    assumptions.push('Intraday equity trading is treated as speculative business income (Section 43(5))');
  }
  if (fnoTradeCount > 0) {
    assumptions.push('F&O trading is treated as non-speculative business income');
  }
  assumptions.push('Business expenses must be supported by documentation');
  
  return {
    fnoTurnoverPaise: fnoTurnover,
    intradayTurnoverPaise: intradayTurnover,
    totalTurnoverPaise: totalTurnover,
    grossReceiptsPaise: grossReceipts,
    tradingLossPaise: tradingLoss,
    netTradingIncomePaise: netTradingIncome,
    expenses,
    totalExpensesPaise: totalExpenses,
    netBusinessIncomePaise: netBusinessIncome,
    presumptiveIncome6PctPaise: presumptive6,
    presumptiveIncome8PctPaise: presumptive8,
    isAuditRequired,
    auditReason,
    isPresumptiveEligible,
    booksOfAccountRequired,
    speculativeIncomePaise: speculativeIncome,
    speculativeLossPaise: speculativeLoss,
    netSpeculativePaise: speculativeIncome - speculativeLoss,
    fnoIncomePaise: fnoIncome,
    fnoLossPaise: fnoLoss,
    netFnoPaise: fnoIncome - fnoLoss,
    fnoTradeCount,
    intradayTradeCount,
    assumptions,
  };
}

// ============ BOOKKEEPING COMPUTATION ============

export function computeBookkeeping(
  trades: ITR3TradeInput[],
  incomeItems: { category: string; amountPaise: number }[],
  expenses: BusinessExpenseEntry[],
  bookkeepingData: NonNullable<import('../../shared/hooks/useAppStore').ITR3Data['bookkeepingData']>
): BookkeepingComputed {
  let intradaySalesPaise = 0;
  let intradayPurchasesPaise = 0;
  let intradayChargesPaise = 0;

  let fnoSalesPaise = 0;
  let fnoPurchasesPaise = 0;
  let fnoChargesPaise = 0;

  let openInvestmentsPaise = 0;

  for (const trade of trades) {
    const buyDate = new Date(trade.buyDate);
    const sellDate = new Date(trade.sellDate);
    const classification = classifyITR3Trade(buyDate, sellDate, trade.assetType, trade.subType);

    // If trade is open (no sell date or sell price is 0 and it's a delivery trade)
    if (!trade.sellDate && (trade.subType === 'delivery' || classification === 'STCG' || classification === 'LTCG')) {
      openInvestmentsPaise += trade.buyPricePaise;
      continue;
    }

    if (classification === 'INTRADAY') {
      intradaySalesPaise += trade.sellPricePaise;
      intradayPurchasesPaise += trade.buyPricePaise;
      intradayChargesPaise += trade.chargesPaise;
    } else if (classification === 'BUSINESS') {
      // F&O
      fnoSalesPaise += trade.sellPricePaise;
      fnoPurchasesPaise += trade.buyPricePaise;
      fnoChargesPaise += trade.chargesPaise;
    }
  }

  const intradayGrossProfitPaise = intradaySalesPaise - intradayPurchasesPaise - intradayChargesPaise;
  const fnoGrossProfitPaise = fnoSalesPaise - fnoPurchasesPaise - fnoChargesPaise;
  const totalGrossProfitPaise = intradayGrossProfitPaise + fnoGrossProfitPaise;

  const otherIncomePaise = incomeItems
    .filter(i => ['dividend', 'interest', 'savings_interest', 'fd_interest'].includes(i.category))
    .reduce((sum, i) => sum + i.amountPaise, 0);

  const indirectExpensesPaise = expenses.reduce((sum, e) => sum + e.amountPaise, 0);

  const netProfitPaise = totalGrossProfitPaise + otherIncomePaise - indirectExpensesPaise;

  const closingCapitalPaise = bookkeepingData.openingCapitalPaise + netProfitPaise - bookkeepingData.drawingsPaise;

  const investmentsPaise = openInvestmentsPaise;
  const totalAssetsPaise = bookkeepingData.fixedAssetsPaise + investmentsPaise + bookkeepingData.bankBalancePaise + bookkeepingData.brokerBalancePaise + bookkeepingData.cashBalancePaise;
  const totalLiabilitiesPaise = closingCapitalPaise + bookkeepingData.loansPaise;

  const imbalancePaise = totalAssetsPaise - totalLiabilitiesPaise;
  const isBalanced = imbalancePaise === 0;

  return {
    intradaySalesPaise,
    intradayPurchasesPaise,
    intradayChargesPaise,
    intradayGrossProfitPaise,
    fnoSalesPaise,
    fnoPurchasesPaise,
    fnoChargesPaise,
    fnoGrossProfitPaise,
    totalGrossProfitPaise,
    otherIncomePaise,
    indirectExpensesPaise,
    netProfitPaise,
    openingCapitalPaise: bookkeepingData.openingCapitalPaise,
    drawingsPaise: bookkeepingData.drawingsPaise,
    closingCapitalPaise,
    assets: {
      fixedAssetsPaise: bookkeepingData.fixedAssetsPaise,
      investmentsPaise,
      bankBalancePaise: bookkeepingData.bankBalancePaise,
      brokerBalancePaise: bookkeepingData.brokerBalancePaise,
      cashBalancePaise: bookkeepingData.cashBalancePaise,
      totalAssetsPaise,
    },
    liabilities: {
      capitalAccountPaise: closingCapitalPaise,
      loansPaise: bookkeepingData.loansPaise,
      totalLiabilitiesPaise,
    },
    isBalanced,
    imbalancePaise,
  };
}

// ============ SCHEDULE HP COMPUTATION ============

/**
 * Compute Schedule HP (House Property) income.
 */
export function computeScheduleHP(properties: HousePropertyEntry[]): ITR3ScheduleHP {
  const breakdown: ITR3ScheduleHP['breakdown'] = [];
  let totalIncome = 0;
  
  for (const prop of properties) {
    if (prop.propertyType === 'self_occupied') {
      // Self-occupied: NAV = 0, only home loan interest deduction (max ₹2L)
      const interest = Math.min(prop.homeLoanInterestPaise, 200000_00);
      const net = -interest; // Always negative or zero for self-occupied
      breakdown.push({
        id: prop.id,
        navPaise: 0,
        stdDeductionPaise: 0,
        interestPaise: interest,
        netPaise: net,
      });
      totalIncome += net;
    } else {
      // Let out / Deemed let out
      const nav = Math.max(0, prop.annualRentPaise - prop.municipalTaxesPaise);
      const stdDeduction = Math.floor(nav * 30 / 100); // 30% standard deduction
      const interest = prop.homeLoanInterestPaise + prop.preLettingInterestPaise;
      const net = nav - stdDeduction - interest;
      breakdown.push({
        id: prop.id,
        navPaise: nav,
        stdDeductionPaise: stdDeduction,
        interestPaise: interest,
        netPaise: net,
      });
      totalIncome += net;
    }
  }
  
  return { properties, totalIncomePaise: totalIncome, breakdown };
}

// ============ SCHEDULE OS COMPUTATION ============

/**
 * Compute Schedule OS (Other Sources) income.
 */
export function computeScheduleOS(entries: OtherSourceEntry[]): ITR3ScheduleOS {
  const totalIncome = entries.reduce((sum, e) => sum + e.amountPaise, 0);
  const totalTDS = entries.reduce((sum, e) => sum + e.tdsPaidPaise, 0);
  return { entries, totalIncomePaise: totalIncome, totalTDSPaise: totalTDS };
}

// ============ SCHEDULE VI-A COMPUTATION ============

/** Deduction limits for old regime */
const DEDUCTION_LIMITS: Record<string, number> = {
  '80C': 150000_00,
  '80CCC': 150000_00,     // Part of 80C aggregate
  '80CCD1': 150000_00,    // Part of 80C aggregate
  '80CCD1B': 50000_00,    // Additional NPS
  '80CCD2': 0,            // Employer NPS — 10% of basic (no fixed limit)
  '80D': 25000_00,        // Self (₹50K for senior)
  '80E': 0,               // Education loan — no limit
  '80EEA': 150000_00,     // Home loan interest (affordable housing)
  '80G': 0,               // Donations — varies
  '80GG': 60000_00,       // Rent paid (no HRA)
  '80TTA': 10000_00,      // Savings interest
  '80TTB': 50000_00,      // Senior savings interest
  '80U': 75000_00,        // Disability
};

/**
 * Compute Schedule VI-A (Deductions) — applies limits and regime eligibility.
 */
export function computeScheduleVIA(
  deductions: DeductionEntry[],
  regime: 'old' | 'new'
): ITR3ScheduleVIA {
  let totalAllowed = 0;
  let regimeNote = '';
  
  if (regime === 'new') {
    // New regime — only 80CCD2 (employer NPS) and standard deduction are allowed
    const allowed = deductions.filter(d => d.regimeEligibility === 'both');
    totalAllowed = allowed.reduce((sum, d) => {
      const limit = DEDUCTION_LIMITS[d.section] || Infinity;
      return sum + Math.min(d.amountPaise, limit > 0 ? limit : d.amountPaise);
    }, 0);
    regimeNote = 'New Regime: Most Chapter VI-A deductions are not available. Only employer NPS (80CCD2) and a few specific deductions apply.';
  } else {
    // Old regime — apply all with limits
    // Group 80C/80CCC/80CCD1 into aggregate ₹1.5L limit
    const section80CAggregate = deductions
      .filter(d => ['80C', '80CCC', '80CCD1'].includes(d.section))
      .reduce((sum, d) => sum + d.amountPaise, 0);
    const capped80C = Math.min(section80CAggregate, 150000_00);
    
    const otherDeductions = deductions
      .filter(d => !['80C', '80CCC', '80CCD1'].includes(d.section))
      .reduce((sum, d) => {
        const limit = DEDUCTION_LIMITS[d.section];
        if (limit === 0) return sum + d.amountPaise; // No limit
        return sum + Math.min(d.amountPaise, limit);
      }, 0);
    
    totalAllowed = capped80C + otherDeductions;
    regimeNote = 'Old Regime: All eligible Chapter VI-A deductions applied with section-wise limits.';
  }
  
  return { deductions, totalAllowedPaise: totalAllowed, regimeNote };
}

// ============ COMBINED ITR-3 TAX COMPUTATION ============

/**
 * Compute the complete ITR-3 tax liability by combining all schedules.
 */
export function computeITR3Tax(params: {
  salaryTaxInput?: TaxInput;
  trades: ITR3TradeInput[];
  businessExpenses: BusinessExpenseEntry[];
  houseProperties: HousePropertyEntry[];
  otherSources: OtherSourceEntry[];
  deductions: DeductionEntry[];
  regime: 'old' | 'new';
  fy: string;
}): ITR3FilingData {
  const { salaryTaxInput, trades, businessExpenses, houseProperties, otherSources, deductions, regime, fy } = params;
  
  // Compute each schedule
  const scheduleCG = computeScheduleCG(trades);
  const scheduleBP = computeScheduleBP(trades, businessExpenses);
  const scheduleHP = computeScheduleHP(houseProperties);
  const scheduleOS = computeScheduleOS(otherSources);
  const scheduleVIA = computeScheduleVIA(deductions, regime);
  
  // Salary tax (uses existing engine)
  let salaryTaxResult: TaxResult | undefined;
  let regimeComparison: RegimeComparison | undefined;
  
  if (salaryTaxInput) {
    // Inject capital gains tax into salary computation
    const cgForSalaryEngine = {
      stcgPaise: scheduleCG.netSTCGPaise,
      ltcgPaise: scheduleCG.netLTCGPaise,
      intradayPaise: scheduleBP.netSpeculativePaise > 0 ? scheduleBP.netSpeculativePaise : 0,
      stcgTaxPaise: scheduleCG.totalSTCGTaxPaise,
      ltcgTaxPaise: scheduleCG.totalLTCGTaxPaise,
      intradayTaxPaise: scheduleBP.netSpeculativePaise > 0 
        ? Math.floor(scheduleBP.netSpeculativePaise * INTRADAY_SPECULATIVE_RATE / 100) 
        : 0,
    };
    
    const inputWithCG: TaxInput = {
      ...salaryTaxInput,
      capitalGains: cgForSalaryEngine,
    };
    
    salaryTaxResult = computeTax(inputWithCG, regime);
    regimeComparison = compareRegimes(inputWithCG);
  }
  
  // Combine total income
  const salaryIncome = salaryTaxResult?.grossSalaryPaise || 0;
  const businessIncome = Math.max(0, scheduleBP.netBusinessIncomePaise);
  const hpIncome = scheduleHP.totalIncomePaise; // Can be negative
  const cgIncome = scheduleCG.netSTCGPaise + scheduleCG.netLTCGPaise;
  const osIncome = scheduleOS.totalIncomePaise;
  
  const totalIncome = salaryIncome + businessIncome + hpIncome + cgIncome + osIncome;
  
  // Total tax
  // const salaryTax = salaryTaxResult?.totalTaxPaise || 0;
  const cgTax = scheduleCG.netCGTaxPaise;
  const businessTax = scheduleBP.netBusinessIncomePaise > 0
    ? Math.floor(scheduleBP.netBusinessIncomePaise * 30 / 100) // At slab, using 30%
    : 0;
  
  // Use salary tax result if available (it includes CG tax and cess/surcharge)
  const totalTax = salaryTaxResult 
    ? salaryTaxResult.totalTaxPaise 
    : cgTax + businessTax;
  
  // Total TDS
  const salaryTDS = salaryTaxResult?.tdsDeductedPaise || 0;
  const osTDS = scheduleOS.totalTDSPaise;
  const totalTDS = salaryTDS + osTDS;
  
  const balanceTax = totalTax - totalTDS;
  
  // Derive AY from FY
  const fyStartYear = parseInt(fy.split('-')[0]);
  const assessmentYear = `${fyStartYear + 1}-${String(fyStartYear + 2).slice(2)}`;
  
  return {
    assessmentYear,
    financialYear: fy,
    filingSection: '139(1)',
    form10IEA: { filed: false, regime },
    scheduleCG,
    scheduleBP,
    scheduleHP,
    scheduleOS,
    scheduleVIA,
    salaryTaxResult,
    regimeComparison,
    totalIncomePaise: totalIncome,
    totalTaxPaise: totalTax,
    totalTDSPaise: totalTDS,
    balanceTaxPaise: balanceTax,
  };
}

// ============ PORTAL FIELD MAPPING ============

export interface PortalFieldMapping {
  scheduleName: string;
  fieldLabel: string;
  portalFieldName: string;
  value: number;
  displayValue: string;
  section?: string;
}

/**
 * Generate portal field mappings from ITR-3 filing data.
 * These tell the user exactly where to enter each value on the e-filing portal.
 */
export function generatePortalFieldMappings(data: ITR3FilingData): PortalFieldMapping[] {
  const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
  const mappings: PortalFieldMapping[] = [];
  
  // Schedule CG mappings
  const cg = data.scheduleCG;
  
  if (cg?.preSplit?.equity?.stcgPaise > 0 || cg?.postSplit?.equity?.stcgPaise > 0) {
    mappings.push({
      scheduleName: 'Schedule CG',
      fieldLabel: 'STCG on listed equity (before 23 July)',
      portalFieldName: 'B1 - Short term capital gains - 111A (i)',
      value: cg?.preSplit?.equity?.stcgPaise || 0,
      displayValue: fmt(cg?.preSplit?.equity?.stcgPaise || 0),
      section: '111A',
    });
    mappings.push({
      scheduleName: 'Schedule CG',
      fieldLabel: 'STCG on listed equity (on/after 23 July)',
      portalFieldName: 'B1 - Short term capital gains - 111A (ii)',
      value: cg?.postSplit?.equity?.stcgPaise || 0,
      displayValue: fmt(cg?.postSplit?.equity?.stcgPaise || 0),
      section: '111A',
    });
  }
  
  if (cg?.preSplit?.equity?.ltcgPaise > 0 || cg?.postSplit?.equity?.ltcgPaise > 0) {
    mappings.push({
      scheduleName: 'Schedule CG',
      fieldLabel: 'LTCG on listed equity (before 23 July)',
      portalFieldName: 'B5 - Long term capital gains - 112A (i)',
      value: cg?.preSplit?.equity?.ltcgPaise || 0,
      displayValue: fmt(cg?.preSplit?.equity?.ltcgPaise || 0),
      section: '112A',
    });
    mappings.push({
      scheduleName: 'Schedule CG',
      fieldLabel: 'LTCG on listed equity (on/after 23 July)',
      portalFieldName: 'B5 - Long term capital gains - 112A (ii)',
      value: cg?.postSplit?.equity?.ltcgPaise || 0,
      displayValue: fmt(cg?.postSplit?.equity?.ltcgPaise || 0),
      section: '112A',
    });
  }
  
  // Schedule BP mappings
  const bp = data.scheduleBP;
  if (bp?.totalTurnoverPaise > 0) {
    mappings.push({
      scheduleName: 'Schedule BP',
      fieldLabel: 'F&O Turnover',
      portalFieldName: 'Sl 47 - Turnover/Gross Receipt from business',
      value: bp?.fnoTurnoverPaise || 0,
      displayValue: fmt(bp?.fnoTurnoverPaise || 0),
    });
    mappings.push({
      scheduleName: 'Schedule BP',
      fieldLabel: 'Net Business Profit/Loss',
      portalFieldName: 'Sl 48 - Gross profit from business',
      value: bp?.netBusinessIncomePaise || 0,
      displayValue: fmt(bp?.netBusinessIncomePaise || 0),
    });
    if (bp?.intradayTurnoverPaise > 0) {
      mappings.push({
        scheduleName: 'Schedule BP',
        fieldLabel: 'Intraday (Speculative) Income',
        portalFieldName: 'Sl 49 - Income from speculative business',
        value: bp?.netSpeculativePaise || 0,
        displayValue: fmt(bp?.netSpeculativePaise || 0),
      });
    }
  }
  
  // Schedule HP mappings
  const hp = data.scheduleHP;
  if (hp?.totalIncomePaise && hp.totalIncomePaise !== 0) {
    mappings.push({
      scheduleName: 'Schedule HP',
      fieldLabel: 'Income from House Property',
      portalFieldName: 'Income from House Property - Total',
      value: hp?.totalIncomePaise || 0,
      displayValue: fmt(hp?.totalIncomePaise || 0),
    });
  }
  
  // Schedule OS mappings
  const os = data.scheduleOS;
  if (os?.totalIncomePaise > 0) {
    mappings.push({
      scheduleName: 'Schedule OS',
      fieldLabel: 'Income from Other Sources',
      portalFieldName: 'Income from Other Sources - Total',
      value: os?.totalIncomePaise || 0,
      displayValue: fmt(os?.totalIncomePaise || 0),
    });
  }
  
  // Total
  mappings.push({
    scheduleName: 'Tax Computation',
    fieldLabel: 'Total Income',
    portalFieldName: 'Gross Total Income',
    value: data.totalIncomePaise,
    displayValue: fmt(data.totalIncomePaise),
  });
  mappings.push({
    scheduleName: 'Tax Computation',
    fieldLabel: 'Total Tax Payable',
    portalFieldName: 'Total Tax, Surcharge and Cess',
    value: data.totalTaxPaise,
    displayValue: fmt(data.totalTaxPaise),
  });
  mappings.push({
    scheduleName: 'Tax Computation',
    fieldLabel: 'Balance Tax (Payable / Refund)',
    portalFieldName: 'Tax Payable / Refund',
    value: data.balanceTaxPaise,
    displayValue: fmt(data.balanceTaxPaise),
  });
  
  return mappings;
}

// ============ AIS RECONCILIATION ============

export interface AISReconciliationResult {
  dividendMismatchPaise: number;
  savingsMismatchPaise: number;
  fdMismatchPaise: number;
  securitiesSaleMismatchPaise: number;
  securitiesPurchaseMismatchPaise: number;
  isMismatch: boolean;
}

export function computeAISReconciliation(
  aisData: {
    dividendPaise: number;
    savingsInterestPaise: number;
    fdInterestPaise: number;
    securitiesSalePaise: number;
    securitiesPurchasePaise: number;

  },
  ledgerTotals: {
    dividendPaise: number;
    savingsInterestPaise: number;
    fdInterestPaise: number;
    securitiesSalePaise: number;
    securitiesPurchasePaise: number;
  }
): AISReconciliationResult {
  const dividendMismatchPaise = aisData.dividendPaise - ledgerTotals.dividendPaise;
  const savingsMismatchPaise = aisData.savingsInterestPaise - ledgerTotals.savingsInterestPaise;
  const fdMismatchPaise = aisData.fdInterestPaise - ledgerTotals.fdInterestPaise;
  const securitiesSaleMismatchPaise = aisData.securitiesSalePaise - ledgerTotals.securitiesSalePaise;
  const securitiesPurchaseMismatchPaise = aisData.securitiesPurchasePaise - ledgerTotals.securitiesPurchasePaise;

  const isMismatch = 
    dividendMismatchPaise !== 0 ||
    savingsMismatchPaise !== 0 ||
    fdMismatchPaise !== 0 ||
    securitiesSaleMismatchPaise !== 0 ||
    securitiesPurchaseMismatchPaise !== 0;

  return {
    dividendMismatchPaise,
    savingsMismatchPaise,
    fdMismatchPaise,
    securitiesSaleMismatchPaise,
    securitiesPurchaseMismatchPaise,
    isMismatch,
  };
}
