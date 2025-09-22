export interface Participant {
  id: string;
  name: string;
  amountOwed: number;
  paid: boolean;
}

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  assignedTo: string[]; // Array of participant IDs
}

export interface Bill {
  id: string;
  description: string;
  totalAmount: number;
  date: string;
  participants: Participant[];
  items?: ReceiptItem[];
  status: 'active' | 'archived';
  receiptImage?: string; // base64 data URL of the receipt
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
}
