import multer from "multer";

// Store files in memory (buffer available in req.file.buffer)
const storage = multer.memoryStorage();

// Only allow image or PDF
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only image or PDF files are allowed!"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 20MB limit
});

// Single file (field name: 'file')
export const uploadMiddleware = upload.fields([
  { name: "thumbnail", maxCount: 1 },
  { name: "videos", maxCount: 20 },
]);
export default uploadMiddleware;
