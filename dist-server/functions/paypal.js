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

// functions/paypal.ts
var paypal_exports = {};
__export(paypal_exports, {
  cancelSubscriptionHandler: () => cancelSubscriptionHandler,
  createCheckoutSessionHandler: () => createCheckoutSessionHandler,
  getSubscriptionDetailsHandler: () => getSubscriptionDetailsHandler,
  manageSubscriptionHandler: () => manageSubscriptionHandler,
  verifyPaymentHandler: () => verifyPaymentHandler
});
module.exports = __toCommonJS(paypal_exports);
var PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
var PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
var PAYPAL_PLAN_ID_MONTHLY = process.env.PAYPAL_PLAN_ID_MONTHLY;
var PAYPAL_PLAN_ID_YEARLY = process.env.PAYPAL_PLAN_ID_YEARLY;
var PAYPAL_MODE = process.env.PAYPAL_MODE || "sandbox";
var PAYPAL_API_BASE = PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
var assertPayPalConfig = () => {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !PAYPAL_PLAN_ID_MONTHLY || !PAYPAL_PLAN_ID_YEARLY) {
    throw new Error("PayPal integration is not configured on the server.");
  }
};
async function getPayPalAccessToken() {
  assertPayPalConfig();
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  if (!response.ok) {
    let errorBody = await response.text();
    try {
      const errorJson = JSON.parse(errorBody);
      errorBody = errorJson.error_description || errorJson.error || JSON.stringify(errorJson);
    } catch (e) {
    }
    console.error(`PayPal Auth Error (${response.status}):`, errorBody);
    throw new Error(`Failed to get PayPal access token: ${errorBody}`);
  }
  const data = await response.json();
  return data.access_token;
}
var createCheckoutSessionHandler = async (req) => {
  try {
    const { plan, origin } = req.body;
    if (!plan || plan !== "monthly" && plan !== "yearly" || !origin) {
      throw new Error("Invalid request. 'plan' (monthly/yearly) and 'origin' are required.");
    }
    const planId = plan === "monthly" ? PAYPAL_PLAN_ID_MONTHLY : PAYPAL_PLAN_ID_YEARLY;
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        plan_id: planId,
        application_context: {
          return_url: `${origin}`,
          cancel_url: `${origin}`
        }
      })
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("PayPal API Error on Subscription Creation:", errorBody);
      let errorMessage = "Failed to create PayPal subscription.";
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.name === "UNPROCESSABLE_ENTITY" && Array.isArray(errorJson.details) && errorJson.details.some((d) => d.field === "/plan_id" && d.issue === "INVALID_RESOURCE_ID")) {
          errorMessage = `The PayPal Plan ID ('${planId}') is invalid or does not exist in the current environment (${PAYPAL_MODE}). Please check your server configuration.`;
        } else {
          errorMessage = errorJson.details?.[0]?.description || errorJson.message || errorMessage;
        }
      } catch (e) {
      }
      throw new Error(errorMessage);
    }
    const data = await response.json();
    const approvalLink = data.links.find((link) => link.rel === "approve");
    if (!approvalLink) {
      throw new Error("Could not find PayPal approval link in the API response.");
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ url: approvalLink.href })
    };
  } catch (error) {
    console.error("PayPal Checkout Error:", { message: error.message, stack: error.stack });
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ error: "An internal server error occurred while creating the checkout session.", details: error.message })
    };
  }
};
var verifyPaymentHandler = async (req) => {
  try {
    const { sessionId: subscriptionId } = req.body;
    if (!subscriptionId) {
      throw new Error("Missing 'sessionId' (PayPal Subscription ID).");
    }
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      let errorBody = await response.text();
      try {
        const errorJson = JSON.parse(errorBody);
        errorBody = errorJson.details?.[0]?.description || errorJson.message || JSON.stringify(errorJson);
      } catch (e) {
      }
      console.error(`PayPal Subscription Fetch Error (${response.status}):`, errorBody);
      throw new Error(`Failed to verify PayPal subscription details. The server responded: ${errorBody}`);
    }
    const data = await response.json();
    if ((data.status === "ACTIVE" || data.status === "APPROVED") && data.plan_id) {
      let duration = null;
      if (data.plan_id === PAYPAL_PLAN_ID_MONTHLY) duration = "monthly";
      else if (data.plan_id === PAYPAL_PLAN_ID_YEARLY) duration = "yearly";
      if (!duration) throw new Error("Could not determine subscription duration from PayPal plan ID.");
      if (!data.subscriber?.payer_id) throw new Error("Could not find customer ID in PayPal response.");
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({
          status: "success",
          provider: "paypal",
          duration,
          subscriptionId: data.id,
          customerId: data.subscriber.payer_id
        })
      };
    } else {
      throw new Error(`The server returned an invalid response during payment verification. Status: ${data.status}`);
    }
  } catch (error) {
    console.error("PayPal Verification Error:", { message: error.message, stack: error.stack });
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ error: "An internal server error occurred during payment verification.", details: error.message })
    };
  }
};
var getSubscriptionDetailsHandler = async (req) => {
  try {
    const subscriptionId = req.query.id;
    if (!subscriptionId) {
      throw new Error("Missing subscription 'id' in query parameter.");
    }
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      throw new Error(`Could not find a subscription with ID: ${subscriptionId}. It may be invalid or from a different PayPal environment.`);
    }
    const data = await response.json();
    let plan = "unknown";
    if (data.plan_id === PAYPAL_PLAN_ID_MONTHLY) plan = "monthly";
    else if (data.plan_id === PAYPAL_PLAN_ID_YEARLY) plan = "yearly";
    else {
      throw new Error(`This subscription does not belong to this application.`);
    }
    const details = {
      id: data.id,
      status: data.status,
      plan,
      startTime: data.start_time,
      isCurrentDevice: false
      // This will be set on the client
    };
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify(details)
    };
  } catch (error) {
    console.error("PayPal Get Subscription Details Error:", { message: error.message });
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ error: error.message })
    };
  }
};
var manageSubscriptionHandler = async (req) => {
  const url = PAYPAL_MODE === "live" ? "https://www.paypal.com/myaccount/autopay/" : "https://www.sandbox.paypal.com/myaccount/autopay/";
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ url })
  };
};
var cancelSubscriptionHandler = async (req) => {
  try {
    const { subscriptionId } = req.body;
    if (!subscriptionId) {
      throw new Error("Missing 'subscriptionId' in request body.");
    }
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        reason: "User requested cancellation from within the application."
      })
    });
    if (response.status === 204) {
      return {
        statusCode: 204,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
      };
    } else {
      const errorBody = await response.text();
      console.error(`PayPal Subscription Cancellation Error (${response.status}):`, errorBody);
      throw new Error("Failed to cancel subscription on PayPal's end.");
    }
  } catch (error) {
    console.error("PayPal Cancellation Error:", { message: error.message, stack: error.stack });
    const statusCode = error.message.includes("Missing 'subscriptionId'") ? 400 : 500;
    return {
      statusCode,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ error: "An internal server error occurred during subscription cancellation.", details: error.message })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  cancelSubscriptionHandler,
  createCheckoutSessionHandler,
  getSubscriptionDetailsHandler,
  manageSubscriptionHandler,
  verifyPaymentHandler
});
