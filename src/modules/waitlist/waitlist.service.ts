import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { emailQueue } from '../../queues/queue.js';
import { HttpError } from '../../utils/httpError.js';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createWaitlistEntry(input: {
  email: string;
  companyName: string;
  phone?: string;
  fleetSize?: number;
  notes?: string;
  referral?: string;
  name: string;
}) {
  const email = normalizeEmail(input.email);

  const data = await prisma.waitlist.upsert({
    where: { email },
    update: {
      companyName: input.companyName,
      phone: input.phone,
      fleetSize: input.fleetSize,
      notes: input.notes,
      referral: input.referral,
      name: input.name,
    },
    create: {
      email,
      companyName: input.companyName,
      phone: input.phone,
      fleetSize: input.fleetSize,
      notes: input.notes,
      referral: input.referral,
      name: input.name,
    },
  });

  await emailQueue.add(
    'waitlist.acknowledgement',
    {
      email: data.email,
      name: data.name,
      companyName: data.companyName,
    },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    },
  );

  return data;
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
      take: input.limit,
    }),
    prisma.waitlist.count({ where }),
  ]);

  return {
    items,
    page: input.page,
    limit: input.limit,
    total,
  };
}

export async function queuePendingWaitlistLaunchAnnouncement() {
  const entries = await prisma.waitlist.findMany({
    where: { status: 'PENDING' },
    select: {
      id: true,
      email: true,
      name: true,
      companyName: true,
    },
  });

  if (entries.length === 0) {
    return { campaignId: null, queued: 0 };
  }

  const campaignId = randomUUID();
  const jobs = await emailQueue.addBulk(
    entries.map((entry) => ({
      name: 'waitlist.product-launch',
      data: {
        campaignId,
        email: entry.email,
        name: entry.name,
        companyName: entry.companyName,
      },
      opts: {
        jobId: `waitlist-product-launch-${campaignId}-${entry.id}`,
        attempts: 3,
        backoff: { type: 'exponential' as const, delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    })),
  );

  return { campaignId, queued: jobs.length };
}

export async function inviteWaitlistEntry(id: string) {
  const entry = await prisma.waitlist.findUnique({ where: { id } });

  if (!entry) {
    throw new HttpError(404, 'Waitlist entry not found', 'WAITLIST_NOT_FOUND');
  }

  if (entry.status === 'CONVERTED') {
    throw new HttpError(
      409,
      'Waitlist entry has already been converted',
      'WAITLIST_ALREADY_CONVERTED',
    );
  }

  const campaignId = randomUUID();
  await emailQueue.addBulk(
    [entry].map((entry) => ({
      name: 'waitlist.product-launch',
      data: {
        campaignId,
        email: entry.email,
        name: entry.name,
        companyName: entry.companyName,
      },
      opts: {
        jobId: `waitlist-product-launch-${campaignId}-${entry.id}`,
        attempts: 3,
        backoff: { type: 'exponential' as const, delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    })),
  );

  return {
    waitlist: entry,
    token: '',
    expiresInSeconds: 0,
  };
}
