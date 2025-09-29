
import type { RecurringBill } from '../types';

/**
 * Checks if the browser supports scheduled notifications.
 */
export const isSupported = (): boolean => {
  return 'Notification' in window && 'showTrigger' in Notification.prototype && 'serviceWorker' in navigator;
};

/**
 * Requests permission from the user to show notifications.
 * @returns A promise that resolves with the permission status.
 */
export const requestPermission = async (): Promise<NotificationPermission> => {
  if (!isSupported()) {
    console.warn("Notification Triggers are not supported in this browser.");
    return 'denied';
  }
  return Notification.requestPermission();
};

const getNotificationTag = (billId: string) => `bill-reminder-${billId}`;

/**
 * Schedules a notification for a recurring bill.
 * It will first cancel any existing notification for the same bill.
 * @param bill The recurring bill to schedule a reminder for.
 * @param daysBefore The number of days before the due date to show the notification.
 */
export const scheduleNotification = async (bill: RecurringBill, daysBefore: number): Promise<void> => {
  if (!isSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const tag = getNotificationTag(bill.id);

  // 1. Cancel any previously scheduled notification for this bill
  const existingNotifications = await registration.getNotifications({ tag });
  existingNotifications.forEach(notification => notification.close());

  // 2. Calculate the trigger timestamp
  const dueDate = new Date(bill.nextDueDate);
  const triggerTimestamp = dueDate.getTime() - (daysBefore * 24 * 60 * 60 * 1000);

  // 3. Don't schedule notifications for dates in the past
  if (triggerTimestamp < Date.now()) {
    console.log(`Skipping notification for "${bill.description}" as its reminder date is in the past.`);
    return;
  }

  // 4. Schedule the new notification
  try {
    await registration.showNotification('Upcoming Bill Reminder', {
      body: `Your "${bill.description}" bill is due in ${daysBefore} day${daysBefore > 1 ? 's' : ''}.`,
      tag: tag,
      // @ts-ignore - showTrigger is not yet in the default TS DOM libs
      showTrigger: new (window as any).TimestampTrigger(triggerTimestamp),
    });
    console.log(`Notification scheduled for "${bill.description}" on ${new Date(triggerTimestamp).toLocaleString()}`);
  } catch (error) {
    console.error("Error scheduling notification:", error);
  }
};

/**
 * Cancels a scheduled notification for a given bill ID.
 * @param billId The ID of the bill whose notification should be canceled.
 */
export const cancelNotification = async (billId: string): Promise<void> => {
  if (!isSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const tag = getNotificationTag(billId);

  const notifications = await registration.getNotifications({ tag });
  if (notifications.length > 0) {
    notifications.forEach(notification => notification.close());
    console.log(`Canceled notification for bill ID ${billId}`);
  }
};
