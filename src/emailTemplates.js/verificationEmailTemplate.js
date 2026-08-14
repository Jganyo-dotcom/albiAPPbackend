/**
 * 📧 WORKSPACE CREATION EMAIL TEMPLATE
 * Notifies the admin user of their permanent Company Reference string.
 */
export const verificationTemplate = (
  recipientName,
  companyRef,
  currentYear,
) => {
  // Fallback to current year if not provided
  const year = currentYear || new Date().getFullYear();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Workspace Is Ready</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;padding:48px 20px;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width:520px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              
              <!-- Header / Logo -->
              <tr>
                <td style="padding-bottom:24px;border-bottom:1px solid #f1f5f9;">
                  <span style="font-size:18px;font-weight:700;color:#0f172a;">FINCMANAGER</span>
                </td>
              </tr>
              
              <!-- Content Greeting -->
              <tr>
                <td style="padding-top:24px;">
                  <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#0f172a;">Your Workspace is Ready!</h2>
                  <p style="margin:0 0 24px;font-size:14px;line-height:24px;color:#475569;">
                    Hello ${recipientName},<br><br>
                    Your company tenant workspace has been set up successfully. Below is your permanent **Company Reference string**. 
                    <br><br>
                    <strong>⚠️ Important:</strong> You will need this exact reference identifier to log into your admin dashboard and access your custom company URL parameters. Please memorize or save it securely.
                  </p>
                </td>
              </tr>
              
              <!-- Highlighted Company Reference Box -->
              <tr>
                <td align="center" style="padding:16px 0 24px;">
                  <table border="0" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;border-radius:8px;width:100%;">
                    <tr>
                      <td align="center" style="padding:18px 24px;font-family:monospace;font-size:24px;font-weight:700;letter-spacing:2px;color:#2563eb;">
                        ${companyRef}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Action Instruction Note -->
              <tr>
                <td>
                  <p style="margin:0 0 32px;font-size:13px;line-height:22px;color:#64748b;">
                    Your direct access link is: <br>
                    <a href="https://sCloudPlaza.com{companyRef}" style="color:#2563eb;text-decoration:underline;font-weight:500;">
                      ://CloudPlaza.com{companyRef}
                    </a>
                  </p>
                </td>
              </tr>
              
              <!-- Footer Copyright -->
              <tr>
                <td style="border-top:1px solid #f1f5f9;padding-top:24px;">
                  <p style="margin:0;font-size:12px;color:#94a3b8;line-height:18px;">
                    &copy; ${year} CloudPlaza. All rights reserved.
                  </p>
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
