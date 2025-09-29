
export interface Participant {
  id: string;
  name: string;
  amountOwed: number;
  paid: boolean;
  splitValue?: number;
  phone?: string;
  email?: string;
}

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  assignedTo: string[];
  originalBillData?: Bill;
}

export type SplitMode = 'equally' | 'amount' | 'percentage' | 'item';

export interface ShareInfo {
  shareId: string;
  encryptionKey: JsonWebKey;
  signingPublicKey: JsonWebKey;
}

export interface ParticipantShareInfo {
  keyId: string;
  fragmentKey: JsonWebKey;
  expires: number;
}

export interface Bill {
  id: string;
  description: string;
  totalAmount: number;
  date: string; // ISO 8601 format
  participants: Participant[];
  status: 'active' | 'archived';
  items?: ReceiptItem[];
  receiptImage?: string;
  additionalInfo?: Record<string, string>;
  lastUpdatedAt?: number;
  shareInfo?: ShareInfo;
  participantShareInfo?: Record<string, ParticipantShareInfo>;
  shareStatus?: 'live' | 'expired' | 'error';
}

export interface RecurrenceRule {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    dayOfWeek?: number; // 0 (Sun) to 6 (Sat)
    dayOfMonth?: number; // 1 to 31
}

export interface RecurringBill extends Omit<Bill, 'id' | 'status' | 'date'> {
    id: string;
    status: 'active' | 'archived';
    nextDueDate: string; // ISO 8601 format
    recurrenceRule: RecurrenceRule;
    splitMode: SplitMode;
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

export type Theme = 'light' | 'dark' | 'system';

export enum View {
  Dashboard = 'dashboard',
  CreateBill = 'create-bill',
  BillDetails = 'bill-details',
  Settings = 'settings',
  Sync = 'sync',
  Disclaimer = 'disclaimer',
  ViewShared = 'view-bill',
  RecurringBills = 'recurring-bills',
  ImportedBillDetails = 'imported-bill-details',
  ManageSubscription = 'manage-subscription',
}

export type SummaryFilter = 'total' | 'othersOweMe' | 'iOwe';

export type DashboardView = 'bills' | 'participants' | 'upcoming' | 'templates';

export interface ConstituentShareInfo {
    originalBillId: string;
    shareId: string;
    publicKey: JsonWebKey;
    encryptionKey: JsonWebKey;
}

export interface SharedBillPayload {
    bill: Bill;
    creatorName: string;
    publicKey: JsonWebKey;
    signature: string;
    paymentDetails: PaymentDetails;
    constituentShares?: ConstituentShareInfo[];
}

export interface ImportedBill {
    id: string;
    creatorName: string;
    status: 'active' | 'archived';
    sharedData: {
        bill: Bill;
        creatorPublicKey: JsonWebKey;
        signature: string;
        paymentDetails: PaymentDetails;
    };
    shareId: string;
    shareEncryptionKey: JsonWebKey;
    constituentShares?: ConstituentShareInfo[];
    lastUpdatedAt: number;
    myParticipantId: string;
    localStatus: {
        myPortionPaid: boolean;
        paidItems?: Record<string, boolean>; // key is item.id
    };
    liveStatus?: 'live' | 'stale' | 'error';
}

export interface RequestConfirmationFn {
  (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      confirmText?: string;
      cancelText?: string;
      confirmVariant?: 'danger' | 'primary';
      onCancel?: () => void;
    }
  ): void;
}

export interface PayPalSubscriptionDetails {
    id: string;
    status: 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'EXPIRED';
    plan: 'monthly' | 'yearly' | 'unknown';
    startTime: string; // ISO 8601
    isCurrentDevice: boolean;
}

export type SettingsSection = 'personalization' | 'payments' | 'reminders' | 'data' | 'sync' | 'subscription' | 'danger';