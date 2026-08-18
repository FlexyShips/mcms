import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { emailTemplateWrapper } from '../templates/emails/template.email.js';
import htmlEscape from '../utils/htmlEscape.js';
import { format } from 'date-fns';

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

export async function sendNotificationTestEmail(input: {
  email: string;
  companyName: string;
}): Promise<void> {
  const from = env.SES_FROM_EMAIL || env.SMTP_USER;
  if (!from) throw new Error('SES_FROM_EMAIL or SMTP_USER must be configured');
  const content = `<p>This is a test notification for <strong>${htmlEscape(input.companyName)}</strong>.</p><p>Your email notification configuration is working correctly.</p>`;
  await getTransporter().sendMail({
    from,
    to: input.email,
    subject: 'MCDMS notification test',
    text: `This is a test notification for ${input.companyName}. Your email notification configuration is working correctly.`,
    html: emailTemplateWrapper({ title: 'Notification test', content }),
  });
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

const userRoleLabels = {
  ADMIN: 'Administrator',
  FLEET_MANAGER: 'Fleet Manager',
  MARINE_SUPERINTENDENT: 'Marine Superintendent',
  HR_MANAGER: 'HR Manager',
  CREW_MEMBER: 'Crew Member',
} as const;

export async function sendUserInvite(input: {
  email: string;
  firstName: string;
  companyName: string;
  role: keyof typeof userRoleLabels;
  inviteUrl: string;
}): Promise<void> {
  const from = env.SES_FROM_EMAIL || env.SMTP_USER;

  if (!from) {
    throw new Error('SES_FROM_EMAIL or SMTP_USER must be configured');
  }

  const firstName = htmlEscape(input.firstName);
  const companyName = htmlEscape(input.companyName);
  const role = userRoleLabels[input.role];
  const inviteUrl = htmlEscape(input.inviteUrl);
  const content = `<p>Hi ${firstName},</p><p>You have been invited to join <strong>${companyName}</strong> on FlexyShips as a <strong>${role}</strong>.</p><p>Set your password to accept the invitation and access the workspace:</p><p><a href="${inviteUrl}" style="display: inline-block; background: #0f2a43; color: #ffffff; padding: 12px 20px; border-radius: 4px; text-decoration: none;">Accept invitation</a></p><p>This invitation expires in 48 hours.</p>`;

  await getTransporter().sendMail({
    from,
    to: input.email,
    subject: `You have been invited to join ${input.companyName} on FlexyShips`,
    text: `Hi ${input.firstName},\n\nYou have been invited to join ${input.companyName} on FlexyShips as a ${role}. Accept your invitation and set your password here: ${input.inviteUrl}\n\nThis invitation expires in 48 hours.\n\nThe FlexyShips team`,
    html: emailTemplateWrapper({ title: 'You have been invited to FlexyShips', content }),
  });

  logger.info({ email: input.email, role: input.role }, 'User invitation email sent');
}

export async function sendVesselSuperintendentAssignment(input: {
  email: string;
  firstName: string;
  companyName: string;
  vesselName: string;
}): Promise<void> {
  const from = env.SES_FROM_EMAIL || env.SMTP_USER;

  if (!from) {
    throw new Error('SES_FROM_EMAIL or SMTP_USER must be configured');
  }

  const firstName = htmlEscape(input.firstName);
  const companyName = htmlEscape(input.companyName);
  const vesselName = htmlEscape(input.vesselName);
  const content = `<p>Hi ${firstName},</p><p>You have been assigned as the superintendent for <strong>${vesselName}</strong> in <strong>${companyName}</strong>.</p><p>Please sign in to review the vessel's compliance records and manage its assigned work.</p>`;

  await getTransporter().sendMail({
    from,
    to: input.email,
    subject: `You have been assigned to ${input.vesselName}`,
    text: `Hi ${input.firstName},\n\nYou have been assigned as the superintendent for ${input.vesselName} in ${input.companyName}. Please sign in to review the vessel's compliance records and manage its assigned work.\n\nThe FlexyShips team`,
    html: emailTemplateWrapper({ title: 'Vessel assignment', content }),
  });

  logger.info(
    { email: input.email, vesselName: input.vesselName },
    'Vessel superintendent assignment email sent',
  );
}

export async function sendCrewVesselAssignment(input: {
  email: string;
  firstName: string;
  companyName: string;
  vesselName: string;
  startDate: string;
  endDate?: string;
}): Promise<void> {
  const from = env.SES_FROM_EMAIL || env.SMTP_USER;

  if (!from) {
    throw new Error('SES_FROM_EMAIL or SMTP_USER must be configured');
  }

  const firstName = htmlEscape(input.firstName);
  const companyName = htmlEscape(input.companyName);
  const vesselName = htmlEscape(input.vesselName);
  const startDate = htmlEscape(format(new Date(input.startDate), 'MMMM d, yyyy'));
  const endDate = input.endDate
    ? htmlEscape(format(new Date(input.endDate), 'MMMM d, yyyy'))
    : undefined;
  const schedule = endDate ? `${startDate} to ${endDate}` : `from ${startDate}`;
  const content = `<p>Hi ${firstName},</p><p>You have been assigned to the vessel <strong>${vesselName}</strong> in <strong>${companyName}</strong>.</p><p>Your assignment starts ${startDate}${endDate ? ` and ends ${endDate}` : ''}.</p>`;

  await getTransporter().sendMail({
    from,
    to: input.email,
    subject: `You have been assigned to ${input.vesselName}`,
    text: `Hi ${input.firstName},\n\nYou have been assigned to the vessel ${input.vesselName} in ${input.companyName}, ${schedule}.\n\nThe FlexyShips team`,
    html: emailTemplateWrapper({ title: 'Vessel assignment', content }),
  });

  logger.info(
    { email: input.email, vesselName: input.vesselName },
    'Crew vessel assignment email sent',
  );
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

export async function sendVesselCertificateExpiry(input: {
  email: string;
  firstName?: string;
  companyName: string;
  vesselName: string;
  certificateName: string;
  expiresAt: string;
  daysRemaining: number;
}): Promise<void> {
  const from = env.SES_FROM_EMAIL || env.SMTP_USER;
  if (!from) throw new Error('SES_FROM_EMAIL or SMTP_USER must be configured');
  const state =
    input.daysRemaining === 0 ? 'expires today' : `expires in ${input.daysRemaining} day(s)`;
  const expiresAt = htmlEscape(format(new Date(input.expiresAt), 'MMMM d, yyyy'));
  const content = `<p>Hi ${htmlEscape(input.firstName || 'there')},</p><p>The <strong>${htmlEscape(input.certificateName)}</strong> certificate for <strong>${htmlEscape(input.vesselName)}</strong> ${state} (${expiresAt}).</p><p>Please review the vessel compliance record and start the renewal process.</p>`;
  await getTransporter().sendMail({
    from,
    to: input.email,
    subject: `Vessel certificate expiry alert: ${input.vesselName}`,
    text: `The ${input.certificateName} certificate for ${input.vesselName} ${state} (${expiresAt}). Please review the vessel compliance record and start renewal.`,
    html: emailTemplateWrapper({ title: 'Vessel certificate expiry alert', content }),
  });
}

export async function sendCrewDocumentExpiry(
  input: Parameters<typeof sendVesselCertificateExpiry>[0],
): Promise<void> {
  const from = env.SES_FROM_EMAIL || env.SMTP_USER;
  if (!from) throw new Error('SES_FROM_EMAIL or SMTP_USER must be configured');
  const state =
    input.daysRemaining === 0 ? 'expires today' : `expires in ${input.daysRemaining} day(s)`;
  const expiresAt = htmlEscape(format(new Date(input.expiresAt), 'MMMM d, yyyy'));
  const content = `<p>Hi ${htmlEscape(input.firstName || 'there')},</p><p>The <strong>${htmlEscape(input.certificateName)}</strong> document ${state} (${expiresAt}).</p><p>Please review the record and start the renewal process.</p>`;
  await getTransporter().sendMail({
    from,
    to: input.email,
    subject: `Crew document expiry alert: ${input.certificateName}`,
    text: `The ${input.certificateName} document ${state} (${expiresAt}). Please review the record and start renewal.`,
    html: emailTemplateWrapper({ title: 'Crew document expiry alert', content }),
  });
}
