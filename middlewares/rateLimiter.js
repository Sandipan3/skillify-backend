import rateLimit from "express-rate-limit";

const rateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, //limit each IP to 5 request per windowMs
  message: {
    status: "error",
    message: "Too many login attempts. Please try again later.",
  },
});

export default rateLimiter;
