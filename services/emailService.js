import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

function buildBrevoConfig() {
  const user = process.env.BREVO_SMTP_LOGIN || process.env.BRAVO_SMTP_LOGIN;
  const pass = process.env.BREVO_SMTP_KEY || process.env.BRAVO_SMTP_KEY;
  const host = process.env.BREVO_SMTP_SERVER || process.env.BRAVO_SMTP_SERVER || 'smtp-relay.brevo.com';
  if (!user || !pass) return null;
  return {
    host,
    port: Number(process.env.BREVO_SMTP_PORT || process.env.BRAVO_SMTP_PORT || 587),
    secure: process.env.BREVO_SMTP_SECURE === 'true' || process.env.BRAVO_SMTP_SECURE === 'true',
    auth: { user, pass }
  };
}

function buildSesConfig() {
  const region = process.env.SES_SMTP_REGION || process.env.AWS_REGION || 'ap-south-1';
  const host = process.env.SES_SMTP_HOST || `email-smtp.${region}.amazonaws.com`;
  if (!process.env.SES_SMTP_USER || !process.env.SES_SMTP_PASS) return null;
  return {
    host,
    port: Number(process.env.SES_SMTP_PORT || 587),
    secure: process.env.SES_SMTP_SECURE === 'true',
    auth: {
      user: process.env.SES_SMTP_USER,
      pass: process.env.SES_SMTP_PASS
    }
  };
}

function buildSmtpConfig() {
  if (!process.env.SMTP_HOST) return null;
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  };
}

async function deliver(config, message) {
  const transporter = nodemailer.createTransport(config);
  await transporter.sendMail(message);
}

export async function sendMail({ to, subject, text, html }) {
  const brevoConfig = buildBrevoConfig();
  const sesConfig = buildSesConfig();
  const smtpConfig = buildSmtpConfig();
  if (!brevoConfig && !sesConfig && !smtpConfig) return false;

  const message = {
    from: brevoConfig
      ? process.env.BREVO_MAIL_FROM || process.env.BRAVO_MAIL_FROM || process.env.MAIL_FROM || 'Sagenex Tickets <cambodia.agricue@gmail.com>'
      : sesConfig
        ? process.env.SES_MAIL_FROM || process.env.MAIL_FROM || 'Sagenex Tickets <cambodia.agricue@gmail.com>'
        : process.env.MAIL_FROM || process.env.SES_MAIL_FROM || 'Sagenex Tickets <cambodia.agricue@gmail.com>',
    to,
    subject,
    text,
    html
  };

  try {
    await deliver(brevoConfig || sesConfig || smtpConfig, message);
    return true;
  } catch (error) {
    const fallbacks = [sesConfig, smtpConfig].filter(Boolean);
    for (const fallback of fallbacks) {
      try {
        logger.error(`Primary email provider failed, trying fallback: ${error.message}`);
        await deliver(fallback, message);
        return true;
      } catch (fallbackError) {
        logger.error(`Email fallback failed: ${fallbackError.message}`);
      }
    }
    logger.error(`Email failed: ${error.message}`);
    return false;
  }
}
