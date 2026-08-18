import { env } from '../config/env.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  BufferJSON,
  type AuthenticationState,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';

import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';

const AUTH_DIR = './auth_info';
const CREDS_PATH = path.join(AUTH_DIR, 'creds.json');

export type NotificationEvent = {
  id: string;
  tenantId: string;
  recipientId?: string;
  subject: string;
  message: string;
  certificateId?: string;
  vesselId?: string;
  vesselName?: string;
  expiresAt?: string;
  daysRemaining?: number;
};

export async function publishNotification(event: NotificationEvent) {
  await redis.publish(`tenant:notifications:${event.tenantId}`, JSON.stringify(event));
}

export async function sendSms(to: string, message: string) {
  if (!env.TERMII_API_KEY) throw new Error('TERMII_API_KEY is not configured');
  const response = await fetch('https://api.sendchamp.com/api/v1/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.TERMII_API_KEY}` },
    body: JSON.stringify({
      to,
      // from: env.TERMII_FROM,
      message: message,
      sender_name: 'FlexyShips',
      route: 'dnd',
    }),
  });
  if (!response.ok) throw new Error(`Termii returned ${response.status}`);
}

// export async function sendWhatsApp(to: string, message: string) {
//   if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID)
//     throw new Error('WhatsApp credentials are not configured');
//   const response = await fetch(
//     `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
//     {
//       method: 'POST',
//       headers: {
//         Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         messaging_product: 'whatsapp',
//         to,
//         type: 'text',
//         text: { body: message },
//       }),
//     },
//   );
//   if (!response.ok) throw new Error(`WhatsApp returned ${response.status}`);
// }

export function logDeliveryFailure(error: unknown, channel: string, recipient: string) {
  logger.error({ error, channel, recipient }, 'Notification delivery failed');
}

let sock: ReturnType<typeof makeWASocket>;

function useLightweightAuthState() {
  let creds = fs.existsSync(CREDS_PATH)
    ? JSON.parse(fs.readFileSync(CREDS_PATH, 'utf-8'), BufferJSON.reviver)
    : initAuthCreds();

  // per-chat session/sender keys live only in memory — never written to disk
  const keyStore: Record<string, unknown> = {};

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const result: Record<string, unknown> = {};
          for (const id of ids) result[id] = keyStore[`${type}-${id}`];
          return result;
        },
        set: async (data: Record<string, Record<string, unknown>>) => {
          for (const type in data) {
            for (const id in data[type]) keyStore[`${type}-${id}`] = data[type][id];
          }
        },
      },
    } as AuthenticationState,
    saveCreds: async () => {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
      fs.writeFileSync(CREDS_PATH, JSON.stringify(creds, BufferJSON.replacer, 2));
    },
  };
}

export async function initWhatsApp() {
  const { state, saveCreds } = useLightweightAuthState();
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    auth: state,
    version,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) qrcode.generate(qr, { small: true });

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log('Connection closed. Status:', statusCode, '| Reconnecting:', shouldReconnect);
      if (shouldReconnect) initWhatsApp();
    }

    if (connection === 'open') {
      console.log('WhatsApp connected successfully!');
    }
  });
}
export async function setDisplayName(name: string) {
  if (!sock) throw new Error('WhatsApp socket not initialized');
  await sock.updateProfileName(name);
}

export async function sendWhatsApp(to: string, message: string, companyName?: string) {
  if (!sock) throw new Error('WhatsApp socket not initialized');
  const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
  const formatted = `*${companyName}*\n\n${message}`;
  await sock.sendMessage(jid, { text: formatted });
}
// export async function sendWhatsApp(to: string, message: string) {
//   if (!sock) throw new Error('WhatsApp socket not initialized');
//   const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
//   await sock.sendMessage(jid, { text: message });
// }
