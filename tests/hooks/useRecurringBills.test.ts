import { describe, it, expect } from 'vitest';
import { calculateNextDueDate } from '../../hooks/useRecurringBills';
import type { RecurrenceRule } from '../../types';

describe('recurringBills.calculateNextDueDate', () => {
    const fromDate = '2024-05-15T12:00:00.000Z'; // A Wednesday

    it('should calculate the next daily due date', () => {
        const rule: RecurrenceRule = { frequency: 'daily', interval: 1 };
        const nextDate = calculateNextDueDate(rule, fromDate);
        expect(new Date(nextDate).toISOString().split('T')[0]).toBe('2024-05-16');
    });
    
    it('should calculate the next daily due date with an interval', () => {
        const rule: RecurrenceRule = { frequency: 'daily', interval: 3 };
        const nextDate = calculateNextDueDate(rule, fromDate);
        expect(new Date(nextDate).toISOString().split('T')[0]).toBe('2024-05-18');
    });

    it('should calculate the next weekly due date', () => {
        const rule: RecurrenceRule = { frequency: 'weekly', interval: 1 };
        const nextDate = calculateNextDueDate(rule, fromDate);
        expect(new Date(nextDate).toISOString().split('T')[0]).toBe('2024-05-22'); // fromDate + 7 days
    });

    it('should calculate the next weekly due date with an interval', () => {
        const rule: RecurrenceRule = { frequency: 'weekly', interval: 2 };
        const nextDate = calculateNextDueDate(rule, fromDate);
        expect(new Date(nextDate).toISOString().split('T')[0]).toBe('2024-05-29'); // fromDate + 14 days
    });
    
    it('should calculate the next monthly due date', () => {
        const rule: RecurrenceRule = { frequency: 'monthly', interval: 1, dayOfMonth: 20 };
        const nextDate = calculateNextDueDate(rule, fromDate);
        expect(new Date(nextDate).toISOString().split('T')[0]).toBe('2024-06-20');
    });

    it('should handle end-of-month correctly for monthly recurrence', () => {
        const rule: RecurrenceRule = { frequency: 'monthly', interval: 1, dayOfMonth: 31 };
        const fromJan = '2024-01-31T12:00:00.000Z';
        const nextDate = calculateNextDueDate(rule, fromJan);
        expect(new Date(nextDate).toISOString().split('T')[0]).toBe('2024-02-29'); // Feb 2024 is a leap year
    });

    it('should calculate the next yearly due date', () => {
        const rule: RecurrenceRule = { frequency: 'yearly', interval: 1 };
        const nextDate = calculateNextDueDate(rule, fromDate);
        expect(new Date(nextDate).toISOString().split('T')[0]).toBe('2025-05-15');
    });
});
