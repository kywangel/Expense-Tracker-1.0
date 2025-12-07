import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    LineChart, Line, Legend 
} from 'recharts';
import { 
    format, endOfWeek, endOfMonth, endOfYear,
    eachDayOfInterval, eachMonthOfInterval, getDay, addMonths, 
    isToday, isSameMonth, addWeeks, addYears
} from 'date-fns';
// Fix: Import failing functions from their submodules.
import startOfWeek from 'date-fns/startOfWeek';
import startOfMonth from 'date-fns/startOfMonth';
import startOfYear from 'date-fns/startOfYear';
import subMonths from 'date-fns/subMonths';

interface StatisticsProps {
  transactions: Transaction[];
  incomeCategories: string[];
  investmentCategories: string[];
  expenseCategories: string[];
}

const generateShades = (hexColor: string, count: number) => {
    const color = hexColor.startsWith('#') ? hexColor.substring(1) : hexColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    
    const shades = [];
    for (let i = 0; i < count; i++) {
        const factor = 1 - (i * 0.1);
        shades.push(`rgba(${r}, ${g}, ${b}, ${Math.max(0.2, factor)})`);
    }
    return shades;
};

const Statistics: React.FC<StatisticsProps> = ({ transactions, expenseCategories }) => {
  const [period, setPeriod] = useState<'W' | 'M' | '6M' | 'Y'>('M');
  const [assetView, setAssetView] = useState<'wealth' | 'investment'>('wealth');
  const [dateOffset, setDateOffset] = useState(0); // For W, 6M, Y navigation

  const sortedTransactions = useMemo(() => 
    [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [transactions]
  );
  
  const netAssetData = useMemo(() => {
    let wealthBalance = 0;
    let investmentBalance = 0;
    const wealthData: { date: string; balance: number }[] = [];
    const investmentData: { date: string; balance: number }[] = [];
    
    sortedTransactions.forEach(tx => {
        if (tx && !isNaN(tx.amount)) {
            if(tx.type === 'income' || tx.type === 'expense') wealthBalance += tx.amount;
            if (tx.type === 'investment') investmentBalance += Math.abs(tx.amount);
            wealthData.push({ date: tx.date, balance: wealthBalance });
            investmentData.push({ date: tx.date, balance: investmentBalance });
        }
    });
    return { wealthData, investmentData };
  }, [sortedTransactions]);

  const spendingChartData = useMemo(() => {
    const baseDate = new Date();
    let interval;
    let formatLabel: (date: Date) => string;
    let dataPoints: Date[];

    switch (period) {
      case 'W':
        const weekDate = addWeeks(baseDate, dateOffset);
        interval = { start: startOfWeek(weekDate), end: endOfWeek(weekDate) };
        dataPoints = eachDayOfInterval(interval);
        formatLabel = (date) => format(date, 'EEE');
        break;
      case '6M':
        const sixMonthsDate = addMonths(baseDate, dateOffset * 6);
        interval = { start: startOfMonth(subMonths(sixMonthsDate, 5)), end: endOfMonth(sixMonthsDate) };
        dataPoints = eachMonthOfInterval(interval);
        formatLabel = (date) => format(date, 'MMM');
        break;
      case 'Y':
        const yearDate = addYears(baseDate, dateOffset);
        interval = { start: startOfYear(yearDate), end: endOfYear(yearDate) };
        dataPoints = eachMonthOfInterval(interval);
        formatLabel = (date) => format(date, 'MMM');
        break;
      default: return [];
    }
    
    const relevantTxs = sortedTransactions.filter(tx => {
        if (!tx || !tx.date) return false;
        const txDate = new Date(tx.date);
        return !isNaN(txDate.getTime()) && txDate >= interval.start && txDate <= interval.end && tx.type === 'expense';
    });

    const dataMap = new Map<string, any>();
    dataPoints.forEach(point => dataMap.set(formatLabel(point), { name: formatLabel(point) }));

    relevantTxs.forEach(tx => {
        const key = formatLabel(new Date(tx.date));
        const entry = dataMap.get(key);
        if (entry) {
            entry[tx.category] = (entry[tx.category] || 0) + Math.abs(tx.amount);
            entry.total = (entry.total || 0) + Math.abs(tx.amount);
        }
    });
    return Array.from(dataMap.values());
  }, [sortedTransactions, period, dateOffset]);

  const expenseColors = useMemo(() => {
    const colorMap: Record<string, string> = {};
    const colors = generateShades('#EF4444', expenseCategories.length);
    expenseCategories.forEach((cat, i) => colorMap[cat] = colors[i]);
    return colorMap;
  }, [expenseCategories]);

  const flowOverTimeData = useMemo(() => {
    const monthlyDataMap = new Map<string, { name: string, income: number, expense: number, investment: number }>();
    const yearStart = startOfYear(new Date());
    const yearMonths = eachMonthOfInterval({ start: yearStart, end: endOfYear(new Date()) });
    yearMonths.forEach(m => monthlyDataMap.set(format(m, 'MMM'), { name: format(m, 'MMM'), income: 0, expense: 0, investment: 0 }));

    sortedTransactions.forEach(curr => {
        const month = format(new Date(curr.date), 'MMM');
        const monthEntry = monthlyDataMap.get(month);
        if (monthEntry) {
            if (curr.type === 'income') monthEntry.income += curr.amount;
            else if (curr.type === 'expense') monthEntry.expense += Math.abs(curr.amount);
            else if (curr.type === 'investment') monthEntry.investment += Math.abs(curr.amount);
        }
    });
    return Array.from(monthlyDataMap.values());
  }, [sortedTransactions]);

  const CustomTooltip = ({ active, payload, label, expenseCategories }: any) => {
    if (active && payload && payload.length) {
      const breakdown = expenseCategories
        .map((cat: string) => ({ name: cat, value: payload[0].payload[cat] || 0 }))
        .filter((p: any) => p.value > 0)
        .sort((a: any, b: any) => b.value - a.value);

      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-bold text-gray-800 mb-1">{label}</p>
          <p className="text-xs text-gray-500 font-semibold mb-2">Total: <span className="font-mono">${payload[0].value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span></p>
          <div className="space-y-1 text-xs">
            {breakdown.slice(0, 5).map((p: any) => (
              <div key={p.name} className="flex justify-between items-center">
                <span className="text-gray-600 truncate max-w-[120px]">{p.name}</span>
                <span className="font-mono font-semibold text-gray-700">${p.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };
  
  const CalendarView = ({ baseDate, setBaseDate }: {baseDate: Date, setBaseDate: (d:Date)=>void}) => {
    const start = startOfMonth(baseDate);
    const daysInMonth = eachDayOfInterval({ start, end: endOfMonth(baseDate) });
    const startingDayIndex = getDay(start) === 0 ? 6 : getDay(start) - 1;
    
    const dailyTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        transactions.filter(tx => isSameMonth(new Date(tx.date), baseDate) && tx.type === 'expense')
            .forEach(tx => {
                const day = format(new Date(tx.date), 'd');
                totals[day] = (totals[day] || 0) + Math.abs(tx.amount);
            });
        return totals;
    }, [transactions, baseDate]);
    
    return (
        <div>
            <div className="flex justify-between items-center mb-4 px-2">
                <button onClick={() => setBaseDate(subMonths(baseDate, 1))} className="p-2 rounded-full hover:bg-gray-100">&lt;</button>
                <h4 className="font-bold text-gray-700">{format(baseDate, 'MMMM yyyy')}</h4>
                <button onClick={() => setBaseDate(addMonths(baseDate, 1))} className="p-2 rounded-full hover:bg-gray-100">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day,i) => <div key={i}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startingDayIndex }).map((_, i) => <div key={`e-${i}`} />)}
                {daysInMonth.map(day => {
                    const dayKey = format(day, 'd');
                    const total = dailyTotals[dayKey];
                    const amountStr = total ? total.toFixed(0) : '';
                    const fontSize = amountStr.length > 4 ? 'text-[9px]' : 'text-[10px]';
                    return (
                        <div key={day.toString()} className={`rounded-lg p-1.5 h-16 text-left ${isToday(day) ? 'bg-blue-50' : ''}`}>
                            <span className={`font-bold text-xs ${isToday(day) ? 'text-blue-600' : 'text-gray-600'}`}>{dayKey}</span>
                            {total && <p className={`text-red-600 font-semibold mt-1 ${fontSize}`}>-${total.toLocaleString()}</p>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };
  
  const PeriodNavigator = () => {
    const getLabel = () => {
      const now = new Date();
      if (period === 'W') {
        const d = addWeeks(now, dateOffset);
        return `${format(startOfWeek(d), 'd MMM')} - ${format(endOfWeek(d), 'd MMM')}`;
      }
      if (period === '6M') {
        const d = addMonths(now, dateOffset * 6);
        return `${format(startOfMonth(subMonths(d, 5)), 'MMM yyyy')} - ${format(endOfMonth(d), 'MMM yyyy')}`;
      }
      if (period === 'Y') return format(addYears(now, dateOffset), 'yyyy');
      return '';
    };
    return (
      <div className="flex items-center justify-center gap-4 my-2">
        <button onClick={() => setDateOffset(p => p - 1)} className="p-1 rounded-full hover:bg-gray-100">&lt;</button>
        <span className="text-xs font-bold text-gray-600">{getLabel()}</span>
        <button onClick={() => setDateOffset(p => p + 1)} className="p-1 rounded-full hover:bg-gray-100">&gt;</button>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24">
       <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-700">Net Asset Change</h3>
                 <div className="flex bg-gray-100 p-1 rounded-lg text-xs">
                    {(['wealth', 'investment'] as const).map(p => (
                        <button key={p} onClick={() => setAssetView(p)} className={`px-3 py-1 font-bold rounded-md transition-colors capitalize ${assetView === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:bg-gray-200'}`}>
                            {p === 'wealth' ? 'Wealth' : 'Investments'}
                        </button>
                    ))}
                </div>
            </div>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={assetView === 'wealth' ? netAssetData.wealthData : netAssetData.investmentData}>
                        <YAxis tick={{fontSize: 10}} stroke="#9ca3af" tickFormatter={(v) => `$${Number(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                        <Line type="monotone" dataKey="balance" stroke={assetView === 'wealth' ? "#10b981" : "#3B82F6"} strokeWidth={2} dot={false}/>
                    </LineChart>
                </ResponsiveContainer>
            </div>
            {assetView === 'wealth' && <p className="text-xs text-gray-400 text-center mt-2">Wealth data is coming from Income - Expense</p>}
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-700">Spending Analysis</h3>
                <div className="flex bg-gray-100 p-1 rounded-lg text-xs">
                    {(['W', 'M', '6M', 'Y'] as const).map(p => (
                        <button key={p} onClick={() => { setPeriod(p); setDateOffset(0); }} className={`px-3 py-1 font-bold rounded-md transition-colors ${period === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:bg-gray-200'}`}>
                            {p}
                        </button>
                    ))}
                </div>
            </div>
            {period !== 'M' && <PeriodNavigator />}
            <div className="w-full">
                {period === 'M' ? <CalendarView baseDate={addMonths(new Date(), dateOffset)} setBaseDate={(d) => setDateOffset(d.getMonth() - new Date().getMonth() + (d.getFullYear() - new Date().getFullYear())*12)} /> :
                 period === 'Y' ? 
                 <div className="h-80">
                     <ResponsiveContainer width="100%" height="100%">
                         <LineChart data={spendingChartData} margin={{top: 5, right: 5, left: -25, bottom: 5}}>
                            <XAxis dataKey="name" tick={{fontSize: 12}} />
                            <YAxis tick={{fontSize: 10}} />
                            <Tooltip content={<CustomTooltip expenseCategories={expenseCategories} />} />
                            <Line type="monotone" dataKey="total" stroke="#EF4444" strokeWidth={2} name="Total Expenses" />
                         </LineChart>
                     </ResponsiveContainer>
                 </div>
                 :
                 <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={spendingChartData} margin={{top: 5, right: 5, left: -25, bottom: 5}}>
                            <XAxis dataKey="name" tick={{fontSize: 12}} />
                            <YAxis tick={{fontSize: 10}} />
                            <Tooltip content={<CustomTooltip expenseCategories={expenseCategories} />} cursor={{fill: '#f3f4f6'}} />
                            {expenseCategories.map(cat => <Bar key={cat} dataKey={cat} stackId="a" fill={expenseColors[cat] || '#ccc'} name={cat} />)}
                        </BarChart>
                    </ResponsiveContainer>
                 </div>}
            </div>
        </div>

       <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">Monthly Flow</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flowOverTimeData}>
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis tick={{fontSize: 10}} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}}/>
                <Bar dataKey="income" fill="#10B981" name="Income" />
                <Bar dataKey="expense" fill="#EF4444" name="Expenses" />
                <Bar dataKey="investment" fill="#3B82F6" name="Investments" />
              </BarChart>
            </ResponsiveContainer>
          </div>
       </div>
    </div>
  );
};

export default Statistics;