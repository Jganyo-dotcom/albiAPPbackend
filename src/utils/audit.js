import User from "../models/user.js";
import Customer from "../models/customer.js";
import AuditLog from "../models/AuditLogsSchema.js";
import { Product } from "../models/product.js";
import { Expense } from "../models/Expense.js";

export const logAudit = async (
  userId,
  action,
  entityId = null,
  entityType = "Company",
  path = "Customer",
  companyId = null,
  status = "Successful",
  customDetails = "", // ✨ FIXED: Added this missing parameter at the end
) => {
  try {
    let actorName = "Unknown User";
    let targetName = "Unknown Target";
    let resolvedCompanyId = companyId;

    if (userId) {
      const staffActor = await User.findById(userId);
      actorName = staffActor?.name || "Unknown Staff";
      if (!resolvedCompanyId) resolvedCompanyId = staffActor?.company;
    }

    if (entityId) {
      if (entityId.toString() === userId?.toString()) {
        targetName = actorName;
      } else if (entityType === "Customer") {
        const customer = await Customer.findById(entityId);
        targetName = customer?.fullName || "Unknown Customer";
      } else if (entityType === "Product") {
        const productItem = await Product.findById(entityId);
        targetName = productItem?.name
          ? `product "${productItem.name}"`
          : "Unknown Product";
      } else if (entityType === "Expense") {
        const expenseItem = await Expense.findById(entityId);
        targetName = expenseItem
          ? `expense record "${expenseItem.expenseCode || "EXP"}" (${expenseItem.category})`
          : "Historic/Deleted Expense Record";
      } else {
        const targetStaff = await User.findById(entityId);
        targetName = targetStaff?.name || "Unknown Staff";
      }
    }

    let message = "";
    switch (action) {
      case "LOGIN": {
        message =
          status === "Failed"
            ? `Failed login attempt for ${actorName}`
            : `${actorName} logged in successfully`;
        break;
      }
      // ⭐ NEW CASE: Device Verification Triggered
      case "LOGIN_VERIFICATION_REQUIRED": {
        message = `Unfamiliar device detected for ${actorName}. 2FA OTP verification required.`;
        break;
      }
      // ⭐ NEW CASE: Successful Device OTP Entry
      case "DEVICE_VERIFIED_LOGIN": {
        message = `${actorName} successfully verified a new device via OTP and logged in`;
        break;
      }
      case "CREATE_STAFF": {
        message = `${actorName} registered a new staff profile for ${targetName}`;
        break;
      }
      case "PASSWORD_RESET_REQ": {
        message =
          status === "Failed"
            ? "Failed password reset request: Invalid company reference or email address"
            : `${actorName} requested a password reset recovery link`;
        break;
      }
      case "PASSWORD_RESET_SUBMIT": {
        message =
          status === "Failed" && actorName !== "Unknown User"
            ? `Failed password change attempt by ${actorName}: Link is invalid, expired, or reused`
            : `Failed password change attempt: Invalid or expired reset link signature`;
        break;
      }
      case "RESET_PASSWORD": {
        message = `${actorName} successfully updated their account password`;
        break;
      }
      case "RESTOCK_PRODUCT": {
        message =
          status === "Failed"
            ? `${actorName} failed a restock adjustment attempt`
            : `${actorName} restocked ${targetName} by adding ${customDetails}`;
        break;
      }

      // Inventory Message Cases
      case "CREATE_PRODUCT": {
        message =
          status === "Failed"
            ? `${actorName} failed an inventory addition attempt`
            : `${actorName} added ${targetName} to the stock inventory`;
        break;
      }
      case "CREATE_PRODUCT_BULK": {
        message =
          status === "Failed"
            ? `${actorName} failed a bulk inventory addition attempt`
            : `${actorName} successfully imported new products in bulk to the stock inventory`;
        break;
      }
      case "UPDATE_PRODUCT": {
        message =
          status === "Failed"
            ? `${actorName} failed a product modification attempt`
            : `${actorName} updated details and pricing configurations for ${targetName}`;
        break;
      }
      case "COLLECT_DEBT": {
        message =
          status === "Failed"
            ? `${actorName} failed a customer debt collection attempt`
            : `${actorName} successfully collected a debt payment of ${customDetails} from ${targetName}`;
        break;
      }

      // Expense Message Cases
      case "CREATE_EXPENSE": {
        message =
          status === "Failed"
            ? `${actorName} failed to record a new operational expense`
            : `${actorName} logged a new ${targetName}`;
        break;
      }
      case "REVERSE_EXPENSE": {
        message =
          status === "Failed"
            ? `${actorName} failed a financial expense reversal execution`
            : `${actorName} successfully deleted and reversed the ${targetName}`;
        break;
      }

      // Customer / Billing Message Cases
      case "SERVE_CUSTOMER":
      case "CREATE_CUSTOMER": {
        message = customDetails
          ? `${actorName} processed a new sale for ${targetName}: ${customDetails}`
          : `${actorName} processed a new sale/bill for ${targetName}`;
        break;
      }
      case "EDIT_CUSTOMER": {
        message = `${actorName} updated the transaction record for ${targetName}`;
        break;
      }
      case "DELETE_CUSTOMER": {
        message = `${actorName} removed transaction record for ${targetName}`;
        break;
      }
      default:
        message = `${actorName} executed ${action} on ${targetName}`;
    }

    await AuditLog.create({
      company: resolvedCompanyId,
      userId,
      action,
      message,
      status,
      entityId,
      entityType: entityType || "Company",
      path,
    });
  } catch (err) {
    console.error("Error writing Store action log:", err.message);
  }
};
