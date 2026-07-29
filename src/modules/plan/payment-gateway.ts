import { env } from "../../config/env.js";
import { BillingCycle } from "../../generated/prisma/enums.js";

interface PaystackPlanInput {
  name: string;
  amount: number;
  currency: string;
  interval: "monthly" | "annually" | "quarterly" | "biannually";
}
interface PaystackPlanData {
  id: number;
  name: string;
  amount: number;
  interval: "monthly" | "quarterly" | "biannually" | "annually";
  integration: number;
  domain: "test" | "live";
  plan_code: string;
  send_invoices: boolean;
  send_sms: boolean;
  hosted_page: boolean;
  hosted_page_url?: string | null;
  hosted_page_summary?: string | null;
  currency: string;
  description?: string | null;
  invoice_limit?: number;
  migrate?: boolean;
  is_archived?: boolean;
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
}

interface PaystackPlanResponse {
  status: boolean;
  message: string;
  data: PaystackPlanData;
}
export async function createPaystackPlan(
  input: PaystackPlanInput,
): Promise<string> {
  const body = {
    name: input.name,
    amount: input.amount,
    currency: input.currency,
    interval: input.interval,
    send_sms: false,
  };

  const response = await fetch("https://api.paystack.co/plan", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Paystack plan creation failed:", error);
    throw new Error(`Paystack plan creation failed: ${error}`);
  }

  const data = (await response.json()) as PaystackPlanResponse;
  return data.data.plan_code;
}

export async function deletePaystackPlan(planCode: string): Promise<void> {
  if (!planCode) return;

  const response = await fetch(`https://api.paystack.co/plan/${planCode}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Paystack plan deletion failed:", error);
  }
}
