import nodemailer from "nodemailer";

interface EmailAttachment {
  filename: string;
  content: Buffer;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  attachment?: EmailAttachment;
}

/**
 * SMTP 経由でメールを送信します。
 * SMTP_HOST が未設定の場合は送信をスキップします（開発環境対応）。
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) return;

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: options.to,
    subject: options.subject,
    text: options.text,
    ...(options.attachment
      ? {
          attachments: [
            {
              filename: options.attachment.filename,
              content: options.attachment.content,
            },
          ],
        }
      : {}),
  });
}
