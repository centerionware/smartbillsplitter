import type { Bill } from '../types.ts';

// Helper function to trigger a file download in the browser
const downloadFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Define the Exporter interface
export interface Exporter {
  name: string; // e.g., "CSV (Comma-Separated)"
  format: 'csv' | 'quickbooks-csv'; // A unique key for the format
  mimeType: string;
  fileExtension: string;
  export: (bill: Bill) => void;
}

// --- CSV Exporter Implementation ---
const toCsv = (bill: Bill): string => {
  const headers = ['Participant Name', 'Amount Owed', 'Paid Status', 'Description', 'Date', 'Total Amount'];
  const rows = bill.participants.map(p => 
    [
      `"${p.name}"`,
      p.amountOwed.toFixed(2),
      p.paid ? 'Paid' : 'Unpaid',
      `"${bill.description}"`,
      bill.date,
      bill.totalAmount.toFixed(2)
    ].join(',')
  );
  return [headers.join(','), ...rows].join('\n');
};

const csvExporter: Exporter = {
  name: 'Standard CSV',
  format: 'csv',
  mimeType: 'text/csv;charset=utf-8;',
  fileExtension: 'csv',
  export: (bill: Bill) => {
    const csvContent = toCsv(bill);
    const filename = `${bill.description.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${bill.id}.csv`;
    downloadFile(filename, csvContent, csvExporter.mimeType);
  }
};


// --- QuickBooks CSV Exporter Implementation ---
// QuickBooks (Online) CSV format for bank transactions is typically: Date, Description, Amount
// We can format it as a series of expenses, one per participant.
const toQuickBooksCsv = (bill: Bill): string => {
  const headers = ['Date', 'Description', 'Amount'];
  // Negative amounts represent money spent
  const rows = bill.participants.map(p => 
    [
      new Date(bill.date).toLocaleDateString('en-US'), // Format like MM/DD/YYYY
      `"${bill.description} - ${p.name}"`,
      `-${p.amountOwed.toFixed(2)}`
    ].join(',')
  );
  return [headers.join(','), ...rows].join('\n');
};

const quickbooksCsvExporter: Exporter = {
  name: 'QuickBooks (CSV)',
  format: 'quickbooks-csv',
  mimeType: 'text/csv;charset=utf-8;',
  fileExtension: 'csv',
  export: (bill: Bill) => {
    const csvContent = toQuickBooksCsv(bill);
    const filename = `quickbooks_${bill.description.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${bill.id}.csv`;
    downloadFile(filename, csvContent, quickbooksCsvExporter.mimeType);
  }
};


// --- Exporter Registry ---
export const availableExporters: Exporter[] = [
  csvExporter,
  quickbooksCsvExporter,
];
