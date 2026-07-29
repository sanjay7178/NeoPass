import { Context, Next } from 'hono';
import { JWT } from '../utils/jwt';
import type { Env, JWTPayload } from '../types';

// Extend Hono context with user payload
declare module 'hono' {
  interface ContextVariableMap {
    userPayload: JWTPayload;
  }
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      success: false,
      message: 'No token provided',
      tokenExpired: true
    }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const payload = await JWT.verify(token, c.env.JWT_SECRET);
    c.set('userPayload', payload);
    await next();
  } catch (error: any) {
    const isExpired = error.message === 'Token expired';

    return c.json({
      success: false,
      message: isExpired ? 'Your session has expired. Please login again.' : 'Invalid token',
      tokenExpired: isExpired,
      subscriptionExpired: isExpired
    }, 401);
  }
}
