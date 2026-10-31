import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

let transporter = null;

/**
 * Configure and get reusable Nodemailer transporter
 */
export const getEmailTransporter = () => {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    // Check if credentials are placeholders or in automated test mode
    const isPlaceholderCredentials =
      !host ||
      !user ||
      !pass ||
      user === 'your_smtp_user' ||
      user === 'test_smtp_user' ||
      pass === 'your_smtp_password' ||
      pass === 'test_smtp_password';

    if (isPlaceholderCredentials || process.env.NODE_ENV === 'test') {
      // Create mock transporter for test/dev when SMTP credentials are not configured or are placeholders
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      logger.info('SMTP in mock mode (placeholder credentials or test environment). Dispatches handled safely.');
    } else {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      });

      // Verify connection asynchronously without blocking startup
      transporter.verify((err) => {
        if (err) {
          logger.warn(`SMTP Verification Notice: ${err.message}. Email alerts will be queued gracefully.`);
        } else {
          logger.success(`SMTP Server Connected: Ready to dispatch emails via ${host}:${port}`);
        }
      });
    }
  }
  return transporter;
};

/**
 * Reset transporter (useful for automated testing)
 */
export const resetTransporter = () => {
  transporter = null;
};

/**
 * Send an email notification with error insulation
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    if (!to) {
      logger.warn('Email delivery aborted: No recipient address specified.');
      return null;
    }

    const client = getEmailTransporter();
    const from =
      process.env.EMAIL_FROM ||
      process.env.SMTP_FROM ||
      '"TaskPulse Enterprise" <noreply@taskpulse.com>';

    const mailOptions = {
      from,
      to,
      subject,
      text: text || html.replace(/<[^>]+>/g, ''),
      html,
    };

    const info = await client.sendMail(mailOptions);
    logger.success(`Email dispatched successfully to ${to}: ${info.messageId || 'mock-id'}`);
    return info;
  } catch (error) {
    logger.error(`Failed to dispatch email to ${to}: ${error.message}`);
    // Non-blocking: failures must never roll back database changes
    return null;
  }
};

/**
 * Professional HTML Template: Task Assignment Email
 */
export const generateTaskAssignmentHtml = ({
  recipientName = 'Team Member',
  taskTitle = '',
  taskDescription = '',
  priority = 'medium',
  dueDate = null,
  assignedByName = 'Workspace Manager',
  taskUrl = 'http://localhost:5173/tasks',
}) => {
  const priorityColors = {
    low: '#94a3b8',
    medium: '#38bdf8',
    high: '#f43f5e',
  };

  const badgeColor = priorityColors[priority] || '#38bdf8';
  const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'None specified';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f1f5f9; margin: 0; padding: 24px; }
        .container { max-width: 580px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; }
        .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 28px 32px; }
        .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
        .content { padding: 32px; }
        .task-card { background: #1e293b; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #334155; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .btn { display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 16px; }
        .footer { padding: 20px 32px; background: #0b1120; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>TaskPulse Enterprise</h1>
        </div>
        <div class="content">
          <p style="font-size: 15px; margin-top: 0;">Hello <strong>${recipientName}</strong>,</p>
          <p style="color: #94a3b8; font-size: 14px;">You have been assigned a new task by <strong>${assignedByName}</strong>.</p>

          <div class="task-card">
            <div style="margin-bottom: 12px;">
              <span class="badge" style="background-color: ${badgeColor}20; color: ${badgeColor}; border: 1px solid ${badgeColor}40;">
                ${priority.toUpperCase()} PRIORITY
              </span>
            </div>
            <h2 style="margin: 0 0 10px 0; color: #f8fafc; font-size: 18px;">${taskTitle}</h2>
            ${taskDescription ? `<p style="margin: 0 0 16px 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">${taskDescription}</p>` : ''}
            <div style="font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 12px;">
              <strong>Due Date:</strong> <span style="color: #cbd5e1;">${formattedDueDate}</span>
            </div>
          </div>

          <a href="${taskUrl}" class="btn">View Task in TaskPulse</a>
        </div>
        <div class="footer">
          This is an automated workflow notification from TaskPulse.
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Professional HTML Template: Task Update Email
 */
export const generateTaskUpdateHtml = ({
  recipientName = 'Team Member',
  taskTitle = '',
  changeSummary = 'Task details have been updated.',
  updatedStatus = null,
  updatedPriority = null,
  updatedDueDate = null,
  updatedByName = 'Workspace Collaborator',
  taskUrl = 'http://localhost:5173/tasks',
}) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f1f5f9; margin: 0; padding: 24px; }
        .container { max-width: 580px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; }
        .header { background: linear-gradient(135deg, #0ea5e9, #6366f1); padding: 28px 32px; }
        .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
        .content { padding: 32px; }
        .summary-box { background: #1e293b; border-left: 4px solid #38bdf8; padding: 16px 20px; border-radius: 4px 8px 8px 4px; margin: 20px 0; }
        .details-list { font-size: 13px; color: #94a3b8; margin: 16px 0; }
        .details-list li { margin-bottom: 6px; }
        .btn { display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 16px; }
        .footer { padding: 20px 32px; background: #0b1120; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>TaskPulse Update Alert</h1>
        </div>
        <div class="content">
          <p style="font-size: 15px; margin-top: 0;">Hello <strong>${recipientName}</strong>,</p>
          <p style="color: #94a3b8; font-size: 14px;"><strong>${updatedByName}</strong> made an update to an assigned task:</p>

          <h2 style="margin: 16px 0 8px 0; color: #f8fafc; font-size: 18px;">${taskTitle}</h2>

          <div class="summary-box">
            <strong style="color: #38bdf8; font-size: 13px; display: block; margin-bottom: 4px;">Update Summary:</strong>
            <span style="font-size: 14px; color: #f1f5f9;">${changeSummary}</span>
          </div>

          <ul class="details-list">
            ${updatedStatus ? `<li><strong>Current Status:</strong> <span style="color: #38bdf8; text-transform: capitalize;">${updatedStatus}</span></li>` : ''}
            ${updatedPriority ? `<li><strong>Current Priority:</strong> <span style="color: #f43f5e; text-transform: capitalize;">${updatedPriority}</span></li>` : ''}
            ${updatedDueDate ? `<li><strong>Due Date:</strong> ${new Date(updatedDueDate).toLocaleDateString()}</li>` : ''}
          </ul>

          <a href="${taskUrl}" class="btn">View Task in TaskPulse</a>
        </div>
        <div class="footer">
          This is an automated workflow notification from TaskPulse.
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Dispatch task assignment email asynchronously (non-blocking)
 */
export const sendTaskAssignmentEmail = async ({ to, recipientName, task, assignedByName }) => {
  const taskUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/tasks`;
  const subject = `[TaskPulse] New Task Assigned: ${task.title}`;
  const html = generateTaskAssignmentHtml({
    recipientName,
    taskTitle: task.title,
    taskDescription: task.description,
    priority: task.priority,
    dueDate: task.dueDate,
    assignedByName,
    taskUrl,
  });

  return sendEmail({ to, subject, html });
};

/**
 * Dispatch task update email asynchronously (non-blocking)
 */
export const sendTaskUpdateEmail = async ({
  to,
  recipientName,
  task,
  changeSummary,
  updatedByName,
  updatedStatus = null,
  updatedPriority = null,
  updatedDueDate = null,
}) => {
  const taskUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/tasks`;
  const subject = `[TaskPulse] Task Updated: ${task.title}`;
  const html = generateTaskUpdateHtml({
    recipientName,
    taskTitle: task.title,
    changeSummary,
    updatedStatus,
    updatedPriority,
    updatedDueDate,
    updatedByName,
    taskUrl,
  });

  return sendEmail({ to, subject, html });
};

export default {
  getEmailTransporter,
  resetTransporter,
  sendEmail,
  generateTaskAssignmentHtml,
  generateTaskUpdateHtml,
  sendTaskAssignmentEmail,
  sendTaskUpdateEmail,
};
