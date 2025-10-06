import React from 'react';
import type { Settings, Category } from '../../types';

interface BudgetingSettingsProps {
  settings: Settings;
  onSettingsChange: (newSettings: Partial<Settings>) => void;
  categories: Category[];
  onCategoriesChange: (categories: Category[]) => void;
}

const BudgetingSettings: React.FC<BudgetingSettingsProps> = ({ settings, onSettingsChange, categories, onCategoriesChange }) => {

    const handleCategoryChange = (id: string, field: 'name' | 'budget', value: string | number) => {
        onCategoriesChange(categories.map(cat => cat.id === id ? { ...cat, [field]: value } : cat));
    };

    const handleAddCategory = () => {
        const newCategory: Category = { id: `cat-new-${Date.now()}`, name: '', budget: undefined };
        onCategoriesChange([...categories, newCategory]);
    };

    const handleDelete = (id: string, isDefault?: boolean) => {
        if (isDefault) {
            // Can't delete default categories, just clear their budget and name (which is disallowed by disabled anyway)
            // The only real action is clearing a budget
             onCategoriesChange(categories.map(cat => cat.id === id ? { ...cat, budget: undefined } : cat));
        } else {
            onCategoriesChange(categories.filter(cat => cat.id !== id));
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <label htmlFor="totalBudget" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Total Monthly Budget (Optional)</label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span>
                    <input id="totalBudget" name="totalBudget" type="number" step="0.01" value={settings.totalBudget === undefined ? '' : settings.totalBudget} onChange={e => onSettingsChange({ totalBudget: e.target.value === '' ? undefined : parseFloat(e.target.value) })} placeholder="e.g., 2000" className="w-full pl-7 pr-2 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Set an overall budget. If left empty, your total budget will be the sum of individual category budgets.
                </p>
            </div>
            
            <div className="space-y-4">
                <h4 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Category Budgets</h4>
                {categories.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-3">
                        <input
                            type="text"
                            value={cat.name}
                            onChange={e => handleCategoryChange(cat.id, 'name', e.target.value)}
                            placeholder="Category Name"
                            className="flex-grow px-3 py-2 border border-slate-300 rounded-md focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 disabled:bg-slate-100 dark:disabled:bg-slate-600"
                            disabled={cat.isDefault}
                        />
                        <div className="relative w-32">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span>
                            <input
                                type="number"
                                step="0.01"
                                value={cat.budget === undefined ? '' : cat.budget}
                                onChange={e => handleCategoryChange(cat.id, 'budget', (e.target.value === '' ? undefined : parseFloat(e.target.value)) as number | undefined)}
                                placeholder="Budget"
                                className="w-full pl-7 pr-2 py-2 border border-slate-300 rounded-md focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600"
                            />
                        </div>
                        {!cat.isDefault && (
                            <button onClick={() => handleDelete(cat.id, cat.isDefault)} className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full flex-shrink-0" aria-label={`Delete category ${cat.name}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                            </button>
                        )}
                    </div>
                ))}
                 <button onClick={handleAddCategory} className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    <span>Add New Category</span>
                </button>
            </div>
        </div>
    );
};

export default BudgetingSettings;