import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Env } from "./types";
import { AI_MODELS } from "./types";
import authRoutes from "./routes/auth";
import accountRoutes from "./routes/account";
import aiRoutes from "./routes/ai";
import { authMiddleware } from "./middleware/auth";

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["*"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

// Health check
app.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "neopass-api",
    version: "1.0.0",
    environment: c.env.ENVIRONMENT,
  });
});

// Routes
app.route("/api/auth", authRoutes);
app.route("/api/account", accountRoutes);
app.route("/api/ai", aiRoutes);

// Compatibility routes for legacy extension endpoints
app.post("/api/pro-text", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const prompt = body.prompt || body.text || "";

    const lowerPrompt = prompt.toLowerCase();
    const isCodingTask =
      lowerPrompt.includes("code") ||
      lowerPrompt.includes("program") ||
      lowerPrompt.includes("debug") ||
      lowerPrompt.includes("java") ||
      lowerPrompt.includes("python") ||
      lowerPrompt.includes("javascript") ||
      lowerPrompt.includes("c++") ||
      lowerPrompt.includes("algorithm");
    const model = isCodingTask ? AI_MODELS.coding : AI_MODELS.solve;

    // Call the cheapest suitable model for the task.
    const response = (await c.env.AI.run(model as any, {
      messages: [
        {
          role: "system",
          content: "You are an expert problem solver. Provide clear, accurate solutions.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    })) as any;

    const answer = response.choices?.[0]?.message?.content || response.response || "";

    return c.json({
      success: true,
      text: answer.trim(),
    });
  } catch (error: any) {
    console.error("Pro-text error:", error);
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500,
    );
  }
});

app.post("/api/pro-chat", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const messages = body.messages || [{ role: "user", content: body.prompt || "" }];

    const response = (await c.env.AI.run(AI_MODELS.chat as any, {
      messages: [
        { role: "system", content: "You are NeoPass, a helpful AI assistant for students." },
        ...messages,
      ],
      max_tokens: 2048,
      temperature: 0.7,
    })) as any;

    const answer = response.choices?.[0]?.message?.content || response.response || "";

    return c.json({
      success: true,
      content: answer.trim(),
    });
  } catch (error: any) {
    console.error("Pro-chat error:", error);
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500,
    );
  }
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: "Not Found",
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404,
  );
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      success: false,
      error: "Internal Server Error",
      message: c.env.ENVIRONMENT === "production" ? "Something went wrong" : err.message,
    },
    500,
  );
});

export default app;
