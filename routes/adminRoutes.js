import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import allowedRoles from "../middlewares/roleMiddleware.js";
import {
  acceptAdminInvite,
  adminInvite,
} from "../controllers/adminController.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/invite", allowedRoles("admin"), adminInvite);

router.post("/accept-invite", acceptAdminInvite);

export default router;
