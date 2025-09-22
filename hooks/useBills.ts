import { useState, useEffect } from 'react';
import type { Bill } from '../types.ts';

const STORAGE_KEY = 'smart-bill-splitter-bills';

const initialBills: Omit<Bill, 'status'>[] = [
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
  },
];

// Function to safely load bills from localStorage
const loadBillsFromStorage = (): Bill[] => {
  try {
    const storedBills = localStorage.getItem(STORAGE_KEY);
    if (storedBills) {
      const parsedBills = JSON.parse(storedBills);
      // Migration step: ensure all bills have a status for backward compatibility
      return parsedBills.map((bill: any) => ({
        ...bill,
        status: bill.status || 'active',
      }));
    }
  } catch (error) {
    console.error("Failed to parse bills from localStorage:", error);
  }
  // If nothing is in storage or parsing fails, return initial bills
  // with status and save them to storage for the next time.
  const billsWithStatus = initialBills.map(b => ({ ...b, status: 'active' as const }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(billsWithStatus));
  return billsWithStatus;
};


export const useBills = () => {
  const [bills, setBills] = useState<Bill[]>(loadBillsFromStorage);

  // Effect to save bills to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
    } catch (error) {
      console.error("Failed to save bills to localStorage:", error);
    }
  }, [bills]);

  const addBill = (newBillData: Omit<Bill, 'id' | 'status'>) => {
    const newBill: Bill = {
      ...newBillData,
      id: new Date().getTime().toString(),
      status: 'active',
    };
    setBills(prevBills => [newBill, ...prevBills]);
  };

  const updateBill = (updatedBill: Bill) => {
    setBills(prevBills =>
      prevBills.map(bill => (bill.id === updatedBill.id ? updatedBill : bill))
    );
  };

  const deleteBill = (billId: string) => {
    setBills(prevBills => prevBills.filter(bill => bill.id !== billId));
  };

  const archiveBill = (billId: string) => {
    setBills(prevBills =>
      prevBills.map(bill => (bill.id === billId ? { ...bill, status: 'archived' } : bill))
    );
  };

  const unarchiveBill = (billId: string) => {
    setBills(prevBills =>
      prevBills.map(bill => (bill.id === billId ? { ...bill, status: 'active' } : bill))
    );
  };

  return { bills, addBill, updateBill, deleteBill, archiveBill, unarchiveBill };
};