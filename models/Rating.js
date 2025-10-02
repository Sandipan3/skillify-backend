import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    review: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

//one student can rate one course
ratingSchema.index({ course: 1, student: 1 }, { unique: true });

export default mongoose.model("Rating", ratingSchema);
