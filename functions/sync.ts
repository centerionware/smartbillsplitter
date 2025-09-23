import type { Context } from "@netlify/functions";

// In-memory store for sync sessions. This is suitable for the ephemeral nature
// of serverless functions for short-lived data.
const sessions = new Map<string, { data: string; expires: number }>();
const EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

// Generates a unique 6-digit code for a session.
const generateCode = (): string => {
  let code: string;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (sessions.has(code)); // Ensure code is unique in the current instance
  return code;
};

// Periodically clean up expired sessions to prevent memory leaks.
setInterval(() => {
  const now = Date.now();
  for (const [code, session] of sessions.entries()) {
    if (now > session.expires) {
      sessions.delete(code);
      console.log(`Expired session ${code} cleaned up.`);
    }
  }
}, 60 * 1000); // Run cleanup every minute

export default async (request: Request, context: Context) => {
  // Standard headers for CORS and JSON responses.
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };
  
  // Handle CORS preflight requests.
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // --- UPLOAD DATA (POST) ---
  if (request.method === "POST") {
    try {
      const { encryptedData } = await request.json();
      if (!encryptedData || typeof encryptedData !== 'string') {
        return new Response(JSON.stringify({ error: "Invalid payload. 'encryptedData' string is required." }), { status: 400, headers });
      }

      const code = generateCode();
      sessions.set(code, {
        data: encryptedData,
        expires: Date.now() + EXPIRATION_MS,
      });

      console.log(`Created session ${code}. Total sessions: ${sessions.size}`);
      return new Response(JSON.stringify({ code }), { status: 201, headers });

    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body." }), { status: 400, headers });
    }
  }

  // --- DOWNLOAD DATA (GET) ---
  if (request.method === "GET") {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    if (!code) {
      return new Response(JSON.stringify({ error: "Missing 'code' query parameter." }), { status: 400, headers });
    }

    const session = sessions.get(code);

    if (!session || Date.now() > session.expires) {
      if (session) sessions.delete(code); // Clean up expired session on access
      return new Response(JSON.stringify({ error: "Invalid or expired code." }), { status: 404, headers });
    }

    // Critical security step: data is for one-time use only.
    sessions.delete(code);
    console.log(`Session ${code} retrieved and deleted. Total sessions: ${sessions.size}`);
    
    return new Response(JSON.stringify({ encryptedData: session.data }), { status: 200, headers });
  }

  // --- Fallback for other HTTP methods ---
  return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers });
};
