// Environment bindings for Cloudflare Workers
export type Env = {
  // KV Namespace for user data
  USERS: KVNamespace;

  // Cloudflare Workers AI
  AI: Ai;

  // Environment variables
  ENVIRONMENT: string;

  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  ADMIN_API_KEY?: string;

  // Optional D1 Database binding
  // DB: D1Database;
};

// User data structure stored in KV
export interface UserData {
  username: string;
  passwordHash: string;
  email?: string;
  isPro: boolean;
  plan: "free" | "pro" | "enterprise";
  createdAt: number;
  expiresAt?: number;
  lastLogin?: number;
  metadata?: Record<string, any>;
}

// JWT Payload
export interface JWTPayload {
  sub: string; // username
  iat: number; // issued at
  exp: number; // expires at
  plan: string;
  type?: "access" | "refresh";
}

// API Response types
export interface AuthResponse {
  success: boolean;
  accessToken?: string;
  username?: string;
  message?: string;
}

export interface AccountResponse {
  success: boolean;
  account?: {
    username: string;
    isPro: boolean;
    plan: string;
    expiresAt?: number;
  };
  message?: string;
  subscriptionExpired?: boolean;
  tokenExpired?: boolean;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
}

// Request types
export interface LoginRequest {
  username: string;
  password: string;
}

// AI Request types
export type AITaskType = "mcq" | "coding" | "chat" | "nptel" | "solve";

export interface AIRequest {
  prompt: string;
  type: AITaskType;
  context?: string; // Additional context (e.g., previous messages for chat)
  options?: {
    temperature?: number;
    max_tokens?: number;
  };
}

export interface AIResponse {
  success: boolean;
  answer?: string;
  model?: string;
  type?: AITaskType;
  error?: string;
}

// AI model mapping optimized for quality/cost on Cloudflare Workers AI.
// Mistral Small 3.1 24B is a stronger current general model with long context.
// Kimi K2.7 Code is used only for coding tasks where stronger reasoning/code generation matters.
export const AI_MODELS = {
  mcq: "@cf/mistralai/mistral-small-3.1-24b-instruct",
  coding: "@cf/qwen/qwen2.5-coder-32b-instruct",
  chat: "@cf/mistralai/mistral-small-3.1-24b-instruct",
  nptel: "@cf/mistralai/mistral-small-3.1-24b-instruct",
  solve: "@cf/mistralai/mistral-small-3.1-24b-instruct",
} as const;
