import multer from "multer";
import path from "path";
import fs from "fs";

// Thumbnail storage (memory)
const thumbnailStorage = multer.memoryStorage();

// Video storage (disk)
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "/tmp/uploads";
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, name + ext);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only image or video files allowed"), false);
  }
};

// Single multer instance with field-based storage redirect

const storage = {
  _handleFile(req, file, cb) {
    if (file.fieldname === "thumbnail") {
      return thumbnailStorage._handleFile(req, file, cb);
    } else {
      return videoStorage._handleFile(req, file, cb);
    }
  },
  _removeFile(req, file, cb) {
    if (file.fieldname === "thumbnail") {
      return thumbnailStorage._removeFile(req, file, cb);
    } else {
      return videoStorage._removeFile(req, file, cb);
    }
  },
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 },
}).fields([
  { name: "thumbnail", maxCount: 1 },
  { name: "videos", maxCount: 20 },
]);

export default uploadMiddleware;
