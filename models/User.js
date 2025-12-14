import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
    },

    role: {
      type: String,
      enum: ["admin", "instructor", "student", "user"],
      lowercase: true,
      default: "user",
    },

    profileCompleted: {
      type: Boolean,
      default: false,
    },

    upiId: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);
