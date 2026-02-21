import redis from "../config/redis.js";
import { sendErrorResponse } from "../utils/response.js";

const rateLimit = async (req, res, next) => {
  try {
    const maxRequests = 5;
    const windowSeconds = 5 * 60; //5 minutes

    const id = req.user?.userId || req.ip;
    const key = `rate_limit:${id}`;

    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    if (current > maxRequests) {
      const ttl = await redis.ttl(key);

      return sendErrorResponse(
        res,
        `Too many requests. Try again after ${ttl} seconds.`,
        429,
      );
    }

    next();
  } catch (error) {
    console.error("Rate limit error:", error.message);
    next();
  }
};

export default rateLimit;
