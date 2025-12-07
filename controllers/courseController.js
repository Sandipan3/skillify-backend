import { v2 as cloudinary } from "cloudinary";
import Course from "../models/Course.js";
import dotenv from "dotenv";
import { sendSuccessResponse, sendErrorResponse } from "../utils/response.js";

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

//create course
export const createCourse = async (req, res) => {
  const { title, description, price } = req.body;
  const instructor = req.user.userId;

  if (!title || !description) {
    return sendErrorResponse(res, "Title and description are required", 400);
  }

  if (!req.files?.thumbnail) {
    return sendErrorResponse(res, "Thumbnail is required", 400);
  }

  if (!req.files?.videos || req.files.videos.length === 0) {
    return sendErrorResponse(res, "At least one video is required", 400);
  }

  try {
    const thumbnailResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "skillify-thumbnails", resource_type: "image" },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      uploadStream.end(req.files.thumbnail[0].buffer);
    });

    let videos = [];
    for (let video of req.files.videos) {
      const videoResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "skillify-videos", resource_type: "video" },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        uploadStream.end(video.buffer);
      });

      videos.push({
        title: video.originalname.replace(/\.[^/.]+$/, ""),
        url: videoResult.secure_url,
        public_id: videoResult.public_id,
      });
    }

    const course = new Course({
      title,
      description,
      instructor,
      thumbnail: thumbnailResult.secure_url,
      videos,
      price: price || 0,
    });

    await course.save();
    await course.populate("instructor", "name");

    return sendSuccessResponse(res, { course }, 201);
  } catch (error) {
    return sendErrorResponse(res, "Course creation failed", 500);
  }
};

//get all courses
export const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate("instructor", "name email")
      .sort({ createdAt: -1 });

    return sendSuccessResponse(res, { courses }, 200);
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
  }
};

//update course
export const updateCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return sendErrorResponse(res, "Course not found", 404);
    }

    if (course.instructor.toString() !== req.user.userId) {
      return sendErrorResponse(
        res,
        "Not authorized to update this course",
        403
      );
    }

    const { title, description, price } = req.body;

    //thumbnail update
    if (req.files?.thumbnail) {
      if (course.thumbnail) {
        const publicId = course.thumbnail.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`skillify-thumbnails/${publicId}`);
      }

      const thumbnailResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "skillify-thumbnails", resource_type: "image" },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        uploadStream.end(req.files.thumbnail[0].buffer);
      });

      course.thumbnail = thumbnailResult.secure_url;
    }

    //videos update
    if (req.files?.videos && req.files.videos.length > 0) {
      for (let video of req.files.videos) {
        const videoResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "skillify-videos", resource_type: "video" },
            (error, result) => (error ? reject(error) : resolve(result))
          );
          uploadStream.end(video.buffer);
        });

        course.videos.push({
          title: video.originalname.replace(/\.[^/.]+$/, ""),
          url: videoResult.secure_url,
          public_id: videoResult.public_id,
        });
      }
    }

    if (title) course.title = title;
    if (description) course.description = description;
    if (price !== undefined) course.price = price;

    await course.save();
    await course.populate("instructor", "name");

    return sendSuccessResponse(res, { course }, 200);
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
  }
};

//delete course
export const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return sendErrorResponse(res, "Course not found", 404);
    }

    if (course.instructor.toString() !== req.user.userId) {
      return sendErrorResponse(
        res,
        "Not authorized to delete this course",
        403
      );
    }

    if (course.thumbnail) {
      const publicId = course.thumbnail.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`skillify-thumbnails/${publicId}`);
    }

    for (let video of course.videos) {
      await cloudinary.uploader.destroy(video.public_id, {
        resource_type: "video",
      });
    }

    await Course.findByIdAndDelete(req.params.id);

    return sendSuccessResponse(
      res,
      { message: "Course deleted successfully" },
      200
    );
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
  }
};

//delete video
export const deleteVideo = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;

    const course = await Course.findById(courseId);

    if (!course) {
      return sendErrorResponse(res, "Course not found", 404);
    }

    if (course.instructor.toString() !== req.user.userId) {
      return sendErrorResponse(
        res,
        "Not authorized to update this course",
        403
      );
    }

    const video = course.videos.id(videoId);
    if (!video) {
      return sendErrorResponse(res, "Video not found in this course", 404);
    }

    await cloudinary.uploader.destroy(video.public_id, {
      resource_type: "video",
    });

    course.videos.pull(videoId);
    await course.save();

    return sendSuccessResponse(
      res,
      { message: "Video deleted successfully" },
      200
    );
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
  }
};

//get all courses for a specific instructor
export const getInstructorCourses = async (req, res) => {
  try {
    const instructorId = req.user.userId;

    const courses = await Course.find({ instructor: instructorId })
      .populate("instructor", "name email")
      .sort({ createdAt: -1 });

    return sendSuccessResponse(res, { courses }, 200);
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
  }
};

//get a specific course
export const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("instructor", "name email")
      .populate("enrollments", "student enrolledAt");

    if (!course) {
      return sendErrorResponse(res, "Course not found", 404);
    }

    return sendSuccessResponse(res, { course }, 200);
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
  }
};
