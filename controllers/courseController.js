import Course from "../models/Course.js";
import cloudinary from "../config/cloudinary.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/response.js";
import redis from "../config/redis.js";
import Enrollment from "../models/Enrollment.js";
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

// Upload video from TEMP file using streaming (Render-safe)
export const uploadVideoToCloudinary = (filePath, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "video",
        chunk_size: 6_000_000,
      },
      (err, res) => {
        fs.unlinkSync(filePath); // delete temp file
        return err ? reject(err) : resolve(res);
      }
    );

    fs.createReadStream(filePath).pipe(uploadStream);
  });
};

// CACHE INVALIDATION (ONLY two keys)
const invalidateCourseCache = async (courseId) => {
  // Delete all paginated caches
  const pageKeys = await redis.keys("courses:page:*");
  if (pageKeys.length) await redis.del(pageKeys);

  // Delete specific course cache
  if (courseId) {
    await redis.del(`course:${courseId}`);
  }
};

// CREATE COURSE
export const createCourse = async (req, res) => {
  const { title, description, price } = req.body;
  const instructor = req.user.userId;

  if (!title || !description)
    return sendErrorResponse(res, "Title and description are required", 400);

  // Check if a course with the same title exists
  const existingCourse = await Course.findOne({
    title: { $regex: `^${title}$`, $options: "i" },
  });

  if (existingCourse) {
    return sendErrorResponse(
      res,
      "A course with this title already exists",
      400
    );
  }

  if (!req.files?.thumbnail)
    return sendErrorResponse(res, "Thumbnail is required", 400);

  if (!req.files?.videos || req.files.videos.length === 0)
    return sendErrorResponse(res, "At least one video is required", 400);

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
      price: price || 0,
    });

    await course.populate("instructor", "name");

    await invalidateCourseCache();

    return sendSuccessResponse(res, { course }, 201);
  } catch (error) {
    console.log("CREATE COURSE ERROR:", error);

    // Cleanup if failure
    if (uploadedThumbnail?.public_id)
      await cloudinary.uploader.destroy(uploadedThumbnail.public_id, {
        resource_type: "image",
      });

    for (let vid of uploadedVideos) {
      await cloudinary.uploader.destroy(vid.public_id, {
        resource_type: "video",
      });
    }

    return sendErrorResponse(res, "Course creation failed", 500);
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
    return sendErrorResponse(res, "Server Error", 500);
  }
};

// GET COURSE BY ID
export const getCourseById = async (req, res) => {
  try {
    const courseId = req.params.id;

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    // Cache key should include page to avoid conflicts
    const cacheKey = `course:${courseId}:page:${page}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return sendSuccessResponse(res, JSON.parse(cached));
    }

    // Fetch course details
    const course = await Course.findById(courseId).populate(
      "instructor",
      "name email"
    );

    if (!course) return sendErrorResponse(res, "Course not found", 404);

    // Count total students for pagination
    const totalStudents = await Enrollment.countDocuments({ course: courseId });
    const totalPages = Math.ceil(totalStudents / limit);

    // Get paginated students
    const students = await Enrollment.find({ course: courseId })
      .populate("student", "name email")
      .skip(skip)
      .limit(limit);

    const responseData = {
      course: course.toObject(),
      students,
      enrollmentCount: totalStudents,
      page,
      totalPages,
      totalStudents,
    };

    await redis.set(cacheKey, JSON.stringify(responseData), "EX", 300);

    return sendSuccessResponse(res, responseData);
  } catch (error) {
    console.log("GET COURSE BY ID ERROR:", error);
    return sendErrorResponse(res, "Server Error", 500);
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

    return sendSuccessResponse(res, {
      courses,
      page,
      totalPages,
      totalCourses,
    });
  } catch (error) {
    console.log("GET INSTRUCTOR COURSES ERROR:", error);
    return sendErrorResponse(res, "Server Error", 500);
  }
};

// UPDATE COURSE (Replace Thumbnail + Add Videos)
export const updateCourse = async (req, res) => {
  let newThumbnail = null;
  let newVideos = [];

  try {
    const course = await Course.findById(req.params.id);
    if (!course) return sendErrorResponse(res, "Course not found", 404);

    if (course.instructor.toString() !== req.user.userId)
      return sendErrorResponse(res, "Not authorized", 403);

    const { title, description, price } = req.body;

    // Only check if title is being updated
    if (title && title.toLowerCase() !== course.title.toLowerCase()) {
      const existingCourse = await Course.findOne({
        title: { $regex: `^${title}$`, $options: "i" },
      });

      if (existingCourse) {
        return sendErrorResponse(
          res,
          "A course with this title already exists",
          400
        );
      }
    }

    // Replace Thumbnail
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

    // Add New Videos (append)
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

    await course.save();
    await course.populate("instructor", "name");

    await invalidateCourseCache(course._id);

    return sendSuccessResponse(res, { course });
  } catch (error) {
    console.log("UPDATE COURSE ERROR:", error);

    // Cleanup newly uploaded assets on error
    if (newThumbnail?.public_id)
      await cloudinary.uploader.destroy(newThumbnail.public_id);

    for (let vid of newVideos) {
      await cloudinary.uploader.destroy(vid.public_id);
    }

    return sendErrorResponse(res, "Server Error", 500);
  }
};

// DELETE COURSE
export const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return sendErrorResponse(res, "Course not found", 404);

    if (course.instructor.toString() !== req.user.userId)
      return sendErrorResponse(res, "Not authorized", 403);

    // Delete thumbnail
    if (course.thumbnail?.public_id) {
      await cloudinary.uploader.destroy(course.thumbnail.public_id, {
        resource_type: "image",
      });
    }

    // Delete all videos
    for (let vid of course.videos) {
      await cloudinary.uploader.destroy(vid.public_id, {
        resource_type: "video",
      });
    }

    await Course.findByIdAndDelete(req.params.id);

    await invalidateCourseCache(course._id);

    return sendSuccessResponse(res, { message: "Course deleted" });
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
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

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(video.public_id, {
      resource_type: "video",
    });

    // Delete from DB
    course.videos.pull(videoId);
    await course.save();

    await invalidateCourseCache(course._id);

    return sendSuccessResponse(res, { message: "Video deleted" });
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
  }
};

// REPLACE VIDEO (NEW FEATURE)
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

    // Find index of the existing video
    const videoIndex = course.videos.findIndex(
      (v) => v._id.toString() === videoId
    );

    if (videoIndex === -1)
      return sendErrorResponse(res, "Video not found", 404);

    const oldVideo = course.videos[videoIndex];

    // Upload new video
    const uploaded = await uploadVideoToCloudinary(
      newVideoFile.path,
      "skillify-videos"
    );

    // Remove old Cloudinary asset
    await cloudinary.uploader.destroy(oldVideo.public_id, {
      resource_type: "video",
    });

    // Replace in place (keeping order)
    course.videos[videoIndex] = {
      title: newVideoFile.originalname.replace(/\.[^/.]+$/, ""),
      url: uploaded.secure_url,
      public_id: uploaded.public_id,
    };

    await course.save();

    await invalidateCourseCache(courseId);

    return sendSuccessResponse(res, {
      message: "Video replaced successfully",
    });
  } catch (error) {
    console.log("REPLACE VIDEO ERROR:", error);
    return sendErrorResponse(res, "Server error", 500);
  }
};
