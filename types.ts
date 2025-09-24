export type Theme = 'light' | 'dark' | 'system';

export enum View {
  Dashboard = 'DASHBOARD',
  CreateBill = 'CREATE_BILL',
  BillDetails = 'BILL_DETAILS',
  Settings = 'SETTINGS',
  Sync = 'SYNC',
  Disclaimer = 'DISCLAIMER',
  RecurringBills = 'RECURRING_BILLS',
  ViewSharedBill = 'VIEW_SHARED_BILL',
}

export interface Participant {
  id: string;
  name: string;
  amountOwed: number;
  paid: boolean;
  splitValue?: number; // Used for amount/percentage split modes during creation
}

export interface ReceiptItem {
  id: string;
  name:string;
  price: number;
  assignedTo: string[]; // array of participant IDs
}

export interface Bill {
  id: string;
  description: string;
  totalAmount: number;
  date: string; // ISO string
  participants: Participant[];
  status: 'active' | 'archived';
  items?: ReceiptItem[];
  receiptImage?: string; // base64 data URL
  additionalInfo?: Record<string, string>;
}

export type SplitMode = 'equally' | 'amount' | 'percentage' | 'item';

export interface RecurrenceRule {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    dayOfWeek?: number; // 0 for Sunday, 6 for Saturday
    dayOfMonth?: number; // 1-31
}

// A template for creating bills that recur.
export interface RecurringBill {
    id: string;
    description: string;
    totalAmount?: number; // Optional, can be filled in when creating the bill.
    // Participants are stored with default values that are recalculated on creation.
    participants: Participant[];
    // Items can have a price of 0 if it varies each time.
    items?: ReceiptItem[];
    splitMode: SplitMode;
    recurrenceRule: RecurrenceRule;
    nextDueDate: string; // ISO string for the next time a bill should be generated.
    status: 'active' | 'archived';
    additionalInfo?: Record<string, string>;
}

export interface PaymentDetails {
  venmo: string;
  paypal: string;
  cashApp: string;
  zelle: string;
  customMessage: string;
}

export interface Settings {
  paymentDetails: PaymentDetails;
  myDisplayName: string;
  shareTemplate: string;
  notificationsEnabled: boolean;
  notificationDays: number;
}

// For sharing bills end-to-end encrypted
export interface SharedBillPayload {
    bill: Bill;
    publicKey: JsonWebKey; // Creator's public key for signature verification
    signature: string; // Signature of the bill data
}

export interface ImportedBill {
    id: string; // This will be the original bill ID from the creator
    creatorName: string; // The display name of the person who shared the bill.
    status: 'active' | 'archived'; // Local status (archived by receiver)
    sharedData: {
        bill: Bill;
        creatorPublicKey: JsonWebKey; // The public key of the person who shared the bill
        signature: string;
    };
    shareId: string; // The ID for the share session on the server
    shareEncryptionKey: JsonWebKey; // The symmetric key to decrypt updates
    lastUpdatedAt: number; // Timestamp of the last data fetch
    localStatus: {
        myPortionPaid: boolean;
    };
}
