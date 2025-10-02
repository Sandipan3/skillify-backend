import mongoose, { set } from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    thumbnail: {
      type: String, //cloudinary thumbnail URL
      required: true,
    },

    videos: [
      {
        title: {
          type: String,
          required: true,
        },
        url: {
          type: String, //cloudinary video URL
          required: true,
        },
        public_id: {
          type: String, //cloudinary public_id
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    price: {
      type: Number,
      default: 0,
      set: (value) => Number(parseFloat(value).toFixed(2)),
    },
  },
  { timestamps: true }
);

export default mongoose.model("Course", courseSchema);
