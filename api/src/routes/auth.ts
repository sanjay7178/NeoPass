import { Hono } from "hono";
import { JWT } from "../utils/jwt";
import { Password } from "../utils/password";
import type { Env, UserData, LoginRequest } from "../types";

const auth = new Hono<{ Bindings: Env }>();

// POST /api/auth - Login
auth.post("/", async (c) => {
  try {
    const body = await c.req.json<LoginRequest>();
    const { username, password } = body;

    if (!username || !password) {
      return c.json(
        {
          success: false,
          message: "Username and password are required",
        },
        400,
      );
    }

    // Fetch user from KV
    const userJson = await c.env.USERS.get(`user:${username}`);

    if (!userJson) {
      return c.json(
        {
          success: false,
          message: "Invalid credentials",
        },
        401,
      );
    }

    const user: UserData = JSON.parse(userJson);

    // Verify password
    const isValidPassword = await Password.verify(password, user.passwordHash);

    if (!isValidPassword) {
      return c.json(
        {
          success: false,
          message: "Invalid credentials",
        },
        401,
      );
    }

    // Check if subscription is expired
    if (user.isPro && user.expiresAt && user.expiresAt < Date.now()) {
      return c.json(
        {
          success: false,
          message: "Your subscription has expired",
          subscriptionExpired: true,
        },
        403,
      );
    }

    // Update last login
    user.lastLogin = Date.now();
    await c.env.USERS.put(`user:${username}`, JSON.stringify(user));

    // Generate JWT token (12 hours expiry)
    const token = await JWT.sign(
      {
        sub: username,
        plan: user.plan,
      },
      c.env.JWT_SECRET,
      12 * 60 * 60, // 12 hours
    );

    // Generate refresh token (30 days expiry)
    const refreshToken = await JWT.sign(
      {
        sub: username,
        plan: user.plan,
        type: "refresh",
      },
      c.env.JWT_SECRET,
      30 * 24 * 60 * 60, // 30 days
    );

    return c.json({
      success: true,
      accessToken: token,
      refreshToken: refreshToken,
      username,
      isPro: user.isPro,
      account: {
        username: user.username,
        isPro: user.isPro,
        subscriptionPlan: user.plan,
        tokensUsed: 0,
        tokenLimit: user.isPro ? 1000 : 50,
        requestsToday: 0,
        dailyLimit: user.isPro ? 500 : 25,
      },
    });
  } catch (error) {
    console.error("Auth error:", error);
    return c.json(
      {
        success: false,
        message: "Internal server error",
      },
      500,
    );
  }
});

// POST /api/auth/register - Register new user (optional)
auth.post("/register", async (c) => {
  try {
    const body = await c.req.json<{
      username: string;
      password: string;
      email?: string;
    }>();

    const { username, password, email } = body;

    if (!username || !password) {
      return c.json(
        {
          success: false,
          message: "Username and password are required",
        },
        400,
      );
    }

    // Check if user already exists
    const existing = await c.env.USERS.get(`user:${username}`);
    if (existing) {
      return c.json(
        {
          success: false,
          message: "Username already taken",
        },
        409,
      );
    }

    // Hash password
    const passwordHash = await Password.hash(password);

    // Create user data
    const user: UserData = {
      username,
      passwordHash,
      email,
      isPro: false,
      plan: "free",
      createdAt: Date.now(),
    };

    // Store in KV
    await c.env.USERS.put(`user:${username}`, JSON.stringify(user));

    return c.json(
      {
        success: true,
        message: "User registered successfully",
        username,
      },
      201,
    );
  } catch (error) {
    console.error("Register error:", error);
    return c.json(
      {
        success: false,
        message: "Internal server error",
      },
      500,
    );
  }
});

export default auth;
