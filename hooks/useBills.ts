import { useState, useEffect, useCallback } from 'react';
import type { Bill } from '../types.ts';
import * as dbService from '../services/dbService.ts';

export const useBills = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  
  useEffect(() => {
    const loadBills = async () => {
      try {
        const storedBills = await dbService.getAllBills();
        setBills(storedBills);
      } catch (error) {
        console.error("Failed to load bills from IndexedDB:", error);
      }
    };
    loadBills();
  }, []);

  const addBill = useCallback(async (newBillData: Omit<Bill, 'id' | 'status'>) => {
    const newBill: Bill = {
      ...newBillData,
      id: new Date().getTime().toString(),
      status: 'active',
    };
    try {
      await dbService.addBill(newBill);
      setBills(prevBills => [newBill, ...prevBills]);
    } catch (error) {
      console.error("Failed to add bill:", error);
    }
  }, []);

  const updateBill = useCallback(async (updatedBill: Bill) => {
    try {
      await dbService.updateBill(updatedBill);
      setBills(prevBills =>
        prevBills.map(bill => (bill.id === updatedBill.id ? updatedBill : bill))
      );
    } catch (error) {
      console.error("Failed to update bill:", error);
    }
  }, []);

  const deleteBill = useCallback(async (billId: string) => {
    try {
      await dbService.deleteBill(billId);
      setBills(prevBills => prevBills.filter(bill => bill.id !== billId));
    } catch (error) {
      console.error("Failed to delete bill:", error);
    }
  }, []);

  const archiveBill = useCallback(async (billId: string) => {
    const billToUpdate = bills.find(b => b.id === billId);
    if (billToUpdate) {
      const updatedBill = { ...billToUpdate, status: 'archived' as const };
      await updateBill(updatedBill);
    }
  }, [bills, updateBill]);

  const unarchiveBill = useCallback(async (billId: string) => {
    const billToUpdate = bills.find(b => b.id === billId);
    if (billToUpdate) {
      const updatedBill = { ...billToUpdate, status: 'active' as const };
      await updateBill(updatedBill);
    }
  }, [bills, updateBill]);

  return { bills, addBill, updateBill, deleteBill, archiveBill, unarchiveBill };
};
