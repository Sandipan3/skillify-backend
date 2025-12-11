import Course from "../models/Course.js";
import cloudinary from "../config/cloudinary.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/response.js";
import redis from "../config/redis.js";
import Enrollment from "../models/Enrollment.js";

// Cloudinary upload helpers
export const uploadImageToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (err, res) => (err ? reject(err) : resolve(res))
    );
    stream.end(buffer);
  });
};

export const uploadVideoToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    // Convert buffer to a Base64 Data URI
    const dataUri = `data:video/mp4;base64,${buffer.toString("base64")}`;

    cloudinary.uploader.upload(
      dataUri,
      {
        folder,
        resource_type: "video",
        chunk_size: 6000000, // 6MB chunk size
      },
      (err, res) => (err ? reject(err) : resolve(res))
    );
  });
};

// Cache invalidation
const invalidateCourseCache = async (courseId) => {
  await redis.del("courses:all");
  if (courseId) await redis.del(`course:${courseId}`);
};

// create course
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

  let uploadedThumbnail = null;
  let uploadedVideos = [];

  try {
    // upload thumbnail
    uploadedThumbnail = await uploadImageToCloudinary(
      req.files.thumbnail[0].buffer,
      "skillify-thumbnails"
    );

    // upload videos with fallback
    for (let video of req.files.videos) {
      const uploaded = await uploadVideoToCloudinary(
        video.buffer,
        "skillify-videos"
      );

      uploadedVideos.push({
        title: video.originalname.replace(/\.[^/.]+$/, ""),
        url: uploaded.secure_url,
        public_id: uploaded.public_id,
      });
    }

    // create course
    const course = await Course.create({
      title,
      description,
      instructor,
      thumbnail: uploadedThumbnail.secure_url,
      videos: uploadedVideos,
      price: price || 0,
    });

    await course.populate("instructor", "name");

    await invalidateCourseCache();

    return sendSuccessResponse(res, { course }, 201);
  } catch (error) {
    console.log("CREATE COURSE ERROR:", error.message);

    // fallback cleanup
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

    return sendErrorResponse(res, "Course creation failed", 500);
  }
};

// get all courses
export const getAllCourses = async (req, res) => {
  try {
    const key = "courses:all";
    const cached = await redis.get(key);

    if (cached) {
      return sendSuccessResponse(res, { courses: JSON.parse(cached) }, 200);
    }

    const courses = await Course.find()
      .populate("instructor", "name email")
      .sort({ createdAt: -1 });

    await redis.set(key, JSON.stringify(courses), "EX", 300);

    return sendSuccessResponse(res, { courses }, 200);
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
  }
};

// get course by id

export const getCourseById = async (req, res) => {
  try {
    const courseId = req.params.id;

    const course = await Course.findById(courseId).populate(
      "instructor",
      "name email"
    );

    if (!course) {
      return sendErrorResponse(res, "Course not found", 404);
    }

    const enrollments = await Enrollment.find({ course: courseId }).populate(
      "student",
      "name email"
    );

    const enrollmentCount = enrollments.length;
    const students = enrollments;

    return sendSuccessResponse(
      res,
      {
        course: {
          ...course.toObject(),
          enrollmentCount,
          students,
        },
      },
      200
    );
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
  }
};

// get instructor courses
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

// update course
export const updateCourse = async (req, res) => {
  let newThumbnail = null;
  let newVideos = [];

  try {
    const course = await Course.findById(req.params.id);

    if (!course) return sendErrorResponse(res, "Course not found", 404);

    if (course.instructor.toString() !== req.user.userId) {
      return sendErrorResponse(res, "Not authorized", 403);
    }

    const { title, description, price } = req.body;

    // thumbnail update
    if (req.files?.thumbnail) {
      newThumbnail = await uploadImageToCloudinary(
        req.files.thumbnail[0].buffer,
        "skillify-thumbnails"
      );

      // delete old
      if (course.thumbnail) {
        const publicId = course.thumbnail.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`skillify-thumbnails/${publicId}`);
      }

      course.thumbnail = newThumbnail.secure_url;
    }

    // videos update
    if (req.files?.videos?.length) {
      for (let video of req.files.videos) {
        const uploaded = await uploadVideoToCloudinary(
          video.buffer,
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

    if (title) course.title = title;
    if (description) course.description = description;
    if (price !== undefined) course.price = price;

    await course.save();
    await course.populate("instructor", "name");

    await invalidateCourseCache(course._id);

    return sendSuccessResponse(res, { course }, 200);
  } catch (error) {
    console.log("UPDATE COURSE ERROR:", error.message);

    // fallback cleanup new thumbnail
    if (newThumbnail?.public_id) {
      await cloudinary.uploader.destroy(newThumbnail.public_id, {
        resource_type: "image",
      });
    }

    // fallback cleanup new videos
    for (let vid of newVideos) {
      await cloudinary.uploader.destroy(vid.public_id, {
        resource_type: "video",
      });
    }

    return sendErrorResponse(res, "Server Error", 500);
  }
};

// delete course
export const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) return sendErrorResponse(res, "Course not found", 404);

    if (course.instructor.toString() !== req.user.userId) {
      return sendErrorResponse(res, "Not authorized", 403);
    }

    // delete thumbnail
    if (course.thumbnail) {
      const publicId = course.thumbnail.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`skillify-thumbnails/${publicId}`);
    }

    // delete videos
    for (let vid of course.videos) {
      await cloudinary.uploader.destroy(vid.public_id, {
        resource_type: "video",
      });
    }

    await Course.findByIdAndDelete(req.params.id);

    await invalidateCourseCache(course._id);

    return sendSuccessResponse(res, { message: "Course deleted" }, 200);
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
  }
};

// delete video
export const deleteVideo = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;

    const course = await Course.findById(courseId);

    if (!course) return sendErrorResponse(res, "Course not found", 404);

    if (course.instructor.toString() !== req.user.userId) {
      return sendErrorResponse(res, "Not authorized", 403);
    }

    const video = course.videos.id(videoId);
    if (!video) {
      return sendErrorResponse(res, "Video not found", 404);
    }

    await cloudinary.uploader.destroy(video.public_id, {
      resource_type: "video",
    });

    course.videos.pull(videoId);
    await course.save();

    await invalidateCourseCache(course._id);

    return sendSuccessResponse(res, { message: "Video deleted" }, 200);
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
  }
};

/**  THIS PART HAS THE CONTROLLERS WITHOUT CACHE FOR BENCHMARKING LATER

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



*/
