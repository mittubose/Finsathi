/**
 * ObligationRadarService — Deep Domain Module for Cashflow Pulse & Commitments
 * Enforces:
 * - 30-Day Obligation Radar with Urgency Protocol ([CRITICAL], [WARN], [INFO])
 * - 1st-to-10th Liquidity Check: Free Cash After Commitments
 *   (Net Monthly Salary - Scheduled SIPs - Fixed Bills - Credit Card Statement Due)
 * - Monthly Bucket Snapshots (CC Total + UPI Outflow + Fixed Commitments)
 * 
 * Invariant: All values stored in integer PAISE.
 */

export type ObligationCategory = 'credit_card' | 'sip' | 'rent' | 'insurance' | 'advance_tax' | 'utility';
export type UrgencyTier = 'CRITICAL' | 'WARN' | 'INFO';

export interface ObligationItem {
  id: string;
  name: string;
  category: ObligationCategory;
  amountPaise: number;
  dueDate: string; // YYYY-MM-DD
  isPaid: boolean;
  notes?: string;
}

export interface MonthlyBucketSnapshot {
  month: string; // 'YYYY-MM'
  creditCardStatementPaise: number;
  upiOutflowsPaise: number;
  fixedObligationsPaise: number;
  taxRelevantReceiptsPaise: number;
  totalOutflowPaise: number;
}

export interface FreeCashAnalysis {
  monthlyNetSalaryPaise: number;
  totalScheduledSipsPaise: number;
  totalFixedBillsPaise: number;
  totalCreditCardsDuePaise: number;
  freeCashAfterCommitmentsPaise: number;
  burnRatePercentage: number;
  isSafeForTradingDeploy: boolean;
}

export class ObligationRadarService {
  /**
   * Determine urgency tier based on due date proximity:
   * - CRITICAL: Overdue or due within 2 days
   * - WARN: Due within 3 to 7 days
   * - INFO: Due in > 7 days
   */
  public static getUrgencyTier(dueDateStr: string, isPaid: boolean, now: Date = new Date()): UrgencyTier {
    if (isPaid) return 'INFO';
    const due = new Date(dueDateStr);
    const diffMs = due.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysLeft <= 2) return 'CRITICAL';
    if (daysLeft <= 7) return 'WARN';
    return 'INFO';
  }

  /**
   * Compute 1st-to-10th Liquidity Metric:
   * Free Cash After Commitments = Net Salary - SIPs - Fixed Bills - CC Bills
   */
  public static computeFreeCashAfterCommitments(
    monthlyNetSalaryPaise: number,
    obligations: ObligationItem[]
  ): FreeCashAnalysis {
    let sips = 0;
    let fixedBills = 0;
    let ccBills = 0;

    for (const ob of obligations) {
      if (ob.isPaid) continue;
      if (ob.category === 'sip') {
        sips += ob.amountPaise;
      } else if (ob.category === 'credit_card') {
        ccBills += ob.amountPaise;
      } else {
        fixedBills += ob.amountPaise;
      }
    }

    const totalCommitted = sips + fixedBills + ccBills;
    const freeCash = monthlyNetSalaryPaise - totalCommitted;
    const burnRatePct = monthlyNetSalaryPaise > 0
      ? Number(((totalCommitted / monthlyNetSalaryPaise) * 100).toFixed(1))
      : 100;

    // Safe for equity trading only if free cash >= 20% of net salary
    const isSafe = freeCash >= Math.floor(monthlyNetSalaryPaise * 0.20);

    return {
      monthlyNetSalaryPaise,
      totalScheduledSipsPaise: sips,
      totalFixedBillsPaise: fixedBills,
      totalCreditCardsDuePaise: ccBills,
      freeCashAfterCommitmentsPaise: freeCash,
      burnRatePercentage: burnRatePct,
      isSafeForTradingDeploy: isSafe,
    };
  }

  /**
   * Generate Monthly Bucket Snapshot (replacing ₹50 UPI micro-tracking).
   */
  public static createMonthlySnapshot(
    month: string,
    ccStatementPaise: number,
    upiOutflowsPaise: number,
    fixedObligationsPaise: number,
    taxRelevantReceiptsPaise: number
  ): MonthlyBucketSnapshot {
    return {
      month,
      creditCardStatementPaise: ccStatementPaise,
      upiOutflowsPaise: upiOutflowsPaise,
      fixedObligationsPaise: fixedObligationsPaise,
      taxRelevantReceiptsPaise,
      totalOutflowPaise: ccStatementPaise + upiOutflowsPaise + fixedObligationsPaise,
    };
  }
}
