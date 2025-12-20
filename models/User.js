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

    roles: {
      type: [String],
      enum: ["admin", "instructor", "student", "user"],
      default: ["user"],
      set: (roles) => roles.map((role) => role.toLowerCase()),
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
