import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBills } from '../../hooks/useBills';
import type { Bill } from '../../types';

// FIX: Added direct imports for mocked functions. `vi.mock` hoists and replaces these modules, so the imports will refer to the mocks.
import { getBills, addBill, updateBill, deleteBillDB, addMultipleBillsDB } from '../../services/db';
import { postMessage } from '../../services/broadcastService';

// Mock dependencies
vi.mock('../../services/db', () => ({
  getBills: vi.fn(),
  addBill: vi.fn(),
  updateBill: vi.fn(),
  deleteBillDB: vi.fn(),
  addMultipleBillsDB: vi.fn(),
}));
vi.mock('../../services/broadcastService', () => ({
  postMessage: vi.fn(),
  useBroadcastListener: vi.fn(),
}));

const mockBills: Bill[] = [
  { id: '1', description: 'Groceries', totalAmount: 100, date: new Date().toISOString(), participants: [], status: 'active' },
  { id: '2', description: 'Dinner', totalAmount: 50, date: new Date().toISOString(), participants: [], status: 'active' },
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
    
    vi.mocked(getBills).mockResolvedValue([...mockBills, { ...newBillData, id: '3', status: 'active' }]);

    await act(async () => {
      await result.current.addBill(newBillData);
    });

    expect(addBill).toHaveBeenCalledWith(expect.objectContaining(newBillData));
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

    expect(updateBill).toHaveBeenCalledWith(expect.objectContaining({ ...billToUpdate, lastUpdatedAt: expect.any(Number) }));
    expect(postMessage).toHaveBeenCalledWith({ type: 'bills-updated' });
  });

  it('should delete a bill', async () => {
    vi.mocked(getBills).mockResolvedValue([...mockBills]);
    const { result } = renderHook(() => useBills());
    await act(async () => {});
    
    vi.mocked(getBills).mockResolvedValue([mockBills[1]]);

    await act(async () => {
      await result.current.deleteBill('1');
    });

    expect(deleteBillDB).toHaveBeenCalledWith('1');
    expect(postMessage).toHaveBeenCalledWith({ type: 'bills-updated' });
    expect(result.current.bills).toHaveLength(1);
    expect(result.current.bills[0].id).toBe('2');
  });
});