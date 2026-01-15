import mongoose from "mongoose";

const TicketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    currentRole: {
      type: [String],
      required: true,
    },
    requestedRole: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["created", "approved", "rejected"],
      default: "created",
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Ticket", TicketSchema);
