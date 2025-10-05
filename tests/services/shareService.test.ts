import { describe, it, expect } from 'vitest';
import { generateShareText } from '../../services/shareService';
import type { Settings } from '../../types';
import type { SubscriptionStatus } from '../../hooks/useAuth';

describe('shareService.generateShareText', () => {
    const participantName = 'Alex';
    const totalOwed = 12.50;
    const billsInfo = [
        { description: 'Lunch', amountOwed: 7.50 },
        { description: 'Coffee', amountOwed: 5.00 },
    ];

    const baseSettings: Settings = {
        myDisplayName: 'Me',
        shareTemplate: 'Hi {participantName}, you owe {totalOwed}.\nBills:\n{billList}{paymentInfo}{promoText}',
        paymentDetails: { venmo: '', paypal: '', cashApp: '', zelle: '', customMessage: '' },
        notificationsEnabled: false,
        notificationDays: 3,
    };

    it('should generate a basic share text', () => {
        const result = generateShareText(participantName, totalOwed, billsInfo, baseSettings, 'subscribed');
        expect(result).toContain('Hi Alex, you owe $12.50.');
        expect(result).toContain('- "Lunch": $7.50');
        expect(result).toContain('- "Coffee": $5.00');
        expect(result).not.toContain('You can pay me via');
        expect(result).not.toContain('Created with SharedBills');
    });

    it('should include payment info if provided', () => {
        const settingsWithPayments: Settings = {
            ...baseSettings,
            paymentDetails: {
                ...baseSettings.paymentDetails,
                venmo: 'my-venmo',
                paypal: 'my-paypal.me',
            },
        };
        const result = generateShareText(participantName, totalOwed, billsInfo, settingsWithPayments, 'subscribed');
        expect(result).toContain('You can pay me via Venmo: @my-venmo or PayPal: my-paypal.me.');
    });
    
    it('should include custom message if provided', () => {
        const settingsWithCustomMessage: Settings = {
            ...baseSettings,
            paymentDetails: {
                ...baseSettings.paymentDetails,
                customMessage: 'Thanks!',
            },
        };
        const result = generateShareText(participantName, totalOwed, billsInfo, settingsWithCustomMessage, 'subscribed');
        expect(result).toContain('Thanks!');
    });

    it('should include promo text for free tier users', () => {
        const result = generateShareText(participantName, totalOwed, billsInfo, baseSettings, 'free');
        expect(result).toContain('Created with SharedBills');
    });

    it('should not include promo text for subscribed users', () => {
        const result = generateShareText(participantName, totalOwed, billsInfo, baseSettings, 'subscribed');
        expect(result).not.toContain('Created with SharedBills');
    });
});
