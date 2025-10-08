import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { useAppLogic } from '../../hooks/useAppLogic';
import { View } from '../../types';
import type { Bill, ImportedBill } from '../../types';

// Mock all composed hooks to isolate the orchestrator's logic
vi.mock('../../hooks/useBills');
vi.mock('../../hooks/useImportedBills');
vi.mock('../../hooks/useRecurringBills');
vi.mock('../../hooks/useGroups');
vi.mock('../../hooks/useCategories');
vi.mock('../../hooks/useSettings');
vi.mock('../../hooks/useTheme');
vi.mock('../../hooks/useAuth');
vi.mock('../../hooks/usePwaInstall');
vi.mock('../../contexts/AppControlContext');
vi.mock('../../hooks/appLogic/useRouting');
vi.mock('../../hooks/appLogic/useModalStates');
vi.mock('../../hooks/appLogic/useDashboardState');
vi.mock('../../hooks/appLogic/useDerivedData');
vi.mock('../../hooks/appLogic/useSideEffects');
vi.mock('../../hooks/appLogic/useDataHandlers');

// Import mocked hooks to get their types
import { useBills } from '../../hooks/useBills';
import { useImportedBills } from '../../hooks/useImportedBills';
import { useRecurringBills } from '../../hooks/useRecurringBills';
import { useGroups } from '../../hooks/useGroups';
import { useCategories } from '../../hooks/useCategories';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { useAppControl } from '../../contexts/AppControlContext';
import { useRouting } from '../../hooks/appLogic/useRouting';
import { useModalStates } from '../../hooks/appLogic/useModalStates';
import { useDashboardState } from '../../hooks/appLogic/useDashboardState';
import { useDerivedData } from '../../hooks/appLogic/useDerivedData';
import { useSideEffects } from '../../hooks/appLogic/useSideEffects';
import { useDataHandlers } from '../../hooks/appLogic/useDataHandlers';


// Helper to correctly type the mocked functions
const mocked = <T extends (...args: any[]) => any>(fn: T): Mock<Parameters<T>, ReturnType<T>> => fn as any;

const mockSetSelectedParticipant = vi.fn();
const mockOnSetDashboardSummaryFilter = vi.fn();

// Define default return values for all mocked hooks
const defaultMocks = {
  useSettings: {
    settings: {
        myDisplayName: 'Test User',
        paymentDetails: { venmo: '', paypal: '', cashApp: '', zelle: '', customMessage: '' },
        shareTemplate: 'template',
        notificationsEnabled: false,
        notificationDays: 3,
        hidePaymentMethodWarning: false,
        totalBudget: undefined,
    },
    isLoading: false,
    updateSettings: vi.fn(),
  },
  useBills: { bills: [], isLoading: false, addBill: vi.fn(), updateBill: vi.fn(), deleteBill: vi.fn(), archiveBill: vi.fn(), unarchiveBill: vi.fn(), updateMultipleBills: vi.fn(), mergeBills: vi.fn() },
  useImportedBills: { importedBills: [], isLoading: false, addImportedBill: vi.fn(), updateImportedBill: vi.fn(), deleteImportedBill: vi.fn(), archiveImportedBill: vi.fn(), unarchiveImportedBill: vi.fn(), mergeImportedBills: vi.fn(), updateMultipleImportedBills: vi.fn() },
  useRecurringBills: { recurringBills: [], isLoading: false, addRecurringBill: vi.fn(), updateRecurringBill: vi.fn(), archiveRecurringBill: vi.fn(), unarchiveRecurringBill: vi.fn(), deleteRecurringBill: vi.fn(), updateRecurringBillDueDate: vi.fn() },
  useGroups: { groups: [], isLoading: false, addGroup: vi.fn(), updateGroup: vi.fn(), deleteGroup: vi.fn(), incrementGroupPopularity: vi.fn() },
  useCategories: { categories: [], isLoading: false, saveCategories: vi.fn(), deleteCategory: vi.fn() },
  useTheme: { theme: 'light' as const, setTheme: vi.fn(), isLoading: false },
  useAuth: { subscriptionStatus: 'subscribed' as const, isLoading: false, login: vi.fn(), selectFreeTier: vi.fn(), logout: vi.fn(), startTrial: vi.fn(), subscriptionDetails: null },
  usePwaInstall: { canInstall: false, promptInstall: vi.fn() },
  useAppControl: { showNotification: vi.fn(), reloadApp: vi.fn() },
  useRouting: { view: View.Dashboard, params: {}, navigate: vi.fn(), billConversionSource: undefined, recurringBillToEdit: undefined, fromTemplate: undefined, groupToEdit: undefined, currentGroup: undefined },
  useModalStates: { confirmation: null, setConfirmation: vi.fn(), settingsSection: null, setSettingsSection: vi.fn(), isCsvImporterOpen: false, setIsCsvImporterOpen: vi.fn(), isQrImporterOpen: false, setIsQrImporterOpen: vi.fn(), requestConfirmation: vi.fn(), showDebugConsole: false, toggleDebugConsole: vi.fn() },
  useDashboardState: {
    dashboardView: 'bills' as const,
    selectedParticipant: null,
    dashboardStatusFilter: 'active' as const,
    dashboardSummaryFilter: 'total' as const,
    budgetDate: 'last30days' as const,
    setBudgetDate: vi.fn(),
    onSetDashboardView: vi.fn(),
    setSelectedParticipant: mockSetSelectedParticipant,
    onSetDashboardStatusFilter: vi.fn(),
    onSetDashboardSummaryFilter: mockOnSetDashboardSummaryFilter,
    onSelectParticipant: vi.fn(),
    onClearParticipant: vi.fn(),
    dashboardLayoutMode: 'card' as const,
    onSetDashboardLayoutMode: vi.fn(),
  },
  useDerivedData: { participantsData: [], isLoading: false, budgetData: { totalBudget: 0, totalSpending: 0, spendingByCategory: {}, hasBudgetData: false } },
  useDataHandlers: {
    updateBill: vi.fn(),
    updateMultipleBills: vi.fn(),
    checkAndMakeSpaceForImageShare: vi.fn(),
    handleSaveBill: vi.fn(),
    handleSelectBillFromBudget: vi.fn() as (billInfo: { billId: string; isImported: boolean; }) => void,
    handleSaveRecurringBill: vi.fn(),
    handleUpdateRecurringBill: vi.fn(),
    handleSaveGroup: vi.fn(),
    handleUpdateGroup: vi.fn(),
    handleDeleteBill: vi.fn(),
    handleDeleteImportedBill: vi.fn(),
    handleDeleteRecurringBill: vi.fn(),
    handleDeleteGroup: vi.fn(),
    handleReshareBill: vi.fn(),
    createFromTemplate: vi.fn(),
  },
};

describe('useAppLogic hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default mock implementations for all hooks
    mocked(useSettings).mockReturnValue(defaultMocks.useSettings);
    mocked(useBills).mockReturnValue(defaultMocks.useBills);
    mocked(useImportedBills).mockReturnValue(defaultMocks.useImportedBills);
    mocked(useRecurringBills).mockReturnValue(defaultMocks.useRecurringBills);
    mocked(useGroups).mockReturnValue(defaultMocks.useGroups);
    mocked(useCategories).mockReturnValue(defaultMocks.useCategories);
    mocked(useTheme).mockReturnValue(defaultMocks.useTheme);
    mocked(useAuth).mockReturnValue(defaultMocks.useAuth);
    mocked(usePwaInstall).mockReturnValue(defaultMocks.usePwaInstall);
    mocked(useAppControl).mockReturnValue(defaultMocks.useAppControl);
    mocked(useRouting).mockReturnValue(defaultMocks.useRouting);
    mocked(useModalStates).mockReturnValue(defaultMocks.useModalStates);
    mocked(useDashboardState).mockReturnValue(defaultMocks.useDashboardState);
    mocked(useDerivedData).mockReturnValue(defaultMocks.useDerivedData);
    mocked(useSideEffects).mockImplementation(() => {});
    mocked(useDataHandlers).mockReturnValue(defaultMocks.useDataHandlers);
  });

  it('should reset dashboard filters when navigating away from the dashboard', () => {
    const { rerender } = renderHook(
      ({ view }: { view: View }) => {
        // Update the mock's return value for each render
        mocked(useRouting).mockReturnValue({
          ...defaultMocks.useRouting,
          view,
        });
        return useAppLogic();
      },
      { initialProps: { view: View.Dashboard } }
    );

    // Should not be called on initial render when view is Dashboard
    expect(mockSetSelectedParticipant).not.toHaveBeenCalled();
    expect(mockOnSetDashboardSummaryFilter).not.toHaveBeenCalled();

    // Rerender with a different view to trigger the effect
    rerender({ view: View.BillDetails });

    // The effect should now have fired
    expect(mockSetSelectedParticipant).toHaveBeenCalledWith(null);
    expect(mockOnSetDashboardSummaryFilter).toHaveBeenCalledWith('total');
  });

  it('should not reset dashboard filters when staying on the dashboard', () => {
    const { rerender } = renderHook(
      ({ view }: { view: View }) => {
        mocked(useRouting).mockReturnValue({ ...defaultMocks.useRouting, view });
        return useAppLogic();
      },
      { initialProps: { view: View.Dashboard } }
    );

    // Rerender with the same view
    rerender({ view: View.Dashboard });

    expect(mockSetSelectedParticipant).not.toHaveBeenCalled();
    expect(mockOnSetDashboardSummaryFilter).not.toHaveBeenCalled();
  });

  it('should derive currentBill correctly based on routing params', () => {
    const mockBills = [
      { id: 'bill-1', description: 'Bill One' },
      { id: 'bill-2', description: 'Bill Two' },
    ] as Bill[];

    const { result, rerender } = renderHook(
      ({ params }: { params: { billId?: string } }) => {
        mocked(useBills).mockReturnValue({ ...defaultMocks.useBills, bills: mockBills });
        mocked(useRouting).mockReturnValue({ ...defaultMocks.useRouting, params });
        return useAppLogic();
      },
      { initialProps: { params: { billId: 'bill-2' } } }
    );

    expect(result.current.currentBill).toBeDefined();
    expect(result.current.currentBill?.id).toBe('bill-2');

    rerender({ params: { billId: 'bill-1' } });
    expect(result.current.currentBill?.id).toBe('bill-1');

    rerender({ params: {} });
    expect(result.current.currentBill).toBeUndefined();
  });

  it('should derive currentImportedBill correctly based on routing params', () => {
    const mockImportedBills = [
      { id: 'imported-1', creatorName: 'Alice' },
      { id: 'imported-2', creatorName: 'Bob' },
    ] as ImportedBill[];

    const { result } = renderHook(
      ({ params }: { params?: { importedBillId?: string } }) => {
        mocked(useImportedBills).mockReturnValue({ ...defaultMocks.useImportedBills, importedBills: mockImportedBills });
        mocked(useRouting).mockReturnValue({ ...defaultMocks.useRouting, params });
        return useAppLogic();
      },
      { initialProps: { params: { importedBillId: 'imported-2' } } }
    );

    expect(result.current.currentImportedBill).toBeDefined();
    expect(result.current.currentImportedBill?.id).toBe('imported-2');
  });

  it('should return a composite object of all hook states and handlers', () => {
    const { result } = renderHook(() => useAppLogic());

    // Check a few properties from different hooks to ensure they are composed
    expect(result.current).toHaveProperty('settings', defaultMocks.useSettings.settings);
    expect(result.current).toHaveProperty('bills', defaultMocks.useBills.bills);
    expect(result.current).toHaveProperty('view', defaultMocks.useRouting.view);
    expect(result.current).toHaveProperty('dashboardView', defaultMocks.useDashboardState.dashboardView);
    expect(result.current).toHaveProperty('handleSaveBill'); // from useDataHandlers
    expect(result.current).toHaveProperty('requestConfirmation'); // from useModalStates
  });
});
