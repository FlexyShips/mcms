import type { Request, Response } from 'express';

export function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;

  if (!header) return undefined;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;

    const key = part.slice(0, separator).trim();
    if (key !== name) continue;

    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return undefined;
}

export function getFirstCookie(req: Request, names: string[]): string | undefined {
  for (const name of names) {
    const value = getCookie(req, name);
    if (value) return value;
  }

  return undefined;
}

export function setCookie(
  res: Response,
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    maxAge?: number;
    sameSite?: 'Lax' | 'Strict' | 'None';
    secure?: boolean;
  } = {},
): void {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/'];

  if (options.httpOnly) parts.push('HttpOnly');
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push('Secure');

  res.append('Set-Cookie', parts.join('; '));
}
