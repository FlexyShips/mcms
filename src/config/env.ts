import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32).optional().or(z.literal("")),
  JWT_REFRESH_SECRET: z.string().min(32).optional().or(z.literal("")),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  S3_BUCKET: z.string().optional().or(z.literal("")),
  S3_REGION: z.string().optional().or(z.literal("")),
  AWS_ACCESS_KEY_ID: z.string().optional().or(z.literal("")),
  AWS_SECRET_ACCESS_KEY: z.string().optional().or(z.literal("")),
  S3_ENDPOINT: z.string().optional().or(z.literal("")),
  CLOUDINARY_CLOUD_NAME: z.string().optional().or(z.literal("")),
  CLOUDINARY_API_KEY: z.string().optional().or(z.literal("")),
  CLOUDINARY_API_SECRET: z.string().optional().or(z.literal("")),

  PAYSTACK_SECRET_KEY: z.string().optional().or(z.literal("")),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),
  FLUTTERWAVE_SECRET_KEY: z.string().optional().or(z.literal("")),
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),

  SES_REGION: z.string().optional().or(z.literal("")),
  SES_FROM_EMAIL: z.string().email().optional().or(z.literal("")),
  SMTP_HOST: z.string().optional().or(z.literal("")),
  SMTP_PORT: z.coerce.number().int().positive().optional().or(z.literal("")),
  SMTP_USER: z.string().optional().or(z.literal("")),
  SMTP_PASS: z.string().optional().or(z.literal("")),

  TERMII_API_KEY: z.string().optional().or(z.literal("")),
  TERMII_FROM: z.string().default("MCDMS"),

  WHATSAPP_TOKEN: z.string().optional().or(z.literal("")),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().or(z.literal("")),

  AI_PROVIDER: z.enum(["openai", "anthropic", "gemini"]).default("openai"),
  OPENAI_API_KEY: z.string().optional().or(z.literal("")),
  ANTHROPIC_API_KEY: z.string().optional().or(z.literal("")),
  AI_MODEL: z.string().default("gpt-4o"),

  APP_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_URL: z.string().url().default("http://localhost:3000/admin"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment configuration",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;
