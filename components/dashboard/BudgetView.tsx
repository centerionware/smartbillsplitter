import React, { useState } from 'react';
import type { Category, View } from '../../types';
import ProgressBar from '../ProgressBar';

// Define the shape of the data this component expects
export interface BudgetData {
    totalBudget: number;
    totalSpending: number;
    spendingByCategory: Record<string, {
        category: Category;
        spent: number;
        bills: { billId: string; description: string; userPortion: number; date: string; isImported: boolean; }[];
    }>;
    hasBudgetData: boolean;
}

interface BudgetViewProps {
  budgetData: BudgetData;
  date: { year: number; month: number } | 'last30days';
  setDate: (date: { year: number; month: number } | 'last30days') => void;
  onSelectBill: (billInfo: { billId: string; isImported: boolean }) => void;
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const CategorySpendingCard: React.FC<{
    categoryData: BudgetData['spendingByCategory'][string];
    onSelectBill: (billInfo: { billId: string; isImported: boolean }) => void;
}> = ({ categoryData, onSelectBill }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { category, spent, bills } = categoryData;
    const budget = category.budget;
    const hasBudget = typeof budget === 'number' && budget > 0;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md transition-all duration-300">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full text-left p-4"
                aria-expanded={isExpanded}
            >
                <div className="flex justify-between items-center">
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">{category.name}</h4>
                    <div className="text-right">
                        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">${spent.toFixed(2)}</p>
                        {hasBudget && <p className="text-xs text-slate-500 dark:text-slate-400">of ${budget.toFixed(2)}</p>}
                    </div>
                </div>
                {hasBudget && (
                    <div className="mt-2">
                        <ProgressBar value={spent} max={budget} />
                    </div>
                )}
            </button>
            {isExpanded && (
                <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2">
                    <ul className="space-y-2 py-2">
                        {bills.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(bill => (
                             <li key={bill.billId}>
                                <button onClick={() => onSelectBill({ billId: bill.billId, isImported: bill.isImported })} className="w-full flex justify-between items-center text-sm p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-left">
                                    <div>
                                        <p className="font-semibold text-slate-700 dark:text-slate-200">{bill.description}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(bill.date).toLocaleDateString()}</p>
                                    </div>
                                    <p className="font-semibold text-slate-600 dark:text-slate-300">${bill.userPortion.toFixed(2)}</p>
                                </button>
                            </li>
                        ))}
                         {bills.length === 0 && <li className="text-center text-sm text-slate-500 dark:text-slate-400 py-2">No expenses in this period.</li>}
                    </ul>
                </div>
            )}
        </div>
    );
};


const BudgetView: React.FC<BudgetViewProps> = ({ budgetData, date, setDate, onSelectBill }) => {
    const { totalBudget, totalSpending, spendingByCategory } = budgetData;

    const handleDateChange = (direction: 1 | -1) => {
        if (date === 'last30days') {
            const now = new Date();
            now.setMonth(now.getMonth() + direction);
            setDate({ year: now.getFullYear(), month: now.getMonth() });
        } else {
            const newDate = new Date(date.year, date.month + direction, 1);
            setDate({ year: newDate.getFullYear(), month: newDate.getMonth() });
        }
    };
    
    // FIX: Explicitly type the sort parameters to resolve 'property does not exist on type unknown' errors.
    const sortedCategories = Object.values(spendingByCategory).sort((a: { spent: number }, b: { spent: number }) => b.spent - a.spent);

    const getDateLabel = () => {
        if (date === 'last30days') return "Last 30 Days";
        return `${months[date.month]} ${date.year}`;
    }

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md">
                <button onClick={() => handleDateChange(-1)} title="Previous month" aria-label="Previous month" className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                <div className="text-center">
                    <button onClick={() => setDate('last30days')} className="text-xl font-bold text-slate-700 dark:text-slate-200 hover:underline">{getDateLabel()}</button>
                </div>
                <button onClick={() => handleDateChange(1)} title="Next month" aria-label="Next month" className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
            </div>

            <div className="p-6 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Overall Spending</h3>
                <div className="mt-2 text-center">
                    <p className="text-4xl font-extrabold text-slate-800 dark:text-slate-100">${totalSpending.toFixed(2)}</p>
                    {totalBudget > 0 && <p className="text-sm text-slate-500 dark:text-slate-400">spent of ${totalBudget.toFixed(2)}</p>}
                </div>
                {totalBudget > 0 && (
                    <div className="mt-4">
                        <ProgressBar value={totalSpending} max={totalBudget} />
                    </div>
                )}
            </div>
            
             <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 px-2">Spending by Category</h3>
                {sortedCategories.map(catData => (
                    <CategorySpendingCard 
                        key={catData.category.id}
                        categoryData={catData}
                        onSelectBill={onSelectBill}
                    />
                ))}
            </div>
        </div>
    );
};

export default BudgetView;