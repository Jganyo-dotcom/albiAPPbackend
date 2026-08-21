import { verificationTemplate } from "../emailTemplates.js/verificationEmailTemplate.js";
import { resetPasswordTemplate } from "../emailTemplates.js/resetPasswordEmailTemplate.js";
import { BrevoClient } from "@getbrevo/brevo";

export const sendUniversalMail = async (type, options) => {
  const { recipientEmail, recipientName, subject, companyRef, resetUrl } =
    options;
  const currentYear = new Date().getFullYear();

  // Basic input validation guard
  if (!recipientEmail || !recipientEmail.includes("@")) {
    console.error(
      `[Mail Aborted] Cannot send email. Address is invalid: ${recipientEmail}`,
    );
    return null;
  }

  // Initialize Brevo client inside function to capture process.env reliably
  const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });

  let htmlContent = "";

  // Select template explicitly based on strict type indicator
  if (type === "verification_Mail") {
    htmlContent = verificationTemplate(recipientName, companyRef, currentYear);
  } else if (type === "reset_password_Mail") {
    htmlContent = resetPasswordTemplate(
      recipientName,
      resetUrl,
      companyRef,
      currentYear,
    );
  }

  try {
    const data = await brevo.transactionalEmails.sendTransacEmail({
      to: [{ email: recipientEmail, name: recipientName }],
      sender: { email: "elikemjjames@gmail.com", name: "FinconManager" },
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
