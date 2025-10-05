import type { RecurringBill } from '../types';

/**
 * Checks if the browser supports basic notifications and service workers.
 */
export const isSupported = (): boolean => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

/**
 * Checks if the browser supports reliable, scheduled notifications via Triggers.
 */
const hasTriggerSupport = (): boolean => {
  return isSupported() && 'showTrigger' in Notification.prototype;
}

/**
 * Requests permission from the user to show notifications.
 * @returns A promise that resolves with the permission status.
 */
export const requestPermission = async (): Promise<NotificationPermission> => {
  if (!isSupported()) {
    console.warn("Notifications are not supported in this browser.");
    return 'denied';
  }
  return Notification.requestPermission();
};

const getNotificationTag = (billId: string) => `bill-reminder-${billId}`;

/**
 * Schedules a notification for a recurring bill, using the best available method.
 * It will first cancel any existing notification for the same bill.
 * @param bill The recurring bill to schedule a reminder for.
 * @param daysBefore The number of days before the due date to show the notification.
 */
export const scheduleNotification = async (bill: RecurringBill, daysBefore: number): Promise<void> => {
  if (!isSupported() || Notification.permission !== 'granted') return;

  const registration = await navigator.serviceWorker.ready;
  const tag = getNotificationTag(bill.id);
  const dueDate = new Date(bill.nextDueDate);
  // Set time to a reasonable hour like 9 AM local time for the notification
  dueDate.setHours(9, 0, 0, 0); 
  const triggerTimestamp = dueDate.getTime() - (daysBefore * 24 * 60 * 60 * 1000);

  // Don't schedule notifications for dates in the past
  if (triggerTimestamp < Date.now()) {
    console.log(`Skipping notification for "${bill.description}" as its reminder date is in the past.`);
    // Ensure any old scheduled notifications are cancelled just in case.
    await cancelNotification(bill.id);
    return;
  }

  const title = 'Upcoming Bill Reminder';
  const options = {
    body: `Your "${bill.description}" bill is due in ${daysBefore} day${daysBefore > 1 ? 's' : ''}.`,
    tag: tag,
    icon: '/icon.svg',
    // Make notification silent on some platforms
    silent: true,
  };

  // Natively scheduled (reliable) path
  if (hasTriggerSupport()) {
    console.log(`[App] Scheduling notification for "${bill.description}" using TimestampTrigger.`);
    // Cancel any previously scheduled native notification for this bill before rescheduling.
    const existingNotifications = await registration.getNotifications({ tag });
    existingNotifications.forEach(notification => notification.close());

    try {
      await registration.showNotification(title, {
        ...options,
        // @ts-ignore - showTrigger is not yet in the default TS DOM libs
        showTrigger: new (window as any).TimestampTrigger(triggerTimestamp),
      });
    } catch (error) {
      console.error("[App] Error scheduling with TimestampTrigger:", error);
    }
  } 
  // setTimeout fallback (less reliable) path
  else {
    console.log(`[App] Scheduling notification for "${bill.description}" via SW setTimeout fallback.`);
    // We still need to cancel any existing *native* scheduled notifications
    // that might have been created before, just in case.
    const existingNotifications = await registration.getNotifications({ tag });
    existingNotifications.forEach(notification => notification.close());
    
    // Post a message to the SW to use setTimeout. The SW will handle clearing previous timeouts.
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'schedule-notification',
        title,
        options,
        triggerTimestamp,
        tag,
      });
    } else {
        console.warn("[App] Service worker controller not available. Cannot schedule fallback notification.");
    }
  }
};

/**
 * Cancels a scheduled notification for a given bill ID, regardless of the method used.
 * @param billId The ID of the bill whose notification should be canceled.
 */
export const cancelNotification = async (billId: string): Promise<void> => {
  if (!isSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const tag = getNotificationTag(billId);

  // 1. Attempt to cancel using the native API. This works for Trigger-based notifications.
  const notifications = await registration.getNotifications({ tag });
  if (notifications.length > 0) {
    notifications.forEach(notification => notification.close());
    console.log(`[App] Canceled native scheduled notification for bill ID ${billId}`);
  }

  // 2. Also send a message to the SW to clear any pending setTimeout fallback.
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'cancel-notification',
      tag,
    });
  }
};