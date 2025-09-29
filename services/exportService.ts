import type { Bill, ImportedBill } from '../types.ts';
import { getBillSigningKey } from './db.ts';
import * as cryptoService from './cryptoService.ts';

// New header to identify our own CSV format
export const EXPORT_HEADER_V2 = '# SharedBills CSV Export v2';

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

const CSV_HEADERS_V2 = [
    'RowType', 'BillID', 'BillType', 'Description', 'Date', 'TotalAmount', 
    'CreatorName', 'ParticipantID', 'ParticipantName', 'AmountOwed', 'PaidStatus', 
    'ShareInfoJSON', 'LastUpdatedAt'
];

// Helper to safely stringify and quote JSON for CSV, handling nested quotes.
const csvJson = (data: any): string => {
    if (data === null || data === undefined) return '""';
    try {
        const json = JSON.stringify(data);
        return `"${json.replace(/"/g, '""')}"`;
    } catch {
        return '""';
    }
};

const sanitize = (str: string | null | undefined): string => `"${(str || '').replace(/"/g, '""')}"`;

/**
 * The primary export function that generates a V2 CSV from provided bills.
 * @param data An object containing optional arrays of owned and imported bills.
 * @param filename The desired name for the downloaded file.
 */
export const exportData = async (
    data: { owned?: Bill[], imported?: ImportedBill[] },
    filename: string
) => {
    const { owned = [], imported = [] } = data;
    const csvRows: string[] = [];
    csvRows.push(CSV_HEADERS_V2.join(','));

    // Process owned bills
    for (const bill of owned) {
        let shareInfo: Record<string, any> = {};
        if (bill.shareInfo?.shareId) {
            const signingKeyRecord = await getBillSigningKey(bill.id);
            if (signingKeyRecord?.privateKey) {
                const privateKeyJwk = await cryptoService.exportKey(signingKeyRecord.privateKey);
                shareInfo = {
                    shareId: bill.shareInfo.shareId,
                    encryptionKey: bill.shareInfo.encryptionKey,
                    signingPublicKey: bill.shareInfo.signingPublicKey,
                    signingPrivateKey: privateKeyJwk,
                };
            }
        }
        const shareInfoJson = csvJson(shareInfo);
        const billRow = ['BILL', bill.id, 'OWNED', sanitize(bill.description), bill.date, bill.totalAmount.toFixed(2),'', '', '', '', '', shareInfoJson, bill.lastUpdatedAt || 0].join(',');
        csvRows.push(billRow);

        for (const p of bill.participants) {
            const participantRow = ['PARTICIPANT', bill.id, 'OWNED', '', '', '', '', p.id, sanitize(p.name), p.amountOwed.toFixed(2), p.paid ? 'Paid' : 'Unpaid', '', ''].join(',');
            csvRows.push(participantRow);
        }
    }

    // Process imported bills
    for (const iBill of imported) {
        const shareInfoJson = csvJson({
            shareId: iBill.shareId,
            shareEncryptionKey: iBill.shareEncryptionKey,
            creatorPublicKey: iBill.sharedData.creatorPublicKey,
            myParticipantId: iBill.myParticipantId,
        });
        
        const billRow = ['BILL', iBill.id, 'IMPORTED', sanitize(iBill.sharedData.bill.description), iBill.sharedData.bill.date, iBill.sharedData.bill.totalAmount.toFixed(2), sanitize(iBill.creatorName), '', '', '', '', shareInfoJson, iBill.lastUpdatedAt].join(',');
        csvRows.push(billRow);

        for (const p of iBill.sharedData.bill.participants) {
            let paidStatus = p.paid ? 'Paid' : 'Unpaid';
            if (p.id === iBill.myParticipantId) {
                paidStatus = iBill.localStatus.myPortionPaid ? 'Paid' : 'Unpaid';
            }
            const participantRow = ['PARTICIPANT', iBill.id, 'IMPORTED', '', '', '', sanitize(iBill.creatorName), p.id, sanitize(p.name), p.amountOwed.toFixed(2), paidStatus, '', ''].join(',');
            csvRows.push(participantRow);
        }
    }
    
    const csvContent = [EXPORT_HEADER_V2, ...csvRows].join('\n');
    downloadFile(filename, csvContent, 'text/csv;charset=utf-8;');
};