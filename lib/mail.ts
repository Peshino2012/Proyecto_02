import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

export async function sendReminderEmail(to: string, subject: string, html: string) {
  const t = getTransporter();
  if (!t) {
    console.warn("SMTP no configurado, se omite el envío de email");
    return;
  }

  await t.sendMail({
    from: process.env.SMTP_FROM ?? "Calendario <no-reply@example.com>",
    to,
    subject,
    html,
  });
}
