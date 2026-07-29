import type { Env, JWTPayload } from '../types';

// Simple JWT implementation for Cloudflare Workers
export class JWT {
  static async sign(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string, expiresIn: number = 12 * 60 * 60): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);

    const fullPayload: JWTPayload = {
      ...payload,
      iat: now,
      exp: now + expiresIn
    };

    const headerB64 = btoa(JSON.stringify(header));
    const payloadB64 = btoa(JSON.stringify(fullPayload));
    const signature = await this.createSignature(`${headerB64}.${payloadB64}`, secret);

    return `${headerB64}.${payloadB64}.${signature}`;
  }

  static async verify(token: string, secret: string): Promise<JWTPayload> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerB64, payloadB64, signature] = parts;

    // Verify signature
    const expectedSignature = await this.createSignature(`${headerB64}.${payloadB64}`, secret);
    if (signature !== expectedSignature) {
      throw new Error('Invalid signature');
    }

    // Parse payload
    const payload: JWTPayload = JSON.parse(atob(payloadB64));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error('Token expired');
    }

    return payload;
  }

  private static async createSignature(input: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(input);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    return this.arrayBufferToBase64(signature);
  }

  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}
