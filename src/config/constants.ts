export const API_PREFIX = "/api/v1";

export const PLAN_LIMITS = {
  TRIAL: { vesselLimit: 1 },
  STARTER: { vesselLimit: 5 },
  GROWTH: { vesselLimit: 20 },
  ENTERPRISE: { vesselLimit: Number.MAX_SAFE_INTEGER },
} as const;

export const PLAN_PRICING_KOBO = {
  TRIAL: { MONTHLY: 0, ANNUALLY: 0, QUARTERLY: 0, BIANNUALLY: 0 },
  STARTER: {
    MONTHLY: 5_000_000,
    ANNUALLY: 48_000_000,
    QUARTERLY: 12_000_000,
    BIANNUALLY: 24_000_000,
  },
  GROWTH: {
    MONTHLY: 15_000_000,
    ANNUALLY: 144_000_000,
    QUARTERLY: 36_000_000,
    BIANNUALLY: 72_000_000,
  },
  ENTERPRISE: {
    MONTHLY: 40_000_000,
    ANNUALLY: 384_000_000,
    QUARTERLY: 96_000_000,
    BIANNUALLY: 192_000_000,
  },
} as const;
