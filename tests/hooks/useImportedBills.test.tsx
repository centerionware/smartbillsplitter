import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useImportedBills } from '../../hooks/useImportedBills';
import { getImportedBills, mergeImportedBillsDB } from '../../services/db';
import { postMessage } from '../../services/broadcastService';
import type { ImportedBill } from '../../types';

// Mocks
vi.mock('../../services/db');
vi.mock('../../services/broadcastService');

// FIX: Expanded mock object to include all required properties of the ImportedBill type.
const mockInitialBills: ImportedBill[] = [
    {
        id: 'bill-1',
        creatorName: 'Test Creator',
        status: 'active',
        shareId: 'test-share-id',
        shareEncryptionKey: { kty: 'oct' },
        myParticipantId: 'p1',
        lastUpdatedAt: 1000,
        localStatus: { myPortionPaid: false },
        sharedData: { bill: { description: 'Initial' } } as any,
    } as ImportedBill
];

describe('useImportedBills hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getImportedBills).mockResolvedValue([...mockInitialBills]);
    });

    it('should load initial bills', async () => {
        const { result } = renderHook(() => useImportedBills());
        await act(async () => {}); // Let promises resolve
        expect(result.current.importedBills).toEqual(mockInitialBills);
    });

    it('updateMultipleImportedBills should directly update state and call DB merge', async () => {
        const { result } = renderHook(() => useImportedBills());
        await act(async () => {}); // Initial load

        // FIX: Spread the complete initial mock bill to ensure all required properties are present on the updated object.
        const updatedBill: ImportedBill = {
            ...mockInitialBills[0],
            lastUpdatedAt: 2000,
            localStatus: { myPortionPaid: true }, // The new state from polling service
            sharedData: { bill: { description: 'Updated' } } as any, // Add some data to see change
        };

        const billsToUpdate = [updatedBill];
        
        await act(async () => {
            await result.current.updateMultipleImportedBills(billsToUpdate);
        });

        // 1. Assert DB function was called correctly
        expect(mergeImportedBillsDB).toHaveBeenCalledWith([], billsToUpdate);

        // 2. Assert broadcast was sent
        expect(postMessage).toHaveBeenCalledWith({ type: 'imported-bills-updated' });

        // 3. Assert the hook's state reflects the *exact* data passed in,
        //    proving no extra client-side recalculation was done.
        expect(result.current.importedBills).toHaveLength(1);
        expect(result.current.importedBills[0].localStatus.myPortionPaid).toBe(true);
        expect(result.current.importedBills[0].lastUpdatedAt).toBe(2000);
        expect(result.current.importedBills[0].sharedData.bill.description).toBe('Updated');
    });
});