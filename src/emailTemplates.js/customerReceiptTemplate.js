export const customerReceiptTemplate = (
  recipientName,
  details,
  currentYear,
) => {
  const itemsArray = details.itemsSummary
    ? details.itemsSummary.split(", ")
    : [];
  const itemsListHTML = itemsArray
    .map(
      (item) =>
        `<li style="padding: 6px 0; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 0.95rem;">${item}</li>`,
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Your Purchase Receipt</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        
        <!-- Header Banner showing Dynamic Company Name -->
        <div style="background-color: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 1.5rem; font-weight: 600; letter-spacing: 0.5px;">${details.companyName}</h1>
          <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 0.85rem;">Official Purchase Receipt</p>
        </div>

        <!-- Body Copy -->
        <div style="padding: 24px; color: #334155; line-height: 1.5;">
          <h2 style="margin-top: 0; color: #0f172a; font-size: 1.2rem;">Hello ${recipientName},</h2>
          <p style="color: #475569; font-size: 0.95rem;">Thank you for shopping with <strong>${details.companyName}</strong>! Below is the summary statement for your recent store transaction.</p>
          
          <!-- Metadata Table Block -->
          <div style="background-color: #f1f5f9; border-radius: 6px; padding: 16px; margin: 20px 0; font-size: 0.9rem;">
            <div style="margin-bottom: 6px;"><strong>Invoice Reference ID:</strong> <span style="font-family: monospace; color: #0f172a;">#${details.invoiceNumber}</span></div>
            <div><strong>Payment Channel:</strong> ${details.paymentMethod}</div>
          </div>

          <!-- Itemized Breakdown -->
          <h3 style="color: #0f172a; font-size: 1rem; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 8px;">Purchased Items</h3>
          <ul style="list-style-type: none; padding: 0; margin: 0 0 24px 0;">
            ${itemsListHTML}
          </ul>

          <!-- Financial Calculator Summary Box -->
          <div style="border-top: 2px solid #e2e8f0; padding-top: 12px; margin-top: 20px; font-size: 0.95rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #475569;">
              <span>Total Bill:</span>
              <span style="font-weight: 600; color: #0f172a;">${details.totalAmount}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #16a34a;">
              <span>Amount Paid:</span>
              <span style="font-weight: 600;">${details.amountPaid}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 1.05rem; font-weight: 700; color: ${details.amountOwe.includes("0.00") ? "#0f172a" : "#dc2626"}; border-top: 1px dashed #cbd5e1; padding-top: 8px; margin-top: 8px;">
              <span>Balance Due (Debt):</span>
              <span>${details.amountOwe}</span>
            </div>
          </div>
        </div>

        <!-- Footer Callout -->
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 0.8rem; color: #64748b; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0;">If you have any issues concerning this statement layout transaction, please reach out to customer care support.</p>
          <p style="margin: 4px 0 0 0;">&copy; ${currentYear} ${details.companyName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
