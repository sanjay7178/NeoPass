import { Hono } from "hono";
import type { Env, AIRequest, AIResponse, AITaskType } from "../types";
import { AI_MODELS } from "../types";
import { authMiddleware } from "../middleware/auth";

const ai = new Hono<{ Bindings: Env }>();

// System prompts optimized for each task type
const SYSTEM_PROMPTS: Record<AITaskType, string> = {
  mcq: `You are an expert at solving multiple-choice questions. Given the question and options, analyze each option carefully and provide the correct answer.

Rules:
- Think step by step before answering
- Return ONLY the correct option letter (A, B, C, or D) followed by a brief explanation
- If you're uncertain, state your best guess clearly
- Be concise - no unnecessary elaboration`,

  nptel: `You are an NPTEL course expert. Answer the given NPTEL assignment question accurately.

Rules:
- Focus on the specific subject matter
- Return the correct option letter followed by a brief explanation
- NPTEL questions often test specific concepts from the course material
- Be precise and academic in your response`,

  coding: `You are a senior software engineer. Write clean, efficient, and correct code to solve the given problem.

Rules:
- Write complete, working code - no placeholders
- Include necessary imports
- Add brief comments for complex logic only
- Handle edge cases
- Use optimal time/space complexity
- If the language is specified, use it. Otherwise, default to Python or JavaScript
- Return the code in a fenced code block with the language specified`,

  chat: `You are NeoPass, a helpful AI assistant for students taking online exams and courses.

Rules:
- Be concise and direct
- Help with exam questions, coding problems, and course material
- Format responses clearly using markdown when helpful
- For code, always use fenced code blocks with language tags
- Be accurate - if unsure, say so`,

  solve: `You are an expert problem solver. Analyze the given question carefully and provide a clear, accurate solution.

Rules:
- Break down complex problems into steps
- Show your reasoning
- Be concise but thorough
- For MCQs, return the option letter
- For coding, provide complete working code
- For explanations, be clear and structured`,
};

// Rate limiting check using KV
async function checkRateLimit(
  env: Env,
  username: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:${username}:${new Date().toISOString().slice(0, 13)}`; // hourly bucket
  const current = parseInt((await env.USERS.get(key)) || "0");
  const limit = 50; // 50 requests per hour (free tier safe)

  if (current >= limit) {
    return { allowed: false, remaining: 0 };
  }

  await env.USERS.put(key, String(current + 1), { expirationTtl: 3600 });
  return { allowed: true, remaining: limit - current - 1 };
}

// POST /api/ai/solve - Main AI endpoint
ai.post("/solve", authMiddleware, async (c) => {
  try {
    const payload = c.get("userPayload");
    const username = payload.sub;

    // Check rate limit
    const rateLimit = await checkRateLimit(c.env, username);
    if (!rateLimit.allowed) {
      return c.json<AIResponse>(
        {
          success: false,
          error: "Rate limit exceeded",
        },
        429,
      );
    }

    const body = await c.req.json<AIRequest>();
    const { prompt, type, context, options } = body;

    if (!prompt || !type) {
      return c.json<AIResponse>(
        {
          success: false,
          error: "Missing required fields: prompt and type",
        },
        400,
      );
    }

    // Validate task type
    const validTypes: AITaskType[] = ["mcq", "coding", "chat", "nptel", "solve"];
    if (!validTypes.includes(type)) {
      return c.json<AIResponse>(
        {
          success: false,
          error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
        },
        400,
      );
    }

    // Select model based on task type (all free tier)
    const model = AI_MODELS[type];
    const systemPrompt = SYSTEM_PROMPTS[type];

    // Build messages array
    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add context for chat conversations
    if (type === "chat" && context) {
      messages.push({ role: "user", content: context });
    }

    messages.push({ role: "user", content: prompt });

    // Call Cloudflare Workers AI
    const response = (await c.env.AI.run(model as any, {
      messages,
      max_tokens: options?.max_tokens || (type === "coding" ? 4096 : 1024),
      temperature: options?.temperature ?? (type === "coding" ? 0.2 : 0.7),
    })) as any;

    // Extract answer from response (Workers AI returns different formats)
    const answer =
      response.choices?.[0]?.message?.content || response.response || response.text || "";

    return c.json<AIResponse>({
      success: true,
      answer: answer.trim(),
      model,
      type,
    });
  } catch (error: any) {
    console.error("AI solve error:", error);
    return c.json<AIResponse>(
      {
        success: false,
        error: error.message || "Failed to process AI request",
      },
      500,
    );
  }
});

// POST /api/ai/chat - Chat endpoint with conversation history
ai.post("/chat", authMiddleware, async (c) => {
  try {
    const payload = c.get("userPayload");
    const username = payload.sub;

    const rateLimit = await checkRateLimit(c.env, username);
    if (!rateLimit.allowed) {
      return c.json<AIResponse>(
        {
          success: false,
          error: "Rate limit exceeded",
        },
        429,
      );
    }

    const body = await c.req.json<{
      messages: { role: string; content: string }[];
      max_tokens?: number;
    }>();

    if (!body.messages || !Array.isArray(body.messages)) {
      return c.json<AIResponse>(
        {
          success: false,
          error: "Missing required field: messages (array)",
        },
        400,
      );
    }

    // Prepend system prompt
    const allMessages = [{ role: "system", content: SYSTEM_PROMPTS.chat }, ...body.messages];

    const response = (await c.env.AI.run(AI_MODELS.chat as any, {
      messages: allMessages,
      max_tokens: body.max_tokens || 2048,
      temperature: 0.7,
    })) as any;

    const answer =
      response.choices?.[0]?.message?.content || response.response || response.text || "";

    return c.json<AIResponse>({
      success: true,
      answer: answer.trim(),
      model: AI_MODELS.chat,
      type: "chat",
    });
  } catch (error: any) {
    console.error("AI chat error:", error);
    return c.json<AIResponse>(
      {
        success: false,
        error: error.message || "Failed to process chat request",
      },
      500,
    );
  }
});

// GET /api/ai/models - List available models (no auth required)
ai.get("/models", (c) => {
  return c.json({
    success: true,
    models: Object.entries(AI_MODELS).map(([type, model]) => ({
      type,
      model,
      provider: "cloudflare-workers-ai",
      tier: "free",
    })),
  });
});

export default ai;
