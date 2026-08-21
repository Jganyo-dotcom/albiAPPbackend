// emailTemplates/resetPasswordEmailTemplate.js

export const resetPasswordTemplate = (
  recipientName,
  resetUrl,
  companyRef,
  currentYear,
) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your FinconManager Password</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f6f9; padding: 40px 10px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" max-width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); max-width: 600px;">
            
            <!-- HEADER -->
            <tr>
              <td style="background-color: #0f172a; padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">FinconManager</h1>
                <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Account Security</p>
              </td>
            </tr>

            <!-- CONTENT BODY -->
            <tr>
              <td style="padding: 40px 30px; color: #334155; line-height: 1.6;">
                <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Password Reset Request</h2>
                <p>Hello <strong>${recipientName}</strong>,</p>
                <p>We received a request to reset the password for your account associated with company reference code: <strong style="color: #2563eb; background-color: #eff6ff; padding: 2px 8px; border-radius: 4px;">${companyRef}</strong>.</p>
                
                <p>Click the button below to set a new password. This link will expire in <strong>15 minutes</strong> for security reasons.</p>

                <!-- CALL TO ACTION BUTTON -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                  <tr>
                    <td align="center">
                      <a href="${resetUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);">
                        Reset My Password
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="font-size: 14px; color: #64748b;">If the button above does not work, copy and paste this link into your web browser:</p>
                <p style="font-size: 13px; word-break: break-all; color: #2563eb; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
                  ${resetUrl}
                </p>

                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />

                <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
                  If you did not request a password reset, you can safely ignore this email. Your current password will remain active and secure.
                </p>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                <p style="margin: 0;">&copy; ${currentYear} FinconManager. All rights reserved.</p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};
