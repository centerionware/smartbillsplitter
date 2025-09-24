export enum View {
  Dashboard = 'dashboard',
  CreateBill = 'createBill',
  BillDetails = 'billDetails',
  ImportedBillDetails = 'importedBillDetails',
  Settings = 'settings',
  Sync = 'sync',
  Disclaimer = 'disclaimer',
  RecurringBills = 'recurringBills',
  ViewSharedBill = 'viewSharedBill',
}

export type Theme = 'light' | 'dark' | 'system';

export type SplitMode = 'equally' | 'amount' | 'percentage' | 'item';

export interface Participant {
  id: string;
  name: string;
  amountOwed: number;
  paid: boolean;
  splitValue?: number; // Used for amount/percentage splits in CreateBill
}

export interface ReceiptItem {
  id:string;
  name: string;
  price: number;
  assignedTo: string[]; // array of participant ids
}

export interface Bill {
  id: string;
  description: string;
  totalAmount: number;
  date: string; // ISO string
  participants: Participant[];
  status: 'active' | 'archived';
  items?: ReceiptItem[];
  receiptImage?: string; // base64 data url
  additionalInfo?: Record<string, string>;
  shareInfo?: {
    shareId: string;
    encryptionKey: JsonWebKey;
    expiresAt: number; // Timestamp
  };
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  dayOfWeek?: number; // 0 (Sun) to 6 (Sat)
  dayOfMonth?: number; // 1 to 31
}

export interface RecurringBill {
    id: string;
    description: string;
    totalAmount?: number; // Optional for templates
    participants: Participant[];
    status: 'active' | 'archived';
    items?: ReceiptItem[]; 
    additionalInfo?: Record<string, string>;
    splitMode: SplitMode;
    recurrenceRule: RecurrenceRule;
    nextDueDate: string; // ISO string
}

export interface PaymentDetails {
  venmo: string;
  paypal: string;
  cashApp: string;
  zelle: string;
  customMessage: string;
}

export interface Settings {
  myDisplayName: string;
  paymentDetails: PaymentDetails;
  shareTemplate: string;
  notificationsEnabled: boolean;
  notificationDays: number;
}

// For sharing bills
export interface SharedBillPayload {
  bill: Bill;
  creatorName: string;
  publicKey: JsonWebKey; // Public key of the creator for signature verification
  signature: string; // Signature of the bill data
}

// For bills imported from other users
export interface ImportedBill {
  id: string; // This will be the same as the original bill.id
  creatorName: string;
  status: 'active' | 'archived';
  sharedData: {
    bill: Bill;
    creatorPublicKey: JsonWebKey;
    signature: string;
  };
  shareId: string; // The ID from the /share/:shareId endpoint
  shareEncryptionKey: JsonWebKey; // The symmetric key used to decrypt this bill
  lastUpdatedAt: number; // Timestamp of the last successful fetch
  localStatus: {
    myPortionPaid: boolean;
  };
}