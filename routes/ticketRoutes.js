import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import allowedRoles from "../middlewares/roleMiddleware.js";
import { changeTicket, createTicket } from "../controllers/ticketController.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/create", allowedRoles("student", "instructor"), createTicket);
router.get("/", allowedRoles("admin"), getTickets);
router.patch("/:ticketId", allowedRoles("admin"), changeTicket);

export default router;
