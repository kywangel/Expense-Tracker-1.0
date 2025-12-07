import React, { useState } from 'react';
import { Transaction, AppSettings } from '../types';

interface BudgetingProps {
  settings: AppSettings;
  transactions: Transaction[];
  onUpdateBudget: (category: string, amount: number) => void;
  onBack: () => void;
}

const Budgeting: React.FC<BudgetingProps> = ({ settings, transactions, onUpdateBudget, onBack }) => {
    const { categoryBudgets, incomeCategories, expenseCategories, investmentCategories } = settings;
    const [visibleSections, setVisibleSections] = useState({
        income: true,
        expenses: true,
        savings: true,
    });

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const spendingByCategory = transactions.reduce((acc, t) => {
        const d = new Date(t.date);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            acc[t.category] = (acc[t.category] || 0) + t.amount;
        }
        return acc;
    }, {} as Record<string, number>);

    const toggleSection = (section: 'income' | 'expenses' | 'savings') => {
        setVisibleSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const renderBudgetTable = (title: string, type: 'income' | 'expense' | 'investment', categories: string[]) => {
        // FIX: Map 'expense' type to 'expenses' key to match the state object.
        const sectionKey = type === 'investment' ? 'savings' : type === 'expense' ? 'expenses' : type;
        const isVisible = visibleSections[sectionKey];
        const headerColor = type === 'income' ? 'bg-green-500' : type === 'expense' ? 'bg-red-700' : 'bg-blue-600';
        
        const totalTracked = categories.reduce((sum, cat) => sum + (spendingByCategory[cat] || 0), 0);
        const totalBudget = categories.reduce((sum, cat) => sum + (categoryBudgets[cat] || 0), 0);
        const totalRemaining = totalBudget - Math.abs(totalTracked);

        return (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6 border border-gray-200">
                <button 
                  onClick={() => toggleSection(sectionKey)}
                  className={`${headerColor} text-white px-4 py-2 font-bold text-sm flex justify-between items-center w-full focus:outline-none transition-all`}
                >
                   <span className="capitalize">{title}</span>
                   <svg className={`w-5 h-5 transform transition-transform ${isVisible ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {isVisible && (
                    <div className="divide-y divide-gray-100">
                        {categories.map(cat => {
                            const tracked = spendingByCategory[cat] || 0;
                            const budget = categoryBudgets[cat] || 0;
                            const percent = budget > 0 ? (Math.abs(tracked) / budget) * 100 : 0;
                            
                            return (
                                <div key={cat} className="grid grid-cols-3 gap-2 px-4 py-3 text-xs items-center">
                                    <div className="col-span-1 font-medium text-gray-800 truncate pr-2">{cat}</div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number"
                                            placeholder="0.00"
                                            value={budget || ''}
                                            onChange={e => onUpdateBudget(cat, parseFloat(e.target.value) || 0)}
                                            className="w-full text-right bg-gray-100 rounded-md px-2 py-1 font-mono focus:ring-2 focus:ring-blue-200 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="grid grid-cols-2 gap-2 px-4 py-3 bg-gray-50 font-bold text-xs border-t border-gray-200">
                     <div className="col-span-1">Total Budget</div>
                     <div className="text-right font-mono">${totalBudget.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                 <div className="px-4 py-2 bg-gray-100 text-xs font-bold text-right flex justify-end gap-2">
                    <span className="text-gray-500">Tracked vs Budget:</span>
                    <span className={Math.abs(totalTracked) > totalBudget ? 'text-red-500' : 'text-gray-800'}>
                        ${Math.abs(totalTracked).toLocaleString('en-US', {minimumFractionDigits: 2})} / ${totalBudget.toLocaleString('en-US', {minimumFractionDigits: 2})}
                    </span>
                 </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-24">
            <button onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-2">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back to Settings
            </button>

            {renderBudgetTable('Income', 'income', incomeCategories)}
            {renderBudgetTable('Expenses', 'expense', expenseCategories)}
            {renderBudgetTable('Savings / Investments', 'investment', investmentCategories)}
        </div>
    );
};

export default Budgeting;