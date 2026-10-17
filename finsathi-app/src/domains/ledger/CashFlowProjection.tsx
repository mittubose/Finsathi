import { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ComposedChart, Line, Legend, Cell, ReferenceLine
} from 'recharts';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { formatINRCompact } from '../../shared/lib/currency';
import './CashFlowProjection.css';

export function CashFlowProjection() {
  const { recurringRules, incomeItems, expenseItems } = useAppStore();

  const data = useMemo(() => {
    const months = [];
    const now = new Date();
    
    let baseIncome = 0;
    let baseExpense = 0;
    if (recurringRules.length === 0) {
      const currMonth = now.getMonth();
      const currYear = now.getFullYear();
      let currentMonthIncome = 0;
      let currentMonthExpense = 0;
      
      incomeItems.forEach(i => {
         const d = new Date(i.date);
         if (d.getMonth() === currMonth && d.getFullYear() === currYear) currentMonthIncome += i.amountPaise;
      });
      expenseItems.forEach(e => {
         const d = new Date(e.date);
         if (d.getMonth() === currMonth && d.getFullYear() === currYear) currentMonthExpense += e.amountPaise;
      });

      if (currentMonthIncome > 0 || currentMonthExpense > 0) {
        baseIncome = currentMonthIncome;
        baseExpense = currentMonthExpense;
      } else {
        // Fallback to average monthly values across all months with transactions
        const incomeByMonth: Record<string, number> = {};
        const expenseByMonth: Record<string, number> = {};
        
        incomeItems.forEach(i => {
          const d = new Date(i.date);
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          incomeByMonth[key] = (incomeByMonth[key] || 0) + i.amountPaise;
        });
        expenseItems.forEach(e => {
          const d = new Date(e.date);
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          expenseByMonth[key] = (expenseByMonth[key] || 0) + e.amountPaise;
        });

        const uniqueMonths = new Set([...Object.keys(incomeByMonth), ...Object.keys(expenseByMonth)]);
        if (uniqueMonths.size > 0) {
          const totalInc = Object.values(incomeByMonth).reduce((a, b) => a + b, 0);
          const totalExp = Object.values(expenseByMonth).reduce((a, b) => a + b, 0);
          baseIncome = Math.round(totalInc / uniqueMonths.size);
          baseExpense = Math.round(totalExp / uniqueMonths.size);
        }
      }
    }

    for (let i = 0; i < 12; i++) {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthLabel = targetMonth.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
      const monthYear = targetMonth.getFullYear();
      
      let income = 0;
      let expense = 0;

      if (recurringRules.length > 0) {
        recurringRules.forEach(rule => {
          if (!rule.isActive) return;
          if (rule.type === 'income') {
            income += rule.amountPaise;
          } else {
            expense += rule.amountPaise;
          }
        });
      } else {
        income = baseIncome;
        expense = baseExpense;
      }

      const net = income - expense;

      months.push({
        name: monthLabel,
        year: monthYear,
        income: income / 100, // Display in Rupees
        expense: expense / 100,
        net: net / 100,
      });
    }
    return months;
  }, [recurringRules, incomeItems, expenseItems]);

  return (
    <div className="cash-flow-projection">
      <div className="glass-card-header">
        <h2 className="text-label-mono color-subtle">CASH_FLOW_PROJECTION_12M</h2>
        <span className="text-label-mono-sm color-muted">VIRTUAL_LEDGER</span>
      </div>
      
      <div className="projection-chart-container">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'var(--font-headline)' }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'var(--font-headline)' }}
              tickFormatter={(v) => `₹${v/1000}k`}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            <Bar 
              dataKey="income" 
              name="INCOME" 
              fill="var(--primary-container)" 
              opacity={0.4} 
              barSize={12} 
              radius={[2, 2, 0, 0]}
            />
            <Bar 
              dataKey="expense" 
              name="EXPENSE" 
              fill="var(--on-surface)" 
              opacity={0.2} 
              barSize={12} 
              radius={[2, 2, 0, 0]}
            />
            <Line 
              type="monotone" 
              dataKey="net" 
              name="NET_CASH" 
              stroke="#fff" 
              strokeWidth={1.5} 
              dot={{ r: 2, fill: '#fff', strokeWidth: 0 }}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="projection-legend">
        <div className="legend-item">
          <span className="dot income" />
          <span className="text-label-mono-sm">RECURRING_INCOME</span>
        </div>
        <div className="legend-item">
          <span className="dot expense" />
          <span className="text-label-mono-sm">RECURRING_EXPENSE</span>
        </div>
        <div className="legend-item">
          <span className="dot net" />
          <span className="text-label-mono-sm">PROJECTED_NET</span>
        </div>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const net = payload.find((p: any) => p.dataKey === 'net')?.value || 0;
    return (
      <div className="chart-tooltip glass-surface-elevated">
        <p className="text-label-mono color-subtle" style={{ marginBottom: '8px' }}>{label} PROJECTION</p>
        <div className="tooltip-row">
          <span className="text-label-mono-sm color-muted">INCOME:</span>
          <span className="text-data-display color-positive">₹{payload[0].value.toLocaleString()}</span>
        </div>
        <div className="tooltip-row">
          <span className="text-label-mono-sm color-muted">EXPENSE:</span>
          <span className="text-data-display">₹{payload[1].value.toLocaleString()}</span>
        </div>
        <div className="tooltip-row net-row" style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-label-mono-sm color-muted">NET:</span>
          <span className={`text-data-display ${net >= 0 ? 'color-positive' : 'color-negative'}`}>
            ₹{net.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }
  return null;
}
