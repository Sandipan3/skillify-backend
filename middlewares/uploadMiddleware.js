import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "thumbnail") {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(
        new Error("Only image files are allowed for course thumbnails!"),
        false
      );
    }
  } else if (file.fieldname === "videos") {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed for course videos!"), false);
    }
  } else {
    cb(new Error("Unexpected field"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  //   limits:{
  //     fieldSize:
  //   }
});

export const uploadMiddleware = upload.fields([
  { name: "thumbnail" },
  { name: "videos" },
]);

export default uploadMiddleware;
