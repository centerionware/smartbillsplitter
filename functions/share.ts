import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';

// In-memory store for shared bills. This is suitable for the ephemeral nature
// of serverless functions for short-lived data.
const sharedBills = new Map<string, { data: string; lastUpdatedAt: number; expires: number }>();
const EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Periodically clean up expired sessions to prevent memory leaks.
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sharedBills.entries()) {
    if (now > session.expires) {
      sharedBills.delete(id);
      console.log(`Expired shared bill ${id} cleaned up.`);
    }
  }
}, 5 * 60 * 1000); // Run cleanup every 5 minutes

export const shareHandler = async (req: Request, res: Response) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  // --- CREATE/UPDATE A SHARED BILL (POST) ---
  if (req.method === "POST") {
    try {
      const { encryptedData, shareId: idToUpdate } = req.body;
      if (!encryptedData || typeof encryptedData !== 'string') {
        return res.status(400).json({ error: "Invalid payload. 'encryptedData' string is required." });
      }

      const now = Date.now();
      const id = idToUpdate || randomUUID();
      
      if (idToUpdate && !sharedBills.has(idToUpdate)) {
        return res.status(404).json({ error: "Share ID not found for update." });
      }

      sharedBills.set(id, {
        data: encryptedData,
        lastUpdatedAt: now,
        expires: now + EXPIRATION_MS,
      });

      console.log(`Created/Updated shared bill ${id}. Total shares: ${sharedBills.size}`);
      return res.status(201).json({ shareId: id });

    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON body." });
    }
  }

  // --- RETRIEVE A SHARED BILL (GET) ---
  if (req.method === "GET") {
    const { shareId } = req.params;
    if (!shareId) {
      return res.status(400).json({ error: "Missing 'shareId' in path." });
    }

    const session = sharedBills.get(shareId);

    // If the session doesn't exist or is expired, return an error.
    // The background cleanup task will handle the actual deletion.
    if (!session || Date.now() > session.expires) {
      return res.status(404).json({ error: "Invalid or expired share ID." });
    }
    
    const lastCheckedAt = req.query.lastCheckedAt ? parseInt(req.query.lastCheckedAt as string, 10) : 0;
    if (lastCheckedAt && lastCheckedAt >= session.lastUpdatedAt) {
        return res.status(304).send();
    }

    return res.status(200).json({
        encryptedData: session.data,
        lastUpdatedAt: session.lastUpdatedAt
    });
  }

  // --- Fallback for other HTTP methods ---
  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: "Method Not Allowed" });
};