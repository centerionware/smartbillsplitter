import { useMemo } from 'react';
import type { Bill, ImportedBill, RecurringBill, Settings, Group, Category } from '../../types';
import type { ParticipantData } from '../../components/dashboard/ParticipantList';

interface DerivedDataDependencies {
    bills: Bill[];
    importedBills: ImportedBill[];
    recurringBills: RecurringBill[];
    groups: Group[];
    categories: Category[];
    settings: Settings;
    isBillsLoading: boolean;
    isImportedLoading: boolean;
    isRecurringLoading: boolean;
    isSettingsLoading: boolean;
    isGroupsLoading: boolean;
    isCategoriesLoading: boolean;
    dashboardStatusFilter: 'active' | 'archived';
    budgetDate: { year: number; month: number } | 'last30days';
}

export const useDerivedData = ({
    bills, importedBills, recurringBills, groups, categories, settings,
    isBillsLoading, isImportedLoading, isRecurringLoading, isSettingsLoading, isGroupsLoading, isCategoriesLoading,
    dashboardStatusFilter, budgetDate
}: DerivedDataDependencies) => {
    const isLoading = isBillsLoading || isImportedLoading || isRecurringLoading || isSettingsLoading || isGroupsLoading || isCategoriesLoading;

    const participantsData = useMemo((): ParticipantData[] => {
        const myDisplayNameLower = settings.myDisplayName.trim().toLowerCase();
        const participantContactInfo = new Map<string, { phone?: string; email?: string }>();
        bills.forEach(bill => {
            bill.participants.forEach(p => {
                if (p.name.trim().toLowerCase() === myDisplayNameLower) return;
                const existing = participantContactInfo.get(p.name) || {};
                if ((p.phone && !existing.phone) || (p.email && !existing.email)) {
                    participantContactInfo.set(p.name, { phone: p.phone || existing.phone, email: p.email || existing.email });
                }
            });
        });

        if (dashboardStatusFilter === 'active') {
            const debtMap = new Map<string, number>();
            bills.forEach(bill => {
                if (bill.status !== 'active') return;
                bill.participants.forEach(p => {
                    if (!p.paid && p.amountOwed > 0.005 && p.name.trim().toLowerCase() !== myDisplayNameLower) {
                        debtMap.set(p.name, (debtMap.get(p.name) || 0) + p.amountOwed);
                    }
                });
            });
            return Array.from(debtMap.entries())
                .map(([name, amount]) => ({ name, amount, type: 'owed' as const, ...participantContactInfo.get(name) }))
                .sort((a, b) => b.amount - a.amount);
        } else {
            const participantStats = new Map<string, { outstandingDebt: number; totalBilled: number }>();
            bills.forEach(bill => {
                bill.participants.forEach(p => {
                    const stats = participantStats.get(p.name) || { outstandingDebt: 0, totalBilled: 0 };
                    stats.totalBilled += p.amountOwed;
                    if (!p.paid) stats.outstandingDebt += p.amountOwed;
                    participantStats.set(p.name, stats);
                });
            });
            return Array.from(participantStats.entries())
                .filter(([name, stats]) => stats.outstandingDebt < 0.01 && stats.totalBilled > 0 && name.trim().toLowerCase() !== myDisplayNameLower)
                .map(([name, stats]) => ({ name, amount: stats.totalBilled, type: 'paid' as const, ...participantContactInfo.get(name) }))
                .sort((a, b) => b.amount - a.amount);
        }
    }, [bills, dashboardStatusFilter, settings.myDisplayName]);

    const budgetData = useMemo(() => {
        const myNameLower = settings.myDisplayName.trim().toLowerCase();
        if (!myNameLower || isSettingsLoading || isCategoriesLoading || isBillsLoading || isImportedLoading) {
            return { totalBudget: 0, totalSpending: 0, spendingByCategory: {}, hasBudgetData: false };
        }

        let startDate: Date;
        let endDate = new Date();
        if (budgetDate === 'last30days') {
            startDate = new Date();
            startDate.setDate(endDate.getDate() - 30);
            startDate.setHours(0,0,0,0);
        } else {
            startDate = new Date(budgetDate.year, budgetDate.month, 1);
            endDate = new Date(budgetDate.year, budgetDate.month + 1, 0);
            endDate.setHours(23, 59, 59, 999);
        }

        const relevantUserBills: { billId: string; description: string; userPortion: number; date: string; categoryId?: string; isImported: boolean }[] = [];
        
        bills.forEach(bill => {
            const billDate = new Date(bill.date);
            if (bill.status === 'active' && billDate >= startDate && billDate <= endDate) {
                const myParticipant = bill.participants.find(p => p.name.trim().toLowerCase() === myNameLower);
                if (myParticipant) {
                    const userPortion = bill.participants.length === 1 && bill.participants[0].name.trim().toLowerCase() === myNameLower ? bill.totalAmount : myParticipant.amountOwed;
                    if (userPortion > 0) {
                        relevantUserBills.push({
                            billId: bill.id, description: bill.description, userPortion, date: bill.date, categoryId: bill.categoryId, isImported: false
                        });
                    }
                }
            }
        });

        importedBills.forEach(iBill => {
            const bill = iBill.sharedData.bill;
            const billDate = new Date(bill.date);
            if (iBill.status === 'active' && billDate >= startDate && billDate <= endDate && iBill.myParticipantId) {
                const myParticipant = bill.participants.find(p => p.id === iBill.myParticipantId);
                if (myParticipant) {
                    const userPortion = myParticipant.amountOwed;
                    if (userPortion > 0) {
                        relevantUserBills.push({
                            billId: iBill.id, description: bill.description, userPortion, date: bill.date, categoryId: bill.categoryId, isImported: true
                        });
                    }
                }
            }
        });
        
        const spendingByCategory: Record<string, any> = {};
        let totalSpending = 0;

        relevantUserBills.forEach(bill => {
            totalSpending += bill.userPortion;
            const categoryId = bill.categoryId;
            const category = categories.find(c => c.id === categoryId);
            
            const targetId = category ? category.id : 'uncategorized';

            if (!spendingByCategory[targetId]) {
                spendingByCategory[targetId] = {
                    category: category || { id: 'uncategorized', name: 'Uncategorized' },
                    spent: 0,
                    bills: []
                };
            }
            spendingByCategory[targetId].spent += bill.userPortion;
            spendingByCategory[targetId].bills.push(bill);
        });

        let totalBudget = settings.totalBudget || 0;
        if (!settings.totalBudget || settings.totalBudget === 0) {
            totalBudget = categories.reduce((sum, cat) => sum + (cat.budget || 0), 0);
        }

        const hasAnyBillsWithCategory = bills.some(b => b.categoryId) || importedBills.some(b => b.sharedData.bill.categoryId);
        const hasAnyBudgetSet = totalBudget > 0 || categories.some(c => c.budget && c.budget > 0);

        return {
            totalBudget,
            totalSpending,
            spendingByCategory,
            hasBudgetData: hasAnyBillsWithCategory || hasAnyBudgetSet
        };
    }, [bills, importedBills, categories, settings, budgetDate, isSettingsLoading, isCategoriesLoading, isBillsLoading, isImportedLoading]);
    
    return { isLoading, participantsData, budgetData };
};
