const nodemailer = require('nodemailer');

/**
 * Creates or retrieves the Nodemailer transporter for administrative alerts.
 */
function getAlertTransporter() {
  const email = (process.env.SMTP_EMAIL || '').trim();
  const rawPass = process.env.SMTP_PASS || '';

  if (!email || !rawPass.trim()) {
    return null;
  }

  const isGmail = email.toLowerCase().endsWith('@gmail.com') || (process.env.SMTP_HOST && process.env.SMTP_HOST.includes('gmail'));

  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: email,
        pass: rawPass.replace(/\s+/g, '')
      }
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: email,
      pass: rawPass.replace(/\s+/g, '')
    }
  });
}

/**
 * Sends a system or backup failure alert to the configured administration email.
 *
 * @param {Object} options
 * @param {boolean} options.success - Whether the backup or operation succeeded
 * @param {string} options.operation - Operation name (e.g. 'Database Backup')
 * @param {string} [options.filename] - Generated backup filename
 * @param {string} [options.sizeKb] - File size in KB
 * @param {string} [options.s3Location] - S3 URI (s3://bucket/key) if uploaded
 * @param {string} [options.error] - Error message if failed
 * @param {number} [options.durationMs] - Execution duration in milliseconds
 * @returns {Promise<boolean>}
 */
async function sendBackupAlert(options = {}) {
  const {
    success = false,
    operation = 'Database Backup',
    filename = 'N/A',
    sizeKb = '0',
    s3Location = null,
    error = null,
    durationMs = 0
  } = options;

  const adminAlertEmail = process.env.ADMIN_ALERT_EMAIL || process.env.ADMIN_EMAIL || process.env.SMTP_EMAIL;
  const serverHost = process.env.SERVER_HOSTNAME || process.env.DB_HOST || 'AWS-EC2';
  const timestamp = new Date().toISOString();

  // Always log structured alert to console
  const logPayload = {
    level: success ? 'info' : 'error',
    event: 'backup_alert',
    operation,
    success,
    filename,
    sizeKb,
    s3Location,
    error,
    durationMs,
    timestamp
  };

  if (!success) {
    console.error(`🚨 [CRITICAL ALERT] ${operation} FAILED:`, JSON.stringify(logPayload));
  } else {
    console.log(`ℹ️ [ALERT] ${operation} Succeeded:`, JSON.stringify(logPayload));
  }

  // Attempt email delivery if mail transporter is configured
  const transporter = getAlertTransporter();
  if (!transporter || !adminAlertEmail) {
    console.warn('⚠️ [AlertService] Admin email alert skipped: SMTP credentials or ADMIN_ALERT_EMAIL not set.');
    return false;
  }

  try {
    const statusEmoji = success ? '✅' : '🚨';
    const statusText = success ? 'SUCCESSFUL' : 'FAILED';
    const subject = `${statusEmoji} [Umanarayni Alert] ${operation} ${statusText} on ${serverHost}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: ${success ? '#2e7d32' : '#c62828'}; color: #ffffff; padding: 18px 24px;">
          <h2 style="margin: 0; font-size: 20px;">${statusEmoji} ${operation} ${statusText}</h2>
          <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Host: ${serverHost} &bull; Environment: ${process.env.NODE_ENV || 'development'}</p>
        </div>
        <div style="padding: 24px; color: #333333; line-height: 1.6;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 140px;">Timestamp:</td>
              <td style="padding: 8px 0;">${timestamp}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">File:</td>
              <td style="padding: 8px 0;"><code>${filename}</code></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Size:</td>
              <td style="padding: 8px 0;">${sizeKb} KB</td>
            </tr>
            ${s3Location ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">S3 Storage:</td>
              <td style="padding: 8px 0;"><code>${s3Location}</code> (SSE-S3 AES-256)</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Duration:</td>
              <td style="padding: 8px 0;">${(durationMs / 1000).toFixed(2)}s</td>
            </tr>
            ${!success && error ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #c62828;">Error:</td>
              <td style="padding: 8px 0; color: #c62828; font-family: monospace;">${error}</td>
            </tr>` : ''}
          </table>

          ${!success ? `
          <div style="background-color: #ffebee; border-left: 4px solid #c62828; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #b71c1c;">Recommended Immediate Action:</p>
            <ol style="margin: 8px 0 0; padding-left: 20px; font-size: 13px; color: #555;">
              <li>SSH into EC2 instance: <code>ssh ubuntu@${serverHost}</code></li>
              <li>Check disk space: <code>df -h</code></li>
              <li>Verify MySQL daemon: <code>sudo systemctl status mysql</code></li>
              <li>Run manual backup test: <code>node scripts/backup.js</code></li>
            </ol>
          </div>` : `
          <p style="font-size: 13px; color: #666;">Local copy retained in <code>backups/</code> directory with 7-day automated rolling purge.</p>
          `}
        </div>
        <div style="background-color: #f5f5f5; padding: 12px 24px; font-size: 12px; color: #777; text-align: center; border-top: 1px solid #eeeeee;">
          Umanarayni Sacred Ayurveda Automated Reliability & Monitoring System
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Umanarayni Monitoring" <${process.env.SMTP_EMAIL}>`,
      to: adminAlertEmail,
      subject,
      html
    });

    console.log(`✉️ [AlertService] Backup alert email delivered to: ${adminAlertEmail}`);
    return true;
  } catch (err) {
    console.error('❌ [AlertService] Failed to send backup alert email:', err.message);
    return false;
  }
}

module.exports = {
  sendBackupAlert
};
