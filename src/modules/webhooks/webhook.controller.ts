import type { Request, Response } from 'express';
import * as signupService from '../signup/signup.service.js';
import { HttpError } from '../../utils/httpError.js';
import { SignupStatus, TenantStatus } from '../../generated/prisma/enums.js';
import { prisma } from '../../lib/prisma.js';
import { renewSubscription } from '../subscription/subscription.service.js';

export async function paystackWebhook(req: Request, res: Response) {
  const signature = req.headers['x-paystack-signature'] as string;

  if (!signature) {
    throw new HttpError(401, 'Missing Paystack signature', 'MISSING_SIGNATURE');
  }

  const payload = JSON.stringify(req.body);
  const expectedSignature = await verifyPaystackSignature(payload, signature);

  if (!expectedSignature) {
    throw new HttpError(401, 'Invalid Paystack signature', 'INVALID_SIGNATURE');
  }

  const event = req.body.event;
  const data = req.body.data;

  if (event === 'charge.success' && data?.status === 'success') {
    const metadata = data?.metadata as
      | {
          signupReference?: string;
          signupType?: string;
          planName?: string;
          billingCycle?: string;
          companyName?: string;
          slug?: string;
          type?: string;
          tenantId?: string;
        }
      | undefined;

    const customer = data?.customer as
      | {
          email: string;
          first_name: string;
          last_name: string;
          customer_code: string;
        }
      | undefined;
    console.log('Customer data:', customer); // Debugging line

    if (metadata?.signupReference) {
      const pendingSignup = await prisma.pendingSignup.findUnique({
        where: { reference: metadata.signupReference },
      });

      // this is where you will need to make sure you get the tenant
      try {
        if (pendingSignup?.status !== SignupStatus.AWAITING_PAYMENT) {
          await renewSubscription({
            tenantId: pendingSignup?.tenantId!,
            paymentReference: data.reference,
            subscriptionCode: data?.subscription?.subscription_code,
            emailToken: data?.subscription?.email_token,
          });
        } else {
          await signupService.completeOnboarding({
            signupReference: metadata?.signupReference!,
            paymentReference: data.reference,
            status: TenantStatus.ACTIVE,

            customerCode: customer?.customer_code,
          });
        }
        return res.json({ received: true });
      } catch (error) {
        console.error('Failed to complete onboarding:', error);
        return res.json({ received: true, error: 'onboarding_failed' });
      }
    }
  }

  // in your webhook router, alongside your charge.success handler
  if (event.event === 'subscription.create') {
    console.log('Subscription created:', event.data);
    console.log('Data:', data);
    console.log('Metadata:', data?.metadata);
    // const metadata = data?.metadata as
    //   | {
    //       signupReference?: string;
    //       signupType?: string;
    //       planName?: string;
    //       billingCycle?: string;
    //       companyName?: string;
    //       slug?: string;
    //       type?: string;
    //       tenantId?: string;
    //     }
    //   | undefined;
    // await signupService.completeOnboarding({
    //   signupReference: metadata?.signupReference!,
    //   paymentReference: data.reference,
    //   status: TenantStatus.ACTIVE,
    //   subscriptionCode: data?.subscription?.subscription_code,
    //   emailToken: data?.subscription?.email_token,
    // });
    // await prisma.payment.upsert({
    //   where: { reference: metadata?.signupReference }, // or however you key tenants
    //   create: {
    //      subscriptionCode: data?.subscription?.subscription_code,
    //           emailToken: data?.subscription?.email_token,
    //   },
    // });
  }

  res.json({ received: true });
}

async function verifyPaystackSignature(payload: string, signature: string): Promise<boolean> {
  const crypto = await import('node:crypto');
  const { env } = await import('../../config/env.js');
  const hash = crypto.createHmac('sha512', env.PAYSTACK_SECRET_KEY!).update(payload).digest('hex');

  return hash === signature;
}
