import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import redisClient from '../services/redisClient.ts';

const EXPIRATION_SECONDS = 24 * 60 * 60; // 24 hours

export const shareHandler = async (req: Request, res: Response) => {
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
      const key = `share:${id}`;
      
      const sessionData = {
        data: encryptedData,
        lastUpdatedAt: now,
      };

      if (idToUpdate) {
        const exists = await redisClient.exists(key);
        if (!exists) {
          return res.status(404).json({ error: "Share ID not found for update." });
        }
      }

      await redisClient.set(key, JSON.stringify(sessionData), 'EX', EXPIRATION_SECONDS);

      console.log(`Created/Updated shared bill ${id}.`);
      return res.status(201).json({ shareId: id });

    } catch (e) {
      console.error('Share POST error:', e);
      return res.status(400).json({ error: "Invalid JSON body or Redis error." });
    }
  }

  // --- RETRIEVE A SHARED BILL (GET) ---
  if (req.method === "GET") {
    const { shareId } = req.params;
    if (!shareId) {
      return res.status(400).json({ error: "Missing 'shareId' in path." });
    }
    
    const key = `share:${shareId}`;
    const sessionJson = await redisClient.get(key);

    if (!sessionJson) {
      return res.status(404).json({ error: "Invalid or expired share ID." });
    }
    
    const session = JSON.parse(sessionJson);
    const lastCheckedAt = req.query.lastCheckedAt ? parseInt(req.query.lastCheckedAt as string, 10) : 0;

    if (lastCheckedAt && lastCheckedAt >= session.lastUpdatedAt) {
        return res.status(304).send();
    }

    return res.status(200).json({
        encryptedData: session.data,
        lastUpdatedAt: session.lastUpdatedAt
    });
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: "Method Not Allowed" });
};
