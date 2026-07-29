import { randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { HttpError } from '../../utils/httpError.js';

const INVITE_TTL_SECONDS = 48 * 60 * 60;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function makeInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createWaitlistEntry(input: {
  email: string;
  companyName: string;
  phone?: string;
  fleetSize?: number;
  notes?: string;
  referral?: string;
}) {
  const email = normalizeEmail(input.email);

  return prisma.waitlist.upsert({
    where: { email },
    update: {
      companyName: input.companyName,
      phone: input.phone,
      fleetSize: input.fleetSize,
      notes: input.notes,
      referral: input.referral
    },
    create: {
      email,
      companyName: input.companyName,
      phone: input.phone,
      fleetSize: input.fleetSize,
      notes: input.notes,
      referral: input.referral
    }
  });
}

export async function listWaitlistEntries(input: {
  status?: 'PENDING' | 'INVITED' | 'CONVERTED' | 'REJECTED';
  page: number;
  limit: number;
}) {
  const skip = (input.page - 1) * input.limit;
  const where = input.status ? { status: input.status } : {};

  const [items, total] = await Promise.all([
    prisma.waitlist.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: input.limit
    }),
    prisma.waitlist.count({ where })
  ]);

  return {
    items,
    page: input.page,
    limit: input.limit,
    total
  };
}

export async function inviteWaitlistEntry(id: string) {
  const entry = await prisma.waitlist.findUnique({ where: { id } });

  if (!entry) {
    throw new HttpError(404, 'Waitlist entry not found', 'WAITLIST_NOT_FOUND');
  }

  if (entry.status === 'CONVERTED') {
    throw new HttpError(409, 'Waitlist entry has already been converted', 'WAITLIST_ALREADY_CONVERTED');
  }

  const token = makeInviteToken();

  await redis.set(
    `onboarding:invite:${token}`,
    JSON.stringify({
      waitlistId: entry.id,
      email: entry.email,
      companyName: entry.companyName
    }),
    'EX',
    INVITE_TTL_SECONDS
  );

  const updated = await prisma.waitlist.update({
    where: { id },
    data: {
      status: 'INVITED',
      invitedAt: new Date()
    }
  });

  return {
    waitlist: updated,
    token,
    expiresInSeconds: INVITE_TTL_SECONDS
  };
}
