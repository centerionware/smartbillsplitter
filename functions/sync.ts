import type { Context } from "@netlify/edge-functions";

// Declare Deno to resolve TypeScript error in Netlify Edge Function environment
declare var Deno: any;

/**
 * A minimal WebSocket echo server for diagnostics.
 * This temporarily replaces the sync logic to isolate the platform's
 * WebSocket handling.
 */
export default async (request: Request, context: Context) => {
  try {
    // Attempt to upgrade the connection. This is where the error occurs.
    const { socket, response } = Deno.upgradeWebSocket(request);

    // If upgrade is successful, attach basic echo listeners.
    socket.onopen = () => {
      console.log("[Sync Echo] WebSocket connection opened successfully.");
      socket.send("Connection established. This is an echo server.");
    };

    socket.onmessage = (event) => {
      console.log("[Sync Echo] Received message:", event.data);
      const reply = `Echo: ${event.data}`;
      socket.send(reply);
    };

    socket.onclose = (event) => {
      console.log(`[Sync Echo] WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
    };

    socket.onerror = (error) => {
      console.error("[Sync Echo] WebSocket error:", error);
    };

    // Return the response object from the upgrade to complete the handshake.
    return response;
  } catch (error) {
    console.error("[Sync Echo] Failed to upgrade WebSocket connection:", error);
    // If Deno.upgradeWebSocket throws, it means the handshake failed.
    // The browser will see a failed connection attempt.
    return new Response("Failed to upgrade to WebSocket.", { status: 400 });
  }
};
