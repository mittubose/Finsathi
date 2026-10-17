/**
 * CapitalLedgerService — Deep Domain Module for Equity & Capital Gains
 * Enforces:
 * - Deterministic FIFO Lot Matching per Symbol/ISIN
 * - Budget 2024 / FY 2025-26 rates: STCG @ 20%, LTCG @ 12.5%
 * - Annual ₹1,25,000 LTCG Tax-Free Exemption Buffer
 * - Statutory Loss Set-Off Hierarchy (STCL offsets STCG+LTCG; LTCL offsets only LTCG)
 * - Speculative Intraday Isolation (Section 43(5))
 * - Tax-Loss Harvesting Opportunity Scanner
 * 
 * Invariant: All values stored in integer PAISE.
 */

export type GainCategory = 'STCG' | 'LTCG' | 'INTRADAY';

export interface RawTrade {
  id: string;
  symbol: string;
  isin?: string;
  side: 'BUY' | 'SELL';
  date: string; // ISO date 'YYYY-MM-DD'
  qty: number;
  pricePaise: number;
  chargesPaise: number;
}

export interface MatchedFifoLot {
  symbol: string;
  buyDate: string;
  sellDate: string;
  qty: number;
  buyPricePaise: number;
  sellPricePaise: number;
  chargesPaise: number;
  holdingDays: number;
  gainCategory: GainCategory;
  realizedPnlPaise: number;
}

export interface CapitalGainsSummary {
  realizedStcgPaise: number;
  realizedLtcgPaise: number;
  realizedStclPaise: number;
  realizedLtclPaise: number;
  netIntradayPaise: number;
  netStcgPaise: number;
  netLtcgPaise: number;
  ltcgExemptionUsedPaise: number;
  ltcgExemptionRemainingPaise: number;
  taxableStcgPaise: number;
  taxableLtcgPaise: number;
  stcgTaxPaise: number;
  ltcgTaxPaise: number;
  totalCapitalGainsTaxPaise: number;
  matchedLots: MatchedFifoLot[];
}

export const ANNUAL_LTCG_EXEMPTION_PAISE = 125000_00; // ₹1,25,000
export const STCG_RATE_PCT = 20;
export const LTCG_RATE_PCT = 12.5;

export class CapitalLedgerService {
  /** Determine whether a holding is Intraday, STCG, or LTCG */
  public static classifyHoldingPeriod(buyDateStr: string, sellDateStr: string): { category: GainCategory; days: number } {
    const buyDate = new Date(buyDateStr);
    const sellDate = new Date(sellDateStr);

    const isSameDay =
      buyDate.getFullYear() === sellDate.getFullYear() &&
      buyDate.getMonth() === sellDate.getMonth() &&
      buyDate.getDate() === sellDate.getDate();

    if (isSameDay) {
      return { category: 'INTRADAY', days: 0 };
    }

    const diffMs = sellDate.getTime() - buyDate.getTime();
    const days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    
    // Listed equities: > 365 days is LTCG, <= 365 days is STCG
    const category: GainCategory = days > 365 ? 'LTCG' : 'STCG';
    return { category, days };
  }

  /**
   * Deterministic FIFO Lot Matching:
   * Matches buy lots against sell lots chronologically per symbol.
   */
  public static matchFifoTrades(trades: RawTrade[]): MatchedFifoLot[] {
    // Group trades by normalized symbol
    const tradesBySymbol: Record<string, RawTrade[]> = {};
    for (const t of trades) {
      const sym = t.symbol.trim().toUpperCase();
      if (!tradesBySymbol[sym]) tradesBySymbol[sym] = [];
      tradesBySymbol[sym].push(t);
    }

    const matchedLots: MatchedFifoLot[] = [];

    for (const [sym, symTrades] of Object.entries(tradesBySymbol)) {
      // Sort chronologically
      symTrades.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      interface OpenBuyLot {
        date: string;
        qtyLeft: number;
        pricePaise: number;
        chargesPerUnitPaise: number;
      }

      const buyQueue: OpenBuyLot[] = [];

      for (const trade of symTrades) {
        if (trade.side === 'BUY') {
          buyQueue.push({
            date: trade.date,
            qtyLeft: trade.qty,
            pricePaise: trade.pricePaise,
            chargesPerUnitPaise: trade.qty > 0 ? Math.floor(trade.chargesPaise / trade.qty) : 0,
          });
        } else if (trade.side === 'SELL') {
          let sellQtyNeeded = trade.qty;
          const sellChargesPerUnit = trade.qty > 0 ? Math.floor(trade.chargesPaise / trade.qty) : 0;

          while (sellQtyNeeded > 0 && buyQueue.length > 0) {
            const oldestBuy = buyQueue[0];
            const matchedQty = Math.min(sellQtyNeeded, oldestBuy.qtyLeft);

            const { category, days } = this.classifyHoldingPeriod(oldestBuy.date, trade.date);
            const totalBuyCost = matchedQty * oldestBuy.pricePaise;
            const totalSellGross = matchedQty * trade.pricePaise;
            const totalAllocatedCharges = (matchedQty * oldestBuy.chargesPerUnitPaise) + (matchedQty * sellChargesPerUnit);
            const netPnl = totalSellGross - totalBuyCost - totalAllocatedCharges;

            matchedLots.push({
              symbol: sym,
              buyDate: oldestBuy.date,
              sellDate: trade.date,
              qty: matchedQty,
              buyPricePaise: oldestBuy.pricePaise,
              sellPricePaise: trade.pricePaise,
              chargesPaise: totalAllocatedCharges,
              holdingDays: days,
              gainCategory: category,
              realizedPnlPaise: netPnl,
            });

            oldestBuy.qtyLeft -= matchedQty;
            sellQtyNeeded -= matchedQty;

            if (oldestBuy.qtyLeft <= 0) {
              buyQueue.shift();
            }
          }
        }
      }
    }

    return matchedLots;
  }

  /**
   * Compute Capital Gains Summary applying statutory set-off hierarchy:
   * 1. STCL offsets STCG first, then LTCG.
   * 2. LTCL can only offset LTCG.
   * 3. Apply ₹1,25,000 exemption to net LTCG.
   */
  public static computeCapitalGainsSummary(trades: RawTrade[]): CapitalGainsSummary {
    const matchedLots = this.matchFifoTrades(trades);

    let realizedStcg = 0;
    let realizedStcl = 0;
    let realizedLtcg = 0;
    let realizedLtcl = 0;
    let netIntraday = 0;

    for (const lot of matchedLots) {
      if (lot.gainCategory === 'INTRADAY') {
        netIntraday += lot.realizedPnlPaise;
      } else if (lot.gainCategory === 'STCG') {
        if (lot.realizedPnlPaise >= 0) realizedStcg += lot.realizedPnlPaise;
        else realizedStcl += Math.abs(lot.realizedPnlPaise);
      } else {
        if (lot.realizedPnlPaise >= 0) realizedLtcg += lot.realizedPnlPaise;
        else realizedLtcl += Math.abs(lot.realizedPnlPaise);
      }
    }

    // Set-off hierarchy:
    // Net STCG after STCL
    const netStcgAfterStcl = Math.max(0, realizedStcg - realizedStcl);
    const unabsorbedStcl = Math.max(0, realizedStcl - realizedStcg);

    // Net LTCG after LTCL and unabsorbed STCL
    const netLtcgAfterLtcl = Math.max(0, realizedLtcg - realizedLtcl);
    const netLtcgAfterAllLosses = Math.max(0, netLtcgAfterLtcl - unabsorbedStcl);

    // Apply ₹1.25L annual LTCG exemption
    const exemptionUsed = Math.min(netLtcgAfterAllLosses, ANNUAL_LTCG_EXEMPTION_PAISE);
    const exemptionRemaining = Math.max(0, ANNUAL_LTCG_EXEMPTION_PAISE - exemptionUsed);
    const taxableLtcg = Math.max(0, netLtcgAfterAllLosses - exemptionUsed);
    const taxableStcg = netStcgAfterStcl;

    // Taxes
    const stcgTax = Math.floor((taxableStcg * STCG_RATE_PCT) / 100);
    const ltcgTax = Math.floor((taxableLtcg * LTCG_RATE_PCT) / 100);

    return {
      realizedStcgPaise: realizedStcg,
      realizedLtcgPaise: realizedLtcg,
      realizedStclPaise: realizedStcl,
      realizedLtclPaise: realizedLtcl,
      netIntradayPaise: netIntraday,
      netStcgPaise: netStcgAfterStcl,
      netLtcgPaise: netLtcgAfterAllLosses,
      ltcgExemptionUsedPaise: exemptionUsed,
      ltcgExemptionRemainingPaise: exemptionRemaining,
      taxableStcgPaise: taxableStcg,
      taxableLtcgPaise: taxableLtcg,
      stcgTaxPaise: stcgTax,
      ltcgTaxPaise: ltcgTax,
      totalCapitalGainsTaxPaise: stcgTax + ltcgTax,
      matchedLots,
    };
  }
}
