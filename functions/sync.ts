import type { Context } from "@netlify/edge-functions";

// FIX: Declare Deno to resolve TypeScript error in Netlify Edge Function environment
declare var Deno: any;

// This is a simplified in-memory store.
// NOTE: In a real multi-instance edge environment, this state is NOT shared
// across different edge nodes. A proper implementation would require a distributed
// state manager like Upstash (Redis). For this app's purpose of short-lived,
// single-user sessions, this is acceptable as a user's session will likely
// hit the same edge node for its duration.
const rooms = new Map<string, { sender: WebSocket; receiver?: WebSocket; timeoutId?: any }>();

function generateUniqueCode(): string {
  let code: string;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(code));
  return code;
}

function safeSend(ws: WebSocket, message: object) {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  } catch (e) {
    console.error("Failed to send message:", e);
  }
}

export default async (request: Request, context: Context) => {
  // Ensure this is a WebSocket upgrade request.
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("This endpoint requires a WebSocket connection.", { status: 426 });
  }
  
  const { searchParams } = new URL(request.url);
  const codeFromUrl = searchParams.get('code');

  // Deno/Netlify Edge function specific upgrade
  const { socket: ws, response } = Deno.upgradeWebSocket(request);

  ws.onopen = () => {
    if (codeFromUrl) {
      // This is a RECEIVER
      const room = rooms.get(codeFromUrl);
      if (room && !room.receiver) {
        console.log(`Receiver joined room ${codeFromUrl}`);
        room.receiver = ws;
        clearTimeout(room.timeoutId); // The session is now active, clear the expiry timer.
        
        // Notify both parties
        safeSend(room.sender, { type: 'peer_joined' });
      } else {
        safeSend(ws, { type: 'error', message: 'Invalid or full sync code.' });
        ws.close();
      }
    } else {
      // This is a SENDER (initiator)
      const newCode = generateUniqueCode();
      console.log(`Sender created room ${newCode}`);

      // Set a timeout to clean up the room if a receiver doesn't connect
      const timeoutId = setTimeout(() => {
        const room = rooms.get(newCode);
        if (room && !room.receiver) {
          safeSend(ws, { type: 'error', message: 'Sync session timed out.' });
          ws.close();
          rooms.delete(newCode);
        }
      }, 5 * 60 * 1000); // 5 minute timeout

      rooms.set(newCode, { sender: ws, timeoutId });
      safeSend(ws, { type: 'session_created', code: newCode });
    }
  };

  ws.onmessage = (event) => {
    // Find the room this websocket belongs to
    let roomCode: string | undefined = codeFromUrl;
    if (!roomCode) {
        for (const [code, room] of rooms.entries()) {
            if (room.sender === ws || room.receiver === ws) {
                roomCode = code;
                break;
            }
        }
    }
    if (!roomCode) return;
    
    const room = rooms.get(roomCode);
    if (!room) return;
    
    // Relay message to the other party
    const target = ws === room.sender ? room.receiver : room.sender;
    if (target && target.readyState === WebSocket.OPEN) {
      target.send(event.data);
    }
  };

  ws.onclose = ws.onerror = () => {
    // Find and clean up the room associated with the closed websocket
    let roomCode: string | undefined = codeFromUrl;
    if (!roomCode) {
        for (const [code, room] of rooms.entries()) {
            if (room.sender === ws || room.receiver === ws) {
                roomCode = code;
                break;
            }
        }
    }
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (room) {
      // Notify the other party if they exist
      const otherWs = ws === room.sender ? room.receiver : room.sender;
      if (otherWs && otherWs.readyState < WebSocket.CLOSING) {
        safeSend(otherWs, { type: 'peer_disconnected' });
        otherWs.close();
      }
      clearTimeout(room.timeoutId);
      rooms.delete(roomCode);
      console.log(`Room ${roomCode} closed.`);
    }
  };

  return response;
};
