import { z } from "zod";

const reservedSlugs = [
  "www",
  "api",
  "admin",
  "app",
  "mail",
  "mcdms",
  "ene",
  "staging",
  "localhost",
];

export const createSignupSchema = z.object({
  fullName: z.string().min(2).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  companyName: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase letters, numbers, and hyphens only",
    )
    .refine(
      (s) => !reservedSlugs.includes(s.toLowerCase()),
      `Slug cannot be reserved`,
    ),
  planId: z.string().min(1),
});

export const slugCheckSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format"),
});

export const signupReferenceSchema = z.object({
  reference: z.string().min(1),
});
