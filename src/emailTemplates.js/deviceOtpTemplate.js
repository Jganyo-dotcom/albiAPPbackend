export const deviceOtpTemplate = (
  recipientName,
  otpCode,
  companyName,
  currentYear,
) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Device Verification Code</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 30px auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .header { border-bottom: 2px solid #eaeaea; padding-bottom: 15px; margin-bottom: 20px; }
        .logo { font-size: 22px; font-weight: bold; color: #1a73e8; }
        .greeting { font-size: 18px; margin-bottom: 10px; }
        .otp-box { background-color: #f0f4f9; border: 1px dashed #1a73e8; border-radius: 6px; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1a73e8; margin: 25px 0; }
        .warning { font-size: 13px; color: #666; line-height: 1.5; margin-top: 25px; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #eaeaea; font-size: 12px; color: #999; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">${companyName || "FinconManager"}</div>
        </div>
        <div class="greeting">Hello ${recipientName},</div>
        <p>We detected a login attempt from an unfamiliar or new device. To protect your account, please verify your identity using the One-Time Password (OTP) below:</p>
        
        <div class="otp-box">${otpCode}</div>
        
        <p>This code is valid for <strong>10 minutes</strong>. If you did not attempt to sign in, please secure your account immediately.</p>
        
        <div class="warning">
          <em>This is an automated security notification. Do not share this OTP with anyone, including staff members.</em>
        </div>
        
        <div class="footer">
          &copy; ${currentYear} ${companyName || "FinconManager"}. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
};
