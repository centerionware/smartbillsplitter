import { IncomingHttpHeaders } from "http";

// FIX: Defined ParticipantShareInfo interface and removed circular self-import.
export interface ParticipantShareInfo {
  keyId: string;
  fragmentKey: JsonWebKey;
  expires: number;
}

// FIX: Moved confirmation dialog types from App.tsx to centralize them.
export type RequestConfirmationOptions = {
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary';
  onCancel?: () => void;
};

export type RequestConfirmationFn = (
  title: string,
  message: string,
  onConfirm: () => void,
  options?: RequestConfirmationOptions
) => void;

// FIX: Removed self-import of 'Participant' which was causing a declaration conflict.
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
  ManageSubscriptionPage = 'manageSubscriptionPage',
}

export type Theme = 'light' | 'dark' | 'system';

export type SummaryFilter = 'total' | 'othersOweMe' | 'iOwe';

export type SplitMode = 'equally' | 'amount' | 'percentage' | 'item';

export interface Participant {
  id: string;
  name: string;
  amountOwed: number;
  paid: boolean;
  splitValue?: number; // Used for amount/percentage splits in CreateBill
  phone?: string;
  email?: string;
}

export interface ReceiptItem {
  id:string;
  name: string;
  price: number;
  assignedTo: string[]; // array of participant ids
  originalBillData?: Bill;
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
    signingPublicKey: JsonWebKey; // Public key for this specific bill's signing pair
  };
  participantShareInfo?: Record<string, ParticipantShareInfo>; // Map participant.id -> share info
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
export interface ConstituentShareInfo {
  originalBillId: string;
  shareId: string;
  publicKey: JsonWebKey;
  encryptionKey: JsonWebKey;
}

export interface SharedBillPayload {
  bill: Bill;
  creatorName: string;
  publicKey: JsonWebKey; // Public key of the creator for signature verification
  signature: string; // Signature of the bill data
  paymentDetails: PaymentDetails; // Creator's payment info
  constituentShares?: ConstituentShareInfo[]; // For summary bills
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
    paymentDetails: PaymentDetails;
  };
  shareId: string; // The ID from the /share/:shareId endpoint
  shareEncryptionKey?: JsonWebKey; // The symmetric key for decrypting this bill, now stored by the recipient
  constituentShares?: ConstituentShareInfo[]; // For summary bills, to enable live updates
  lastUpdatedAt: number; // Timestamp of the last successful fetch
  myParticipantId: string; // The ID of the participant who is the local user
  localStatus: {
    myPortionPaid: boolean;
    paidItems?: Record<string, boolean>; // For summary bills, track individual item paid status
  };
  liveStatus?: 'live' | 'expired';
}

// For managing multiple PayPal subscriptions
export interface PayPalSubscriptionDetails {
  id: string; // The PayPal Subscription ID (I-...)
  status: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'EXPIRED' | string;
  plan: 'monthly' | 'yearly' | 'unknown';
  startTime: string; // ISO string date
  isCurrentDevice: boolean; // Is this the subscription for the current device?
}