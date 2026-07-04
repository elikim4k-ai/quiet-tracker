import nodemailer from 'nodemailer';

export function smtpConfigured(settings) {
  return Boolean(settings.smtp?.host && settings.smtp?.user);
}

export async function sendEmail(settings, { to, subject, body }) {
  const { smtp } = settings;
  if (!smtpConfigured(settings)) throw new Error('SMTP not configured. Add SMTP settings first.');
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port) || 587,
    secure: Number(smtp.port) === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  await transporter.sendMail({ from: smtp.from || smtp.user, to, subject, text: body });
}
