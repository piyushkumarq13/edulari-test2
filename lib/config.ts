import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  APP_TIMEZONE: z.string().default("Asia/Kolkata"),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  DATA_ENCRYPTION_KEY: z.string().min(32, "must be at least 32 chars (base64 of 32 bytes)"),
  SESSION_SECRET: z.string().min(16),
  CSRF_SECRET: z.string().min(16),
  SESSION_COOKIE_NAME: z.string().default("edulari_session"),
  SESSION_LIFETIME: z.string().default("86400"),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.string().default("587").optional(),
  SMTP_SECURE: z.string().default("false").optional(),
  SMTP_AUTH: z.string().default("true").optional(),
  SMTP_USERNAME: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // Legacy aliases. The PHP config.php exposed these two names; they are still honoured so
  // an existing .env.local keeps working, but SMTP_USERNAME/SMTP_PASSWORD are canonical and
  // are what .env.example and docs/DEPLOY.md document.
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().optional(),
  SMTP_FROM_NAME: z.string().default("Edulari").optional(),
  EMAIL_DRY_RUN: z.string().default("false"),
  B2_ENDPOINT: z.string().optional(),
  B2_REGION: z.string().optional(),
  B2_BUCKET_NAME: z.string().optional(),
  B2_BUCKET_ID: z.string().optional(),
  B2_KEY_ID: z.string().optional(),
  B2_APPLICATION_KEY: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GITHUB_OAUTH_CLIENT_ID: z.string().optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().optional(),
  ACTIVE_AI_PROVIDER: z.string().default("openrouter"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_ENDPOINT: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
  OPENROUTER_SITE_NAME: z.string().default("Edulari").optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GROQ_ENDPOINT: z.string().default("https://api.groq.com/openai/v1/chat/completions"),
  NVIDIA_KIMI_API_KEY: z.string().optional(),
  NVIDIA_KIMI_ENDPOINT: z.string().optional(),
  NVIDIA_KIMI_MODEL: z.string().optional(),
  AI_REQUEST_TIMEOUT: z.string().default("10").optional(),
  AI_CONNECT_TIMEOUT: z.string().default("10").optional(),
  AI_MAX_EXEC_TIME: z.string().default("60").optional(),
  CRON_SECRET: z.string().optional(),
  REG_SESSION_COOKIE_NAME: z.string().default("edulari_reg_session"),
  ADMIN_EMAIL: z.string().email().optional(),
  TEST_QUESTION_COUNT: z.coerce.number().int().positive().default(10),
  TEST_PASS_SCORE: z.coerce.number().int().min(0).max(100).default(80),
  TEST_TOKEN_TTL_MINS: z.coerce.number().int().positive().default(30),
  AI_TOKEN_CLEANUP_INTERVAL_SECS: z.coerce.number().int().positive().default(21600),
  DRAFT_DOC_CLEANUP_INTERVAL_SECS: z.coerce.number().int().positive().default(1800),
  REJECTED_PURGE_INTERVAL_SECS: z.coerce.number().int().positive().default(18000),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // List missing/invalid NAMES only, never values.
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

export const config = loadEnv();
export type Config = z.infer<typeof envSchema>;
