import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    // Performer: Always an IT staff member
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    action: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, default: "Successful" },

    // Receiver / Target: Dynamically references Patient OR HospitalIT
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "entityType",
    },
    entityType: {
      type: String,
      enum: ["Company", "Customer", "Product", "Expense"],
    },

    // Kept for backward compatibility with existing saved documents
    path: {
      type: String,
      enum: ["Customer", "Company", "Product", "Expense"],
    },
  },
  { timestamps: true },
);

export default mongoose.model("AuditLog", AuditLogSchema);
