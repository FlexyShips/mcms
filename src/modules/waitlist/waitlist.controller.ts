import type { Request, Response } from 'express';
import * as waitlistService from './waitlist.service.js';

export async function create(req: Request, res: Response) {
  const waitlist = await waitlistService.createWaitlistEntry(req.body);

  res.status(201).json({ waitlist });
}

export async function list(req: Request, res: Response) {
  const result = await waitlistService.listWaitlistEntries({
    status: req.query.status as 'PENDING' | 'INVITED' | 'CONVERTED' | 'REJECTED' | undefined,
    page: Number(req.query.page),
    limit: Number(req.query.limit)
  });

  res.json(result);
}

export async function invite(req: Request, res: Response) {
  const result = await waitlistService.inviteWaitlistEntry(req.params.id);

  res.json(result);
}
