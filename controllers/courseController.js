import Course from "../models/Course.js";
import cloudinary from "../config/cloudinary.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/response.js";
import redis from "../config/redis.js";
import fs from "fs";

// CLOUDINARY HELPERS
// Upload image from memory buffer
export const uploadImageToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (err, res) => (err ? reject(err) : resolve(res))
    );

    stream.end(buffer);
  });
};

// Upload video from TEMP file using streaming
export const uploadVideoToCloudinary = (filePath, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "video",
        chunk_size: 6000000, //6MB
      },
      (err, res) => {
        fs.unlinkSync(filePath); // delete temp file
        return err ? reject(err) : resolve(res);
      }
    );

    fs.createReadStream(filePath).pipe(uploadStream);
  });
};

const invalidateCourseCache = async (courseId, instructorId) => {
  try {
    // Delete all paginated course list caches
    const listKeys = await redis.keys("courses:page:*");
    if (listKeys.length > 0) await redis.del(listKeys);

    // Delete instructor paginated caches
    if (instructorId) {
      const instructorKeys = await redis.keys(`courses:${instructorId}:page:*`);
      if (instructorKeys.length > 0) await redis.del(instructorKeys);
    }
  } catch (err) {
    console.log("CACHE INVALIDATION ERROR", err);
  }
};

export const createCourse = async (req, res) => {
  const { title, description, price = 0, upiId } = req.body;
  const instructor = req.user.userId;

  if (!title || !description) {
    return sendErrorResponse(res, "Title and description are required", 400);
  }

  // Required ONLY for paid courses
  if (price > 0) {
    const instructorUser = await User.findById(instructor);

    if (!instructorUser) {
      return sendErrorResponse(res, "Instructor not found", 404);
    }

    // Save UPI only once
    if (!instructorUser.upiId) {
      if (!upiId) {
        return sendErrorResponse(
          res,
          "UPI ID is required for paid courses",
          400
        );
      }

      instructorUser.upiId = upiId;
      await instructorUser.save();
    }
  }

  // Check duplicate course title
  const existingCourse = await Course.findOne({
    title: { $regex: `^${title.trim()}$`, $options: "i" },
  });

  if (existingCourse) {
    return sendErrorResponse(
      res,
      "A course with this title already exists",
      400
    );
  }

  if (!req.files?.thumbnail) {
    return sendErrorResponse(res, "Thumbnail is required", 400);
  }

  if (!req.files?.videos || req.files.videos.length === 0) {
    return sendErrorResponse(res, "At least one video is required", 400);
  }

  let uploadedThumbnail = null;
  let uploadedVideos = [];

  try {
    // Upload Thumbnail
    uploadedThumbnail = await uploadImageToCloudinary(
      req.files.thumbnail[0].buffer,
      "skillify-thumbnails"
    );

    // Upload each video via streaming
    for (let video of req.files.videos) {
      const uploaded = await uploadVideoToCloudinary(
        video.path,
        "skillify-videos"
      );

      uploadedVideos.push({
        title: video.originalname.replace(/\.[^/.]+$/, ""),
        url: uploaded.secure_url,
        public_id: uploaded.public_id,
      });
    }

    // Create course document
    const course = await Course.create({
      title,
      description,
      instructor,
      thumbnail: {
        url: uploadedThumbnail.secure_url,
        public_id: uploadedThumbnail.public_id,
      },
      videos: uploadedVideos,
      price,
    });

    await course.populate("instructor", "name");

    await invalidateCourseCache(null, instructor);

    return sendSuccessResponse(res, { course }, 201);
  } catch (error) {
    console.log("CREATE COURSE ERROR:", error);

    // Cleanup if failure
    if (uploadedThumbnail?.public_id) {
      await cloudinary.uploader.destroy(uploadedThumbnail.public_id, {
        resource_type: "image",
      });
    }

    for (let vid of uploadedVideos) {
      await cloudinary.uploader.destroy(vid.public_id, {
        resource_type: "video",
      });
    }

    return sendErrorResponse(
      res,
      error.message || "Course creation failed",
      500
    );
  }
};

// GET ALL COURSES (9 per page)
export const getAllCourses = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const cacheKey = `courses:page:${page}`;

    // Serve cached page if exists
    const cached = await redis.get(cacheKey);
    if (cached) return sendSuccessResponse(res, JSON.parse(cached));

    const totalCourses = await Course.countDocuments();
    const totalPages = Math.ceil(totalCourses / limit);

    const courses = await Course.find()
      .populate("instructor", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const responseData = {
      courses,
      page,
      totalPages,
      totalCourses,
    };

    await redis.set(cacheKey, JSON.stringify(responseData), "EX", 300);

    return sendSuccessResponse(res, responseData);
  } catch (error) {
    console.log(error);
    return sendErrorResponse(res, error.message || "Server Error", 500);
  }
};

// GET COURSE BY ID
export const getCourseById = async (req, res) => {
  try {
    const courseId = req.params.id;
    const instructorId = req.user.userId;

    const course = await Course.findOne({
      _id: courseId,
      instructor: instructorId,
    }).populate("instructor", "name email");

    if (!course) {
      return sendErrorResponse(res, "Course not found", 404);
    }

    // Normalize response shape
    const courseObj = course.toObject();
    courseObj.videos = courseObj.videos || [];

    return sendSuccessResponse(res, courseObj, 200);
  } catch (error) {
    console.error("GET COURSE BY ID ERROR:", error);
    return sendErrorResponse(res, error.message || "Server Error", 500);
  }
};

// GET INSTRUCTOR COURSES
export const getInstructorCourses = async (req, res) => {
  try {
    const instructorId = req.user.userId;

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const cacheKey = `courses:${instructorId}:page:${page}`;

    const cached = await redis.get(cacheKey);
    if (cached) return sendSuccessResponse(res, JSON.parse(cached));

    // Count total instructor courses
    const totalCourses = await Course.countDocuments({
      instructor: instructorId,
    });
    const totalPages = Math.ceil(totalCourses / limit);

    // Fetch paginated courses
    const courses = await Course.find({ instructor: instructorId })
      .populate("instructor", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const responseData = {
      courses,
      page,
      totalPages,
      totalCourses,
    };

    await redis.set(cacheKey, JSON.stringify(responseData), "EX", 300);

    return sendSuccessResponse(res, responseData);
  } catch (error) {
    console.log("GET INSTRUCTOR COURSES ERROR:", error);
    return sendErrorResponse(res, error.message || "Server Error", 500);
  }
};

// UPDATE COURSE
export const updateCourse = async (req, res) => {
  let newThumbnail = null;
  let newVideos = [];

  try {
    const course = await Course.findById(req.params.id);
    if (!course) return sendErrorResponse(res, "Course not found", 404);

    if (course.instructor.toString() !== req.user.userId)
      return sendErrorResponse(res, "Not authorized", 403);

    const { title, description, price, upiId } = req.body;

    // Allow UPI update (frontend controlled)

    // Only check if title is being updated
    if (title && title.toLowerCase() !== course.title.toLowerCase()) {
      const existingCourse = await Course.findOne({
        title: { $regex: `^${title.trim()}$`, $options: "i" },
      });

      if (existingCourse) {
        return sendErrorResponse(
          res,
          "A course with this title already exists",
          400
        );
      }
    }

    // upload new thumbnail first
    if (req.files?.thumbnail) {
      newThumbnail = await uploadImageToCloudinary(
        req.files.thumbnail[0].buffer,
        "skillify-thumbnails"
      );

      if (course.thumbnail?.public_id) {
        await cloudinary.uploader.destroy(course.thumbnail.public_id, {
          resource_type: "image",
        });
      }

      course.thumbnail = {
        url: newThumbnail.secure_url,
        public_id: newThumbnail.public_id,
      };
    }

    // upload New Videos (append)
    if (req.files?.videos?.length) {
      for (let video of req.files.videos) {
        const uploaded = await uploadVideoToCloudinary(
          video.path,
          "skillify-videos"
        );

        newVideos.push({
          title: video.originalname.replace(/\.[^/.]+$/, ""),
          url: uploaded.secure_url,
          public_id: uploaded.public_id,
        });
      }

      course.videos.push(...newVideos);
    }

    // Update other fields
    if (title) course.title = title;
    if (description) course.description = description;
    if (price !== undefined) course.price = price;
    if (upiId) {
      await User.findByIdAndUpdate(req.user.userId, { upiId }, { new: true });
    }

    await course.save();
    await course.populate("instructor", "name");

    await invalidateCourseCache(course._id, course.instructor.toString());

    return sendSuccessResponse(res, { course });
  } catch (error) {
    console.log("UPDATE COURSE ERROR:", error);

    if (newThumbnail?.public_id)
      await cloudinary.uploader.destroy(newThumbnail.public_id);

    for (let vid of newVideos) {
      await cloudinary.uploader.destroy(vid.public_id);
    }

    return sendErrorResponse(res, error.message || "Server Error", 500);
  }
};

// DELETE COURSE
export const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return sendErrorResponse(res, "Course not found", 404);

    if (course.instructor.toString() !== req.user.userId)
      return sendErrorResponse(res, "Not authorized", 403);

    // delete course
    await Course.findByIdAndDelete(course._id);

    // delete thumbnail from cloudinary
    if (course.thumbnail?.public_id) {
      try {
        await cloudinary.uploader.destroy(course.thumbnail.public_id, {
          resource_type: "image",
        });
      } catch (error) {
        console.warn("Thumbnail cleanup failed:", error.message);
      }
    }

    // delete videos from cloudinary
    for (const vid of course.videos) {
      try {
        await cloudinary.uploader.destroy(vid.public_id, {
          resource_type: "video",
        });
      } catch (error) {
        console.warn("Video cleanup failed:", error.message);
      }
    }

    await invalidateCourseCache(course._id, course.instructor.toString());

    return sendSuccessResponse(res, { message: "Course deleted" });
  } catch (error) {
    return sendErrorResponse(res, error.message || "Server Error", 500);
  }
};

// DELETE SINGLE VIDEO
export const deleteVideo = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) return sendErrorResponse(res, "Course not found", 404);

    if (course.instructor.toString() !== req.user.userId)
      return sendErrorResponse(res, "Not authorized", 403);

    const video = course.videos.id(videoId);
    if (!video) return sendErrorResponse(res, "Video not found", 404);

    const publicId = video.public_id;

    // remove video from DB first
    course.videos.pull(videoId);
    await course.save();

    //delete video from cloudinary
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: "video",
      });
    } catch (error) {
      console.warn(
        `Cloudinary cleanup failed for video ${publicId}:`,
        error.message
      );
    }

    await invalidateCourseCache(course._id, course.instructor.toString());

    return sendSuccessResponse(res, { message: "Video deleted" });
  } catch (error) {
    return sendErrorResponse(res, error.message || "Server Error", 500);
  }
};

// REPLACE VIDEO
export const replaceVideo = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;

    if (!req.files?.videos || req.files.videos.length === 0)
      return sendErrorResponse(res, "New video file is required", 400);

    const newVideoFile = req.files.videos[0];

    const course = await Course.findById(courseId);
    if (!course) return sendErrorResponse(res, "Course not found", 404);

    if (course.instructor.toString() !== req.user.userId)
      return sendErrorResponse(res, "Not authorized", 403);

    const videoIndex = course.videos.findIndex(
      (v) => v._id.toString() === videoId
    );

    if (videoIndex === -1)
      return sendErrorResponse(res, "Video not found", 404);

    const oldVideo = course.videos[videoIndex];

    // Upload new video to cloudinary
    const uploaded = await uploadVideoToCloudinary(
      newVideoFile.path,
      "skillify-videos"
    );

    // save changes in db
    course.videos[videoIndex] = {
      title: newVideoFile.originalname.replace(/\.[^/.]+$/, ""),
      url: uploaded.secure_url,
      public_id: uploaded.public_id,
    };

    await course.save();

    // delete video from cloudinary
    try {
      await cloudinary.uploader.destroy(oldVideo.public_id, {
        resource_type: "video",
      });
    } catch (error) {
      console.warn("Old video cleanup failed!", error.message);
    }

    await invalidateCourseCache(courseId, course.instructor.toString());

    return sendSuccessResponse(res, {
      message: "Video replaced successfully",
    });
  } catch (error) {
    console.log("REPLACE VIDEO ERROR:", error);
    return sendErrorResponse(res, error.message || "Server error", 500);
  }
};
