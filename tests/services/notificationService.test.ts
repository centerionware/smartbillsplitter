import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as notificationService from '../../services/notificationService';
import type { RecurringBill } from '../../types';

// --- Mocks for Browser APIs ---
const mockNotification = {
  close: vi.fn(),
};

const mockRegistration = {
  showNotification: vi.fn(),
  getNotifications: vi.fn().mockResolvedValue([]),
};

const mockServiceWorker = {
  ready: Promise.resolve(mockRegistration),
  controller: {
    postMessage: vi.fn(),
  },
};

const mockBill: RecurringBill = {
  id: 'rb-1',
  description: 'Rent',
  totalAmount: 1000,
  nextDueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
  status: 'active',
  participants: [],
  recurrenceRule: { frequency: 'monthly', interval: 1 },
  splitMode: 'equally',
};

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Stub browser globals
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('default'),
      prototype: {},
    });
    vi.stubGlobal('navigator', {
      serviceWorker: mockServiceWorker,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should not schedule notification if permission is not granted', async () => {
    // FIX: Mock read-only property with spyOn
    vi.spyOn(Notification, 'permission', 'get').mockReturnValue('denied');
    await notificationService.scheduleNotification(mockBill, 3);
    expect(mockRegistration.showNotification).not.toHaveBeenCalled();
    expect(mockServiceWorker.controller.postMessage).not.toHaveBeenCalled();
  });

  it('should not schedule notification if date is in the past, but should attempt to cancel any existing one', async () => {
    vi.spyOn(Notification, 'permission', 'get').mockReturnValue('granted');
    const pastBill = { ...mockBill, nextDueDate: new Date(Date.now() - 1000).toISOString() };
    
    await notificationService.scheduleNotification(pastBill, 3);
    
    // It should NOT schedule a NEW notification
    expect(mockRegistration.showNotification).not.toHaveBeenCalled();
    
    // It SHOULD attempt to CANCEL any existing notifications for this tag.
    // Our cancelNotification function sends a postMessage for this to clear timeouts.
    expect(mockServiceWorker.controller.postMessage).toHaveBeenCalledWith({
      type: 'cancel-notification',
      tag: 'bill-reminder-rb-1',
    });

    // We can also be more specific and ensure no 'schedule-notification' message was sent.
    const scheduleCall = vi.mocked(mockServiceWorker.controller.postMessage).mock.calls.find(call => call[0].type === 'schedule-notification');
    expect(scheduleCall).toBeUndefined();
  });

  it('should use TimestampTrigger if supported', async () => {
    vi.spyOn(Notification, 'permission', 'get').mockReturnValue('granted');
    // @ts-ignore - Mocking a proposed API
    globalThis.TimestampTrigger = vi.fn();
    // FIX: Define non-standard properties on the prototype for the test environment.
    Object.defineProperty(Notification.prototype, 'showTrigger', {
        value: vi.fn(),
        writable: true,
        configurable: true,
    });
    
    await notificationService.scheduleNotification(mockBill, 3);
    
    expect(mockRegistration.showNotification).toHaveBeenCalledWith(
      'Upcoming Bill Reminder',
      expect.objectContaining({
        body: expect.stringContaining('Rent'),
        tag: 'bill-reminder-rb-1',
        showTrigger: expect.any((globalThis as any).TimestampTrigger),
      })
    );
    expect(mockServiceWorker.controller.postMessage).not.toHaveBeenCalled();
    
    // Cleanup mock
    // @ts-ignore
    delete globalThis.TimestampTrigger;
    delete (Notification.prototype as any).showTrigger;
  });

  it('should use setTimeout fallback via Service Worker if triggers are not supported', async () => {
    vi.spyOn(Notification, 'permission', 'get').mockReturnValue('granted');
    // Ensure no trigger support
    if ('showTrigger' in Notification.prototype) {
      delete (Notification.prototype as any).showTrigger;
    }

    await notificationService.scheduleNotification(mockBill, 3);

    expect(mockRegistration.showNotification).not.toHaveBeenCalled();
    expect(mockServiceWorker.controller.postMessage).toHaveBeenCalledWith({
      type: 'schedule-notification',
      title: 'Upcoming Bill Reminder',
      options: expect.any(Object),
      triggerTimestamp: expect.any(Number),
      tag: 'bill-reminder-rb-1',
    });
  });

  it('should cancel native and fallback notifications', async () => {
    mockRegistration.getNotifications.mockResolvedValueOnce([mockNotification as any]);
    
    await notificationService.cancelNotification('rb-1');
    
    // Checks for cancellation of native trigger-based notification
    expect(mockRegistration.getNotifications).toHaveBeenCalledWith({ tag: 'bill-reminder-rb-1' });
    expect(mockNotification.close).toHaveBeenCalled();

    // Checks for cancellation of SW-based setTimeout fallback
    expect(mockServiceWorker.controller.postMessage).toHaveBeenCalledWith({
      type: 'cancel-notification',
      tag: 'bill-reminder-rb-1',
    });
  });
});