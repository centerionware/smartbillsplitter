import type { Context } from "@netlify/edge-functions";

// Declare Deno to resolve TypeScript error
declare var Deno: any;

// This is a diagnostic function based on the Deno example you provided.
// It helps isolate the WebSocket connection issue.
export default async (request: Request, context: Context) => {
  // We are re-introducing this check based on the standard Deno pattern.
  // Our previous logs showed this header was missing in the Netlify environment,
  // but this test will be definitive.
  if (request.headers.get("upgrade") === "websocket") {
    try {
      const { socket, response } = Deno.upgradeWebSocket(request);

      // Simple echo logic for testing the connection itself.
      socket.onopen = () => console.log("[Sync Test] WebSocket opened!");
      socket.onmessage = (event: MessageEvent) => {
        const message = `Echo from server: ${event.data}`;
        console.log(`[Sync Test] Received: ${event.data}, Sending: "${message}"`);
        socket.send(message);
      };
      socket.onclose = () => console.log("[Sync Test] WebSocket closed.");
      socket.onerror = (e: Event) => console.error("[Sync Test] WebSocket error:", e);

      return response;
    } catch (e) {
      // This should theoretically not be reached if the header check is sufficient.
      console.error("[Sync Test] Deno.upgradeWebSocket threw an error:", e);
      return new Response("Internal Server Error during WebSocket upgrade.", { status: 500 });
    }
  }
  
  // If not a WebSocket upgrade request, return 400 as per the example.
  return new Response("Not a WebSocket request.", { status: 400 });
};
