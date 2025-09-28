import { useState, useEffect, useCallback } from 'react';
import type { Bill } from '../types.ts';
import { getBills, addBill as addBillDB, updateBill as updateBillDB, deleteBillDB, deleteBillSigningKeyDB, addMultipleBillsDB } from '../services/db.ts';

const initialBills: Bill[] = [
  {
    id: '1',
    description: 'Team Lunch at The Daily Grill',
    totalAmount: 145.50,
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    participants: [
      { id: 'p1', name: 'Alice', amountOwed: 48.50, paid: true },
      { id: 'p2', name: 'Bob', amountOwed: 48.50, paid: false },
      { id: 'p3', name: 'Charlie', amountOwed: 48.50, paid: true },
    ],
    status: 'active',
  },
  {
    id: '2',
    description: 'Groceries for the week',
    totalAmount: 92.75,
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    participants: [
      { id: 'p4', name: 'David', amountOwed: 46.38, paid: false },
      { id: 'p5', name: 'Eve', amountOwed: 46.37, paid: false },
    ],
    status: 'active',
  },
];

export const useBills = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBills = async () => {
      try {
        setIsLoading(true);
        let dbBills = await getBills();
        
        // If the database is empty, seed it with initial data.
        if (dbBills.length === 0) {
          await Promise.all(initialBills.map(bill => addBillDB(bill)));
          dbBills = initialBills;
        }

        // Sort bills by date descending before setting state
        dbBills.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setBills(dbBills);
      } catch (err) {
        console.error("Failed to load bills from IndexedDB:", err);
        setError("Could not load bill data.");
      } finally {
        setIsLoading(false);
      }
    };

    loadBills();
  }, []);
  
  const sortAndSetBills = (newBills: Bill[]) => {
      newBills.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setBills(newBills);
  }

  const addBill = useCallback(async (newBillData: Omit<Bill, 'id' | 'status'>) => {
    const newBill: Bill = {
      ...newBillData,
      id: new Date().getTime().toString(),
      status: 'active',
    };
    await addBillDB(newBill);
    setBills(prevBills => {
        const updated = [newBill, ...prevBills];
        updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return updated;
    });
  }, []);

  const addMultipleBills = useCallback(async (billsData: Omit<Bill, 'id' | 'status'>[]) => {
    const newBills: Bill[] = billsData.map((billData, index) => ({
      ...billData,
      id: `bill-${Date.now()}-${index}`,
      status: 'active',
    }));

    if (newBills.length > 0) {
      await addMultipleBillsDB(newBills);
      setBills(prevBills => {
          const updated = [...newBills, ...prevBills];
          updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          return updated;
      });
    }
    return newBills;
  }, []);

  const updateBill = useCallback(async (updatedBill: Bill) => {
    await updateBillDB(updatedBill);
    setBills(prevBills =>
      prevBills.map(bill => (bill.id === updatedBill.id ? updatedBill : bill))
    );
  }, []);

  const updateMultipleBills = useCallback(async (billsToUpdate: Bill[]) => {
    // A transaction would be more robust, but for simplicity we await all promises.
    await Promise.all(billsToUpdate.map(bill => updateBillDB(bill)));

    setBills(prevBills => {
        const updatedBillsMap = new Map(billsToUpdate.map(b => [b.id, b]));
        return prevBills.map(bill => updatedBillsMap.get(bill.id) || bill);
    });
  }, []);

  const deleteBill = useCallback(async (billId: string) => {
    await deleteBillDB(billId);
    await deleteBillSigningKeyDB(billId); // Also delete the associated signing key
    setBills(prevBills => prevBills.filter(bill => bill.id !== billId));
  }, []);

  const archiveBill = useCallback(async (billId: string) => {
    const billToArchive = bills.find(b => b.id === billId);
    if (billToArchive) {
      const updatedBill = { ...billToArchive, status: 'archived' as const };
      await updateBillDB(updatedBill);
      setBills(prevBills =>
        prevBills.map(bill => (bill.id === billId ? updatedBill : bill))
      );
    }
  }, [bills]);

  const unarchiveBill = useCallback(async (billId: string) => {
    const billToUnarchive = bills.find(b => b.id === billId);
    if (billToUnarchive) {
      const updatedBill = { ...billToUnarchive, status: 'active' as const };
      await updateBillDB(updatedBill);
      setBills(prevBills =>
        prevBills.map(bill => (bill.id === billId ? updatedBill : bill))
      );
    }
  }, [bills]);

  return { bills, addBill, addMultipleBills, updateBill, deleteBill, archiveBill, unarchiveBill, updateMultipleBills, isLoading, error };
};