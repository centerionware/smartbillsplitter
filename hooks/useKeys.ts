import { useState, useEffect } from 'react';
import { getKeyPair, saveKeyPair } from '../services/db.ts';
import * as cryptoService from '../services/cryptoService.ts';

interface UseKeysReturn {
  keyPair: CryptoKeyPair | null;
  isLoading: boolean;
}

export const useKeys = (): UseKeysReturn => {
  const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOrCreateKeys = async () => {
      try {
        setIsLoading(true);
        let storedKeyPairData = await getKeyPair();
        
        if (storedKeyPairData) {
          setKeyPair(storedKeyPairData.keyPair);
        } else {
          // If no key pair exists, generate a new one and save it.
          const newKeyPair = await cryptoService.generateSigningKeyPair();
          await saveKeyPair(newKeyPair);
          setKeyPair(newKeyPair);
        }
      } catch (err) {
        console.error("Failed to load or generate signing keys:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadOrCreateKeys();
  }, []);

  return { keyPair, isLoading };
};