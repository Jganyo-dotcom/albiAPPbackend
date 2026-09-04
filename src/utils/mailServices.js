import { verificationTemplate } from "../emailTemplates.js/verificationEmailTemplate.js";
import { resetPasswordTemplate } from "../emailTemplates.js/resetPasswordEmailTemplate.js";
import { customerReceiptTemplate } from "../emailTemplates.js/customerReceiptTemplate.js";
import { BrevoClient } from "@getbrevo/brevo";

export const sendUniversalMail = async (type, options) => {
  // Destructured the incoming options object
  const {
    recipientEmail,
    recipientName,
    subject,
    companyRef,
    resetUrl,
    companyName,
  } = options;
  const currentYear = new Date().getFullYear();

  if (!recipientEmail || !recipientEmail.includes("@")) {
    console.error(
      `[Mail Aborted] Cannot send email. Address is invalid: ${recipientEmail}`,
    );
    return null;
  }

  const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
  let htmlContent = "";

  // Select template explicitly based on strict type indicator keys
  if (type === "verification_Mail") {
    htmlContent = verificationTemplate(recipientName, companyRef, currentYear);
  } else if (type === "reset_password_Mail") {
    htmlContent = resetPasswordTemplate(
      recipientName,
      resetUrl,
      companyRef,
      currentYear,
    );
  } else if (type === "customer_receipt_Mail") {
    htmlContent = customerReceiptTemplate(recipientName, options, currentYear);
  }

  try {
    const data = await brevo.transactionalEmails.sendTransacEmail({
      to: [{ email: recipientEmail, name: recipientName }],
      // ✨ REVISED: Sender display name falls back to company name for better branding
      sender: {
        email: "elikemjjames@gmail.com",
        name: companyName || "FinconManager",
      },
      subject: subject,
      htmlContent: htmlContent,
    });

    console.log(
      `Email [${type}] successfully routed to ${recipientEmail}. Message ID:`,
      data.messageId,
    );
    return data;
  } catch (error) {
    console.error(
      `Failed to route universal mail to ${recipientEmail}:`,
      error,
    );
    throw error;
  }
};
