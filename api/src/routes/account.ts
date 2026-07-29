import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { Env, UserData } from "../types";

const account = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all account routes
account.use("*", authMiddleware);

// GET /api/account - Get account info
account.get("/", async (c) => {
  try {
    const payload = c.get("userPayload");
    const username = payload.sub;

    // Fetch user from KV
    const userJson = await c.env.USERS.get(`user:${username}`);

    if (!userJson) {
      return c.json(
        {
          success: false,
          message: "User not found",
          tokenExpired: true,
        },
        401,
      );
    }

    const user: UserData = JSON.parse(userJson);

    // Check if subscription is expired
    const isExpired = user.isPro && user.expiresAt && user.expiresAt < Date.now();

    if (isExpired) {
      // Update user status
      user.isPro = false;
      user.plan = "free";
      await c.env.USERS.put(`user:${username}`, JSON.stringify(user));

      return c.json(
        {
          success: false,
          message: "Your subscription has expired",
          subscriptionExpired: true,
        },
        403,
      );
    }

    return c.json({
      success: true,
      account: {
        username: user.username,
        isPro: user.isPro,
        subscriptionPlan: user.plan,
        tokensUsed: 0,
        tokenLimit: user.isPro ? 1000 : 50,
        requestsToday: 0,
        dailyLimit: user.isPro ? 500 : 25,
        expiresAt: user.expiresAt,
      },
    });
  } catch (error) {
    console.error("Account error:", error);
    return c.json(
      {
        success: false,
        message: "Internal server error",
      },
      500,
    );
  }
});

// GET /api/account/status - Quick status check (lighter endpoint)
account.get("/status", async (c) => {
  try {
    const payload = c.get("userPayload");
    const username = payload.sub;

    const userJson = await c.env.USERS.get(`user:${username}`);

    if (!userJson) {
      return c.json({
        success: false,
        isPro: false,
        plan: "free",
      });
    }

    const user: UserData = JSON.parse(userJson);
    const isExpired = user.isPro && user.expiresAt && user.expiresAt < Date.now();

    return c.json({
      success: true,
      isPro: user.isPro && !isExpired,
      plan: isExpired ? "free" : user.plan,
    });
  } catch (error) {
    console.error("Status error:", error);
    return c.json({
      success: false,
      isPro: false,
      plan: "free",
    });
  }
});

export default account;
