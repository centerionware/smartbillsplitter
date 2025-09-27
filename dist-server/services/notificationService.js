var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// services/notificationService.ts
var notificationService_exports = {};
__export(notificationService_exports, {
  cancelNotification: () => cancelNotification,
  isSupported: () => isSupported,
  requestPermission: () => requestPermission,
  scheduleNotification: () => scheduleNotification
});
module.exports = __toCommonJS(notificationService_exports);
var isSupported = () => {
  return "Notification" in window && "showTrigger" in Notification.prototype && "serviceWorker" in navigator;
};
var requestPermission = async () => {
  if (!isSupported()) {
    console.warn("Notification Triggers are not supported in this browser.");
    return "denied";
  }
  return Notification.requestPermission();
};
var getNotificationTag = (billId) => `bill-reminder-${billId}`;
var scheduleNotification = async (bill, daysBefore) => {
  if (!isSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const tag = getNotificationTag(bill.id);
  const existingNotifications = await registration.getNotifications({ tag });
  existingNotifications.forEach((notification) => notification.close());
  const dueDate = new Date(bill.nextDueDate);
  const triggerTimestamp = dueDate.getTime() - daysBefore * 24 * 60 * 60 * 1e3;
  if (triggerTimestamp < Date.now()) {
    console.log(`Skipping notification for "${bill.description}" as its reminder date is in the past.`);
    return;
  }
  try {
    await registration.showNotification("Upcoming Bill Reminder", {
      body: `Your "${bill.description}" bill is due in ${daysBefore} day${daysBefore > 1 ? "s" : ""}.`,
      tag,
      // @ts-ignore - showTrigger is not yet in the default TS DOM libs
      showTrigger: new TimestampTrigger(triggerTimestamp)
    });
    console.log(`Notification scheduled for "${bill.description}" on ${new Date(triggerTimestamp).toLocaleString()}`);
  } catch (error) {
    console.error("Error scheduling notification:", error);
  }
};
var cancelNotification = async (billId) => {
  if (!isSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const tag = getNotificationTag(billId);
  const notifications = await registration.getNotifications({ tag });
  if (notifications.length > 0) {
    notifications.forEach((notification) => notification.close());
    console.log(`Canceled notification for bill ID ${billId}`);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  cancelNotification,
  isSupported,
  requestPermission,
  scheduleNotification
});
