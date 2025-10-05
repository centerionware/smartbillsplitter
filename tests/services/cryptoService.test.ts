import { describe, it, expect, beforeAll } from 'vitest';
import * as cryptoService from '../../services/cryptoService';
import { Crypto } from '@peculiar/webcrypto';

// JSDOM does not have a webcrypto implementation, so we polyfill it.
beforeAll(() => {
  // FIX: Replace `global` with `globalThis` for compatibility with browser-like test environments.
  if (typeof globalThis.crypto === 'undefined') {
    (globalThis.crypto as any) = new Crypto();
  }
});

describe('cryptoService', () => {
  describe('Symmetric Encryption (AES-GCM)', () => {
    it('should generate, export, and import an encryption key', async () => {
      const key = await cryptoService.generateEncryptionKey();
      expect(key).toBeInstanceOf(CryptoKey);

      const jwk = await cryptoService.exportKey(key);
      expect(jwk).toHaveProperty('kty', 'oct');

      const importedKey = await cryptoService.importEncryptionKey(jwk);
      expect(importedKey).toBeInstanceOf(CryptoKey);
      expect(importedKey.algorithm.name).toBe('AES-GCM');
    });

    it('should encrypt and decrypt data successfully', async () => {
      const key = await cryptoService.generateEncryptionKey();
      const originalText = 'This is a secret message.';
      
      const encryptedData = await cryptoService.encrypt(originalText, key);
      expect(typeof encryptedData).toBe('string');
      
      const decryptedBytes = await cryptoService.decrypt(encryptedData, key);
      const decryptedText = new TextDecoder().decode(decryptedBytes);
      
      expect(decryptedText).toBe(originalText);
    });

    it('should fail to decrypt with the wrong key', async () => {
      const key1 = await cryptoService.generateEncryptionKey();
      const key2 = await cryptoService.generateEncryptionKey();
      const originalText = 'Confidential data';

      const encryptedData = await cryptoService.encrypt(originalText, key1);
      
      await expect(cryptoService.decrypt(encryptedData, key2)).rejects.toThrow();
    });
  });

  describe('Digital Signatures (ECDSA)', () => {
    it('should generate a signing key pair', async () => {
      const keyPair = await cryptoService.generateSigningKeyPair();
      expect(keyPair.publicKey).toBeInstanceOf(CryptoKey);
      expect(keyPair.privateKey).toBeInstanceOf(CryptoKey);
      expect(keyPair.publicKey.usages).toContain('verify');
      expect(keyPair.privateKey.usages).toContain('sign');
    });

    it('should sign data and verify the signature successfully', async () => {
      const keyPair = await cryptoService.generateSigningKeyPair();
      const dataToSign = 'This data needs to be authenticated.';
      
      const signature = await cryptoService.sign(dataToSign, keyPair.privateKey);
      expect(typeof signature).toBe('string');

      const isVerified = await cryptoService.verify(dataToSign, signature, keyPair.publicKey);
      expect(isVerified).toBe(true);
    });

    it('should fail verification if the data is altered', async () => {
      const keyPair = await cryptoService.generateSigningKeyPair();
      const dataToSign = 'Original data.';
      const alteredData = 'Altered data.';
      
      const signature = await cryptoService.sign(dataToSign, keyPair.privateKey);
      
      const isVerified = await cryptoService.verify(alteredData, signature, keyPair.publicKey);
      expect(isVerified).toBe(false);
    });

    it('should fail verification with the wrong public key', async () => {
      const keyPair1 = await cryptoService.generateSigningKeyPair();
      const keyPair2 = await cryptoService.generateSigningKeyPair();
      const dataToSign = 'Some data';
      
      const signature = await cryptoService.sign(dataToSign, keyPair1.privateKey);
      
      const isVerified = await cryptoService.verify(dataToSign, signature, keyPair2.publicKey);
      expect(isVerified).toBe(false);
    });
  });
});