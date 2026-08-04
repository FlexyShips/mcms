import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { emailTemplateWrapper } from '../templates/emails/template.email.js';
import htmlEscape from '../utils/htmlEscape.js';

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (!env.SMTP_HOST) {
    throw new Error('SMTP_HOST is not configured');
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: (env.SMTP_PORT || 587) === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }

  return transporter;
}

export async function sendWaitlistAcknowledgement(input: {
  email: string;
  name: string;
  companyName: string;
}): Promise<void> {
  const from = env.SES_FROM_EMAIL || env.SMTP_USER;

  if (!from) {
    throw new Error('SES_FROM_EMAIL or SMTP_USER must be configured');
  }

  const name = htmlEscape(input.name);
  const companyName = htmlEscape(input.companyName);
  const content = `<p>Hi ${name},</p><p>Thanks for your interest in FlexyShips. We have added <strong>${htmlEscape(input.email)}</strong> to the waitlist for <strong>${companyName}</strong>.</p><p>We will be in touch when access is available.</p>`;

  await getTransporter().sendMail({
    from,
    to: input.email,
    subject: 'You have been added to the FlexyShips waitlist',
    text: `Hi ${input.name},\n\nThanks for your interest in FlexyShips. We have added ${input.email} to the waitlist for ${input.companyName}. We will be in touch when access is available.\n\nThe FlexyShips team`,
    html: emailTemplateWrapper({
      title: 'Wait List Acknowledgement',
      content,
    }),
  });

  logger.info({ email: input.email }, 'Waitlist acknowledgement email sent');
}

export async function sendWaitlistLaunchAnnouncement(input: {
  email: string;
  name: string;
  companyName: string;
}): Promise<void> {
  const from = env.SES_FROM_EMAIL || env.SMTP_USER;

  if (!from) {
    throw new Error('SES_FROM_EMAIL or SMTP_USER must be configured');
  }

  const name = htmlEscape(input.name);
  const companyName = htmlEscape(input.companyName);
  const launchUrl = new URL('/', env.APP_URL).toString();
  const content = `<p>Hi ${name},</p><p>We are excited to let you know that FlexyShips has officially launched.</p><p>Thank you for joining the waitlist for <strong>${companyName}</strong>. You can now explore FlexyShips and get started.</p><p><a href="${launchUrl}" style="display: inline-block; background: #0f2a43; color: #ffffff; padding: 12px 20px; border-radius: 4px; text-decoration: none;">Visit FlexyShips</a></p>`;

  await getTransporter().sendMail({
    from,
    to: input.email,
    subject: 'FlexyShips has officially launched',
    text: `Hi ${input.name},\n\nFlexyShips has officially launched. Thank you for joining the waitlist for ${input.companyName}. You can now explore FlexyShips at ${launchUrl}\n\nThe FlexyShips team`,
    html: emailTemplateWrapper({
      title: 'FlexyShips has launched',
      content,
    }),
  });

  logger.info({ email: input.email }, 'Waitlist launch announcement sent');
}

export async function sendTenantWelcome(input: {
  email: string;
  fullName: string;
  companyName: string;
  url: string;
}): Promise<void> {
  const from = env.SES_FROM_EMAIL || env.SMTP_USER;

  if (!from) {
    throw new Error('SES_FROM_EMAIL or SMTP_USER must be configured');
  }

  const fullName = htmlEscape(input.fullName);
  const companyName = htmlEscape(input.companyName);
  const url = htmlEscape(input.url);
  const content = `<p>Hi ${fullName},</p><p>Welcome to FlexyShips. Your workspace for <strong>${companyName}</strong> is ready.</p><p><a href="${url}" style="display: inline-block; background: #0f2a43; color: #ffffff; padding: 12px 20px; border-radius: 4px; text-decoration: none;">Open your workspace</a></p>`;

  await getTransporter().sendMail({
    from,
    to: input.email,
    subject: 'Welcome to FlexyShips',
    text: `Hi ${input.fullName},\n\nWelcome to FlexyShips. Your workspace for ${input.companyName} is ready. Open it here: ${input.url}\n\nThe FlexyShips team`,
    html: emailTemplateWrapper({ title: 'Welcome to FlexyShips', content }),
  });

  logger.info({ email: input.email }, 'Tenant welcome email sent');
}

export async function sendSignupPayment(input: {
  email: string;
  fullName: string;
  companyName: string;
  checkoutUrl: string;
}): Promise<void> {
  const from = env.SES_FROM_EMAIL || env.SMTP_USER;

  if (!from) {
    throw new Error('SES_FROM_EMAIL or SMTP_USER must be configured');
  }

  const fullName = htmlEscape(input.fullName);
  const companyName = htmlEscape(input.companyName);
  const checkoutUrl = htmlEscape(input.checkoutUrl);
  const content = `<p>Hi ${fullName},</p><p>Thanks for signing up for FlexyShips for <strong>${companyName}</strong>.</p><p>Complete your payment to activate your workspace:</p><p><a href="${checkoutUrl}" style="display: inline-block; background: #0f2a43; color: #ffffff; padding: 12px 20px; border-radius: 4px; text-decoration: none;">Complete payment</a></p>`;

  await getTransporter().sendMail({
    from,
    to: input.email,
    subject: 'Complete your FlexyShips signup',
    text: `Hi ${input.fullName},\n\nThanks for signing up for FlexyShips for ${input.companyName}. Complete your payment to activate your workspace: ${input.checkoutUrl}\n\nThe FlexyShips team`,
    html: emailTemplateWrapper({ title: 'Complete your FlexyShips signup', content }),
  });

  logger.info({ email: input.email }, 'Signup payment email sent');
}
