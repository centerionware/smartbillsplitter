import { useEffect, useMemo } from 'react';
import { View } from '../types';
// Import base hooks
import { useBills } from './useBills';
import { useImportedBills } from './useImportedBills';
import { useRecurringBills } from './useRecurringBills';
import { useGroups } from './useGroups';
import { useCategories } from './useCategories';
import { useSettings } from './useSettings';
import { useTheme } from './useTheme';
import { useAuth } from './useAuth';
import { usePwaInstall } from './usePwaInstall';
import { useAppControl } from '../contexts/AppControlContext';
// Import new refactored hooks
import { useRouting } from './appLogic/useRouting';
import { useModalStates } from './appLogic/useModalStates';
import { useDashboardState } from './appLogic/useDashboardState';
import { useDerivedData } from './appLogic/useDerivedData';
import { useSideEffects } from './appLogic/useSideEffects';
import { useDataHandlers } from './appLogic/useDataHandlers';

export const useAppLogic = () => {
    // --- 1. Base Data Hooks ---
    const settingsHook = useSettings();
    const billsHook = useBills();
    const importedBillsHook = useImportedBills();
    const recurringBillsHook = useRecurringBills();
    const groupsHook = useGroups();
    const categoriesHook = useCategories();
    const themeHook = useTheme();
    const authHook = useAuth();
    const pwaInstallHook = usePwaInstall();
    const appControlHook = useAppControl();

    // --- 2. State & UI Logic Hooks ---
    const modalStates = useModalStates();
    const dashboardState = useDashboardState(settingsHook.settings, settingsHook.updateSettings);
    const routing = useRouting({
        bills: billsHook.bills,
        recurringBills: recurringBillsHook.recurringBills,
        groups: groupsHook.groups
    });
    
    // De-structure for easier access and to manage dependencies
    const { view, navigate } = routing;

    useEffect(() => {
        if (view !== View.Dashboard) {
            dashboardState.setSelectedParticipant(null);
            // FIX: Updated to use the renamed prop 'onSetDashboardSummaryFilter' from the useDashboardState hook.
            dashboardState.onSetDashboardSummaryFilter('total');
        }
    }, [view, dashboardState.setSelectedParticipant, dashboardState.onSetDashboardSummaryFilter]);

    // --- 3. Derived Data ---
    const derivedData = useDerivedData({
        bills: billsHook.bills,
        importedBills: importedBillsHook.importedBills,
        recurringBills: recurringBillsHook.recurringBills,
        groups: groupsHook.groups,
        categories: categoriesHook.categories,
        settings: settingsHook.settings,
        isBillsLoading: billsHook.isLoading,
        isImportedLoading: importedBillsHook.isLoading,
        isRecurringLoading: recurringBillsHook.isLoading,
        isSettingsLoading: settingsHook.isLoading,
        isGroupsLoading: groupsHook.isLoading,
        isCategoriesLoading: categoriesHook.isLoading,
        dashboardStatusFilter: dashboardState.dashboardStatusFilter,
        budgetDate: dashboardState.budgetDate,
    });

    // --- 4. Side Effects (Polling, Notifications) ---
    useSideEffects({
        bills: billsHook.bills,
        importedBills: importedBillsHook.importedBills,
        recurringBills: recurringBillsHook.recurringBills,
        settings: settingsHook.settings,
        updateMultipleImportedBills: importedBillsHook.updateMultipleImportedBills,
        originalUpdateMultipleBills: billsHook.updateMultipleBills,
    });

    // --- 5. Data Handlers ---
    const dataHandlers = useDataHandlers({
        bills: billsHook.bills,
        recurringBills: recurringBillsHook.recurringBills,
        settings: settingsHook.settings,
        subscriptionStatus: authHook.subscriptionStatus,
        showNotification: appControlHook.showNotification,
        requestConfirmation: modalStates.requestConfirmation,
        navigate: routing.navigate,
        originalUpdateBill: billsHook.updateBill,
        originalUpdateMultipleBills: billsHook.updateMultipleBills,
        addBill: billsHook.addBill,
        deleteBill: billsHook.deleteBill,
        addImportedBill: importedBillsHook.addImportedBill,
        deleteImportedBill: importedBillsHook.deleteImportedBill,
        addRecurringBill: recurringBillsHook.addRecurringBill,
        updateRecurringBill: recurringBillsHook.updateRecurringBill,
        deleteRecurringBill: recurringBillsHook.deleteRecurringBill,
        updateRecurringBillDueDate: recurringBillsHook.updateRecurringBillDueDate,
        addGroup: groupsHook.addGroup,
        updateGroup: groupsHook.updateGroup,
        deleteGroup: groupsHook.deleteGroup,
        incrementGroupPopularity: groupsHook.incrementGroupPopularity,
    });

    // --- 6. Compose and Return Final State ---
    const currentBill = useMemo(() => billsHook.bills.find(b => b.id === routing.params.billId), [billsHook.bills, routing.params.billId]);
    const currentImportedBill = useMemo(() => importedBillsHook.importedBills.find(b => b.id === routing.params.importedBillId), [importedBillsHook.importedBills, routing.params.importedBillId]);

    return {
        // Base hook data and setters
        ...settingsHook,
        ...billsHook,
        ...importedBillsHook,
        ...recurringBillsHook,
        ...groupsHook,
        ...categoriesHook,
        ...themeHook,
        ...authHook,
        ...pwaInstallHook,
        ...appControlHook,
        // State hooks
        ...modalStates,
        ...dashboardState,
        // Routing
        ...routing,
        // Derived data
        ...derivedData,
        // Handlers
        ...dataHandlers,
        // Specific current items for router
        currentBill,
        currentImportedBill,
    };
};