// FIX: Changed import to use RequestHandler for robust Express handler typing.
import { RequestHandler } from 'express';
import { randomUUID } from 'crypto';
import redisClient from '../services/redisClient.ts';

const EXPIRATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

// FIX: Explicitly typed the handler with RequestHandler to ensure correct types for req and res.
export const shareHandler: RequestHandler = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  
  const { shareId } = req.params;

  // --- CREATE OR UPDATE A SHARED BILL (POST) ---
  if (req.method === "POST") {
    try {
      const { encryptedData } = req.body;
      if (!encryptedData || typeof encryptedData !== 'string') {
        return res.status(400).json({ error: "Invalid payload. 'encryptedData' string is required." });
      }

      const now = Date.now();
      
      if (shareId) { // This is an UPDATE
        const key = `share:${shareId}`;
        const existingSession = await redisClient.get(key);
        if (!existingSession) {
            return res.status(404).json({ error: "Cannot update. Share session not found or expired." });
        }
        
        const sessionData = { data: encryptedData, lastUpdatedAt: now };
        await redisClient.set(key, JSON.stringify(sessionData), 'EX', EXPIRATION_SECONDS);
        
        console.log(`Updated shared bill ${shareId}.`);
        return res.status(200).json({ shareId, lastUpdatedAt: now });

      } else { // This is a CREATE
        const id = randomUUID();
        const key = `share:${id}`;
        const sessionData = { data: encryptedData, lastUpdatedAt: now };
        await redisClient.set(key, JSON.stringify(sessionData), 'EX', EXPIRATION_SECONDS);
        
        console.log(`Created shared bill ${id}.`);
        return res.status(201).json({ shareId: id });
      }

    } catch (e) {
      console.error('Share POST error:', e);
      return res.status(400).json({ error: "Invalid JSON body or Redis error." });
    }
  }

  // --- RETRIEVE A SHARED BILL (GET) ---
  if (req.method === "GET") {
    if (!shareId) {
      return res.status(400).json({ error: "Missing 'shareId' in path." });
    }
    
    const key = `share:${shareId}`;
    const sessionJson = await redisClient.get(key);

    if (!sessionJson) {
      return res.status(404).json({ error: "Invalid or expired share ID." });
    }
    
    const session = JSON.parse(sessionJson);

    return res.status(200).json({
        encryptedData: session.data,
        lastUpdatedAt: session.lastUpdatedAt
    });
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: "Method Not Allowed" });
};