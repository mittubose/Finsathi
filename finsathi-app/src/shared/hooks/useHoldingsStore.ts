import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DailyHolding {
  id: string;
  symbol: string;
  qty: number;
  avgBuyPricePaise: number;
  currentMarketPricePaise: number;
  peRatio: number;
  roce: number;
  medianPE5Y: number;
  holdingType: 'ST' | 'LT'; // ST = Short Term (held < 12M), LT = Long Term (held >= 12M)
  assetType: 'equity' | 'mf';
  isin?: string;
  lastUpdated: string;
}

interface HoldingsState {
  holdings: DailyHolding[];
  addHolding: (holding: DailyHolding) => void;
  updateHolding: (id: string, updates: Partial<DailyHolding>) => void;
  deleteHolding: (id: string) => void;
  resetToDefaultHoldings: () => void;
}

const DEFAULT_HOLDINGS: DailyHolding[] = [
  {
    id: 'h-1',
    symbol: 'NYKAA',
    qty: 500,
    avgBuyPricePaise: 18500, // ₹185.00
    currentMarketPricePaise: 15500, // ₹155.00 (Unrealized loss of ₹30.00/share = -₹15,000)
    peRatio: 82.4, // > 40 (Premium)
    roce: 9.2, // < 18% (Substandard fundamental) -> Violates ROC 18/40!
    medianPE5Y: 65.0,
    holdingType: 'ST',
    assetType: 'equity',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'h-2',
    symbol: 'PAYTM',
    qty: 100,
    avgBuyPricePaise: 82000, // ₹820.00
    currentMarketPricePaise: 65000, // ₹650.00 (Unrealized loss of ₹170.00/share = -₹17,000)
    peRatio: 54.1, // > 40
    roce: -2.4, // < 18% -> Violates ROC 18/40!
    medianPE5Y: 42.0,
    holdingType: 'ST',
    assetType: 'equity',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'h-3',
    symbol: 'TATAMOTORS',
    qty: 200,
    avgBuyPricePaise: 105000, // ₹1,050.00
    currentMarketPricePaise: 90000, // ₹900.00 (Unrealized loss of ₹150.00/share = -₹30,000)
    peRatio: 10.5, // < 40 (Value)
    roce: 22.4, // >= 18% (Highly efficient) -> Healthy business, good STCG harvest candidate
    medianPE5Y: 15.0,
    holdingType: 'ST',
    assetType: 'equity',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'h-4',
    symbol: 'WIPRO',
    qty: 250,
    avgBuyPricePaise: 58000, // ₹580.00
    currentMarketPricePaise: 46000, // ₹460.00 (Unrealized loss of ₹120.00/share = -₹30,000)
    peRatio: 22.8, // < 40
    roce: 16.5, // < 18% (Moderate efficiency, but P/E is value-grade, so not an exit violation of both)
    medianPE5Y: 20.2,
    holdingType: 'LT',
    assetType: 'equity',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'h-5',
    symbol: 'INFOSYS',
    qty: 120,
    avgBuyPricePaise: 165000, // ₹1,650.00
    currentMarketPricePaise: 142000, // ₹1,420.00 (Unrealized loss of ₹230.00/share = -₹27,600)
    peRatio: 25.1, // < 40
    roce: 38.2, // >= 18% (Excellent business) -> Healthy holding, harvesting opportunity
    medianPE5Y: 26.5,
    holdingType: 'ST',
    assetType: 'equity',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'h-6',
    symbol: 'RELIANCE',
    qty: 150,
    avgBuyPricePaise: 240000, // ₹2,400.00
    currentMarketPricePaise: 290000, // ₹2,900.00 (Unrealized gain of ₹500.00/share = +₹75,000)
    peRatio: 28.5, // < 40
    roce: 10.2, // < 18% (Asset heavy, but P/E is moderate, so not an exit violation of both)
    medianPE5Y: 26.8,
    holdingType: 'LT',
    assetType: 'equity',
    lastUpdated: new Date().toISOString(),
  }
];

export const useHoldingsStore = create<HoldingsState>()(
  persist(
    (set) => ({
      holdings: DEFAULT_HOLDINGS,

      addHolding: (holding) => set((s) => ({ holdings: [...s.holdings, holding] })),

      updateHolding: (id, updates) => set((s) => ({
        holdings: s.holdings.map((h) => h.id === id ? { ...h, ...updates, lastUpdated: new Date().toISOString() } : h)
      })),

      deleteHolding: (id) => set((s) => ({
        holdings: s.holdings.filter((h) => h.id !== id)
      })),

      resetToDefaultHoldings: () => set({ holdings: DEFAULT_HOLDINGS }),
    }),
    {
      name: 'finsathi-holdings-store',
    }
  )
);
