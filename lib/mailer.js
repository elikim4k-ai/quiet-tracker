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

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  // When an HTML signature is configured, send an HTML version too so links are clickable
  // (plain-text version stays as the fallback for text-only clients).
  const htmlSig = (settings.emailSignatureHtml || '').trim();
  const html = htmlSig
    ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(body.trimEnd())}</div><br>${htmlSig}`
    : undefined;
  await transporter.sendMail({
    from: smtp.from || smtp.user,
    to,
    subject,
    text: withSignature(settings, body),
    ...(html ? { html } : {}),
    attachments: attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.contentBase64, 'base64'),
    })),
  });
}
