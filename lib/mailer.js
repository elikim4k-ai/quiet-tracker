import nodemailer from 'nodemailer';

export function smtpConfigured(settings) {
  return Boolean(settings.smtp?.host && settings.smtp?.user);
}

// Appends the configured signature (if any) unless the body already contains it.
export function withSignature(settings, body) {
  const sig = (settings.emailSignature || '').trim();
  if (!sig || body.includes(sig)) return body;
  return `${body.trimEnd()}\n\n${sig}`;
}

export async function sendEmail(settings, { to, subject, body, attachments = [] }) {
  const { smtp } = settings;
  if (!smtpConfigured(settings)) throw new Error('SMTP not configured. Add SMTP settings first.');
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port) || 587,
    secure: Number(smtp.port) === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  await transporter.sendMail({
    from: smtp.from || smtp.user,
    to,
    subject,
    text: withSignature(settings, body),
    attachments: attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.contentBase64, 'base64'),
    })),
  });
}
