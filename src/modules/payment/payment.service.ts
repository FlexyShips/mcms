import { env } from "../../config/env.js";
import { BillingCycle } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/httpError.js";

async function createCheckoutSession(input: {
  email: string;
  plan: string;
  billingCycle: BillingCycle;
  signupReference?: string;
  companyName: string;
  slug: string;
  provider: "paystack" | "flutterwave";
  fullName?: string;
  amountKobo: number;
  planCode: string;
  type: "signup" | "renewal";
}): Promise<{ checkoutUrl: string; reference: string }> {
  const reference = `${input.signupReference}`;

  const body = {
    email: input.email,
    amount: input.amountKobo,
    currency: "NGN",
    plan: input.planCode,
    reference,
    metadata: {
      signupReference: input.signupReference,
      planName: input.plan,
      billingCycle: input.billingCycle,
      companyName: input.companyName,
      slug: input.slug,
      type: input.type,
    },
    callback_url: `${env.APP_URL}api/v1/signup/callback`,
    notify_url: `${env.APP_URL}/api/v1/webhooks/paystack`,
  };

  const response = await fetch(
    "https://api.paystack.co/transaction/initialize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(`Paystack initialization failed: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    data: { authorization_url: string };
  };
  return { checkoutUrl: data.data.authorization_url, reference };
}

export async function cancelSubscriptionOnPaymentGateway(
  tenantId: string,
): Promise<{
  status: boolean;
  message: string;
}> {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
  });
  if (!subscription) {
    throw new HttpError(404, "Subscription not found");
  }
  const latestPayment = await prisma.payment.findFirst({
    where: { subscription: { id: subscription.id } },
  });

  if (!latestPayment) {
    throw new HttpError(404, "No payment found for this subscription");
  }

  const response = await fetch("https://api.paystack.co/subscription/disable", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: latestPayment.subscriptionCode,
      token: latestPayment.emailToken,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Failed to cancel payment on Paystack: ${await response.text()}`,
    );
  }

  return data as { status: boolean; message: string };
}

export const paymentService = {
  createCheckoutSession,
  cancelSubscriptionOnPaymentGateway,
};
