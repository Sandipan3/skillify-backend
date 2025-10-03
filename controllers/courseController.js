import { v2 as cloudinary } from "cloudinary";
import Course from "../models/Course.js";
import dotenv from "dotenv";
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
    return res.status(400).json({
      status: "error",
      message: "Title and description are required",
    });
  }

  if (!req.files?.thumbnail) {
    return res.status(400).json({
      status: "error",
      message: "Thumbnail is required",
    });
  }

  if (!req.files?.videos) {
    return res.status(400).json({
      status: "error",
      message: "At least one video is required",
    });
  }

  try {
    // Upload thumbnail using upload_stream
    const thumbnailResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "skillify-thumbnails",
          resource_type: "image",
        },
        (error, result) => {
          error ? reject(error) : resolve(result);
        }
      );
      // Send the buffer directly to Cloudinary
      uploadStream.end(req.files.thumbnail[0].buffer);
    });

    // Upload videos using upload_stream (NO BASE64)
    let videos = [];
    for (let i = 0; i < req.files.videos.length; i++) {
      const video = req.files.videos[i];
      const videoResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "skillify-videos",
            resource_type: "video",
          },
          (error, result) => {
            error ? reject(error) : resolve(result);
          }
        );
        // Send the buffer directly to Cloudinary
        uploadStream.end(video.buffer);
      });

      videos.push({
        title: video.originalname.replace(/\.[^/.]+$/, ""),
        url: videoResult.secure_url,
        public_id: videoResult.public_id,
      });
    }

    // Create course
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

    res.status(201).json({
      status: "success",
      data: course,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

//get all courses
export const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate("instructor", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      data: courses,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

//update route
export const updateCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        status: "error",
        message: "Course not found",
      });
    }

    if (course.instructor.toString() !== req.user.userId) {
      return res.status(403).json({
        status: "error",
        message: "Not authorized to update this course",
      });
    }

    const { title, description, price } = req.body;

    //thumbnail update
    if (req.files?.thumbnail) {
      //delete old thumbnail
      if (course.thumbnail) {
        //https://res.cloudinary.com/dzqhdeoac/image/upload/v1759315135/skillify-thumbnails/nnpgxktksfn2fa1eap4r.png
        //publicId = nnpgxktksfn2fa1eap4r
        const publicId = course.thumbnail.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`skillify-thumbnails/${publicId}`);
      }

      //upload new thumbnail
      const thumbnailResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "skillify-thumbnails",
            resource_type: "image",
          },
          (error, result) => {
            error ? reject(error) : resolve(result);
          }
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
            {
              folder: "skillify-videos",
              resource_type: "video",
            },
            (error, result) => {
              error ? reject(error) : resolve(result);
            }
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

    //update text fields
    if (title) course.title = title;
    if (description) course.description = description;
    if (price !== undefined) course.price = price;

    await course.save();
    await course.populate("instructor", "name");

    res.status(200).json({
      status: "success",
      data: course,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

//delete course
export const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        status: "error",
        message: "Course not found",
      });
    }
    //check for same instructor
    if (course.instructor.toString() !== req.user.userId) {
      return res.status(403).json({
        status: "error",
        message: "Not authorized to update this course",
      });
    }

    //delete thumbnail
    if (course.thumbnail) {
      const publicId = course.thumbnail.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`skillify-thumbnails/${publicId}`);
    }

    //delete videos
    for (let video of course.videos) {
      await cloudinary.uploader.destroy(video.public_id, {
        resource_type: "video",
      });
    }

    //delete course from mongodb
    await Course.findByIdAndDelete(req.params.id);
    res.status(200).json({
      status: "success",
      message: "Course deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

//delete video
export const deleteVideo = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        status: "error",
        message: "Course not found",
      });
    }
    //check for same instructor
    if (course.instructor.toString() !== req.user.userId) {
      return res.status(403).json({
        status: "error",
        message: "Not authorized to update this course",
      });
    }

    const video = course.videos.id(videoId);
    if (!video) {
      return res.status(404).json({
        status: "error",
        message: "Video not found in this course",
      });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(video.public_id, {
      resource_type: "video",
    });
    // Remove from course
    course.videos.pull(videoId);
    await course.save();

    res.status(200).json({
      status: "success",
      message: "Video deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

//get all courses for a specific instructor
export const getInstructorCourses = async (req, res) => {
  try {
    const instructorId = req.user.userId;

    const courses = await Course.find({ instructor: instructorId })
      .populate("instructor", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      data: courses,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

//get a specific course
export const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("instructor", "name email")
      .populate("enrollments", "student enrolledAt");

    if (!course) {
      return res.status(404).json({
        status: "error",
        message: "Course not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: course,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
