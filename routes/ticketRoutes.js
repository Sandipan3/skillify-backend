import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import allowedRoles from "../middlewares/roleMiddleware.js";
import {
  changeTicket,
  createTicket,
  getMyTicket,
  getTickets,
} from "../controllers/ticketController.js";
import rateLimit from "../middlewares/rateLimiter.js";

const router = express.Router();

router.use(authMiddleware);

router.post(
  "/create",
  allowedRoles("student", "instructor"),
  rateLimit,
  createTicket,
);
router.get("/", allowedRoles("admin"), getTickets);
router.patch("/:ticketId", allowedRoles("admin"), changeTicket);
router.get("/my", allowedRoles("student", "instructor"), getMyTicket);

export default router;
