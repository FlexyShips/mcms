import { env } from '../../config/env.js';
import htmlEscape from '../../utils/htmlEscape.js';

export function emailTemplateWrapper(input: { content: string; title?: string }): string {
  const title = input.title ?? 'FlexyShips';
  const logoUrl = new URL('/images/logo.png', env.APP_URL).toString();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${htmlEscape(title)}</title>
  </head>
  <body style="margin: 0; background: #f4f7fb; color: #172033; font-family: Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f4f7fb; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background: #ffffff; border-radius: 8px; overflow: hidden;">
            <tr>
              <td style="padding: 24px 32px; text-align: right;">
                <img src="${logoUrl}" alt="FlexyShips" width="50"
                      height="40"  style="display: inline-block; width: 180px; max-width: 100%;" />
              </td>
            </tr>
            <tr>
              <td style="padding: 32px; font-size: 16px; line-height: 1.6;">
                ${input.content}
              </td>
            </tr>
            <tr>
              <td style="border-top: 1px solid #e5eaf0; padding: 24px 32px; color: #687386; font-size: 13px; line-height: 1.5;">
                <p style="margin: 0 0 8px;">The FlexyShips team</p>
                <p style="margin: 0;">This is an automated message. Please do not reply directly to this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
