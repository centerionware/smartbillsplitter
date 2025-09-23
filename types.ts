export type SplitMode = 'equally' | 'amount' | 'percentage' | 'item';

export interface Participant {
  id: string;
  name: string;
  amountOwed: number;
  paid: boolean;
  splitValue?: number; // For storing default amounts/percentages in templates
}

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  assignedTo: string[]; // Array of participant IDs
}

export interface Bill {
  id:string;
  description: string;
  totalAmount: number;
  date: string;
  participants: Participant[];
  items?: ReceiptItem[];
  status: 'active' | 'archived';
  receiptImage?: string; // base64 data URL of the receipt
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // e.g., frequency: 'weekly' & interval: 2 means every 2 weeks.
  dayOfWeek?: number; // For weekly: 0=Sun, 1=Mon...
  dayOfMonth?: number; // For monthly: 1-31
}

export interface RecurringBill {
  id: string;
  description: string;
  participants: Participant[]; // Template participants. amountOwed will be 0, paid will be false. Can contain splitValue.
  items?: ReceiptItem[]; // Template items. price will be 0. Can contain assignedTo.
  status: 'active' | 'archived';
  recurrenceRule: RecurrenceRule;
  nextDueDate: string; // ISO string, calculated for sorting
  splitMode: SplitMode;
}

export interface PaymentDetails {
    venmo?: string;
    paypal?: string;
    cashApp?: string;
    zelle?: string;
    customMessage?: string;
}

export interface Settings {
    paymentDetails: PaymentDetails;
    myDisplayName: string;
    shareTemplate: string;
}

export type Theme = 'light' | 'dark' | 'system';

export enum View {
  Dashboard = 'DASHBOARD',
  CreateBill = 'CREATE_BILL',
  BillDetails = 'BILL_DETAILS',
  Settings = 'SETTINGS',
  Disclaimer = 'DISCLAIMER',
  Sync = 'SYNC',
  RecurringBills = 'RECURRING_BILLS',
}