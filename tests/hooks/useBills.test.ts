import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBills } from '../../hooks/useBills';
import type { Bill } from '../../types';

// FIX: Added direct imports for mocked functions. `vi.mock` hoists and replaces these modules, so the imports will refer to the mocks.
import { getBills, addBill as addBillDB, updateBill as updateBillDB, deleteBillDB, addMultipleBillsDB, mergeBillsDB } from '../../services/db';
import { postMessage, useBroadcastListener } from '../../services/broadcastService';

// Mock dependencies
vi.mock('../../services/db', () => ({
  getBills: vi.fn(),
  addBill: vi.fn(),
  updateBill: vi.fn(),
  deleteBillDB: vi.fn(),
  addMultipleBillsDB: vi.fn(),
  mergeBillsDB: vi.fn(),
}));
vi.mock('../../services/broadcastService', () => ({
  postMessage: vi.fn(),
  useBroadcastListener: vi.fn(),
}));

// Use distinct dates to ensure predictable sorting. 'Groceries' is newer and should appear first.
const mockBills: Bill[] = [
  { id: '1', description: 'Groceries', totalAmount: 100, date: new Date('2024-05-21T12:00:00Z').toISOString(), participants: [], status: 'active' },
  { id: '2', description: 'Dinner', totalAmount: 50, date: new Date('2024-05-20T12:00:00Z').toISOString(), participants: [], status: 'active' },
];

describe('useBills hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load bills on initial render', async () => {
    vi.mocked(getBills).mockResolvedValue([...mockBills]);
    const { result } = renderHook(() => useBills());

    expect(result.current.isLoading).toBe(true);

    await act(async () => {}); // Wait for promises to resolve

    expect(result.current.isLoading).toBe(false);
    expect(result.current.bills).toHaveLength(2);
    expect(result.current.bills[0].description).toBe('Groceries');
  });

  it('should create default bills on first launch if DB is empty', async () => {
    vi.mocked(getBills).mockResolvedValue([]);
    localStorage.removeItem('sharedbills.defaultDataLoaded');
    
    const { result } = renderHook(() => useBills());

    await act(async () => {});

    expect(addMultipleBillsDB).toHaveBeenCalled();
    expect(result.current.bills.length).toBeGreaterThan(0);
    expect(localStorage.getItem('sharedbills.defaultDataLoaded')).toBe('true');
  });

  it('should add a new bill', async () => {
    vi.mocked(getBills).mockResolvedValue([...mockBills]);
    const { result } = renderHook(() => useBills());
    await act(async () => {}); // Initial load

    const newBillData = { description: 'Movies', totalAmount: 30, date: new Date().toISOString(), participants: [] };
    
    // Simulating the bill being added to the DB for the next load
    const updatedBillList = [...mockBills, { ...newBillData, id: '3', status: 'active', lastUpdatedAt: Date.now() }];
    vi.mocked(getBills).mockResolvedValue(updatedBillList);

    await act(async () => {
      await result.current.addBill(newBillData);
    });
    
    // The hook updates its internal state directly before the broadcast/reload happens
    expect(result.current.bills.find(b => b.description === 'Movies')).toBeDefined();
    expect(addBillDB).toHaveBeenCalledWith(expect.objectContaining(newBillData));
    expect(postMessage).toHaveBeenCalledWith({ type: 'bills-updated' });
    expect(result.current.bills).toHaveLength(3);
  });

  it('should update an existing bill', async () => {
    vi.mocked(getBills).mockResolvedValue([...mockBills]);
    const { result } = renderHook(() => useBills());
    await act(async () => {});

    const billToUpdate = { ...mockBills[0], totalAmount: 150 };

    await act(async () => {
      await result.current.updateBill(billToUpdate);
    });

    expect(updateBillDB).toHaveBeenCalledWith(expect.objectContaining({ ...billToUpdate, lastUpdatedAt: expect.any(Number) }));
    // Broadcasting is now handled by a higher-level hook, so this should not be called here.
    // expect(postMessage).toHaveBeenCalledWith({ type: 'bills-updated' });
    const updatedBillInState = result.current.bills.find(b => b.id === '1');
    expect(updatedBillInState?.totalAmount).toBe(150);
  });

  it('should delete a bill', async () => {
    vi.mocked(getBills).mockResolvedValue([...mockBills]);
    const { result } = renderHook(() => useBills());
    await act(async () => {});
    
    // After deleting bill '1', only bill '2' should remain.
    const remainingBills = mockBills.filter(b => b.id !== '1');
    vi.mocked(getBills).mockResolvedValue(remainingBills);

    await act(async () => {
      await result.current.deleteBill('1');
    });

    expect(deleteBillDB).toHaveBeenCalledWith('1');
    expect(postMessage).toHaveBeenCalledWith({ type: 'bills-updated' });
    expect(result.current.bills).toHaveLength(1);
    expect(result.current.bills[0].id).toBe('2');
  });
});