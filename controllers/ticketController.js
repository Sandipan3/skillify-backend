import { sendErrorResponse, sendSuccessResponse } from "../utils/response.js";
import User from "../models/User.js";
import Ticket from "../models/Ticket.js";
import {
  sendTicketCreationMail,
  sendTicketUpgradeApprovedMail,
  sendTicketUpgradeRejectedMail,
} from "../services/sendMail.js";
import redis from "../config/redis.js";

// create ticket for role change
export const createTicket = async (req, res) => {
  try {
    const { requestedRole } = req.body;
    const userId = req.user.userId;

    if (!requestedRole) {
      return sendErrorResponse(res, "requestedRole is required", 400);
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendErrorResponse(res, "No user found", 404);
    }

    if (user.roles.includes(requestedRole)) {
      return sendErrorResponse(res, "Role already assigned", 400);
    }

    const existingTicket = await Ticket.findOne({
      user: userId,
      status: "created",
    });

    if (existingTicket) {
      return sendErrorResponse(res, "Pending ticket already exists", 400);
    }

    const ticket = await Ticket.create({
      currentRole: [...req.user.roles],
      requestedRole,
      user: user._id,
      approvedBy: null,
      status: "created",
    });

    await sendTicketCreationMail(user.email, ticket._id);

    return sendSuccessResponse(
      res,
      {
        message: "Your ticket has been created. Wait for admin approval",
        ticket,
      },
      201,
    );
  } catch (error) {
    return sendErrorResponse(res, "Unable to create ticket", 500);
  }
};

// change ticket by admin
export const changeTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { action } = req.body;
    const adminId = req.user.userId;

    if (!action) {
      return sendErrorResponse(res, "Action is required", 400);
    }

    if (!["approved", "rejected"].includes(action)) {
      return sendErrorResponse(res, "Invalid action", 400);
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return sendErrorResponse(res, "Invalid ticket", 404);
    }

    if (ticket.status !== "created") {
      return sendErrorResponse(res, "Ticket already processed", 400);
    }

    const user = await User.findById(ticket.user);
    if (!user) {
      return sendErrorResponse(res, "User not found", 404);
    }

    // prevent self-approval
    if (ticket.user.toString() === adminId) {
      return sendErrorResponse(res, "Cannot approve own ticket", 403);
    }

    if (action === "rejected") {
      ticket.status = "rejected";
      ticket.approvedBy = adminId;
      await ticket.save();

      await sendTicketUpgradeRejectedMail(user.email);

      return sendSuccessResponse(res, {
        message: "Role change request rejected",
      });
    }

    // APPROVED
    if (!user.roles.includes(ticket.requestedRole)) {
      user.roles.push(ticket.requestedRole);
      await user.save();
    }

    ticket.status = "approved";
    ticket.approvedBy = adminId;
    await ticket.save();

    await sendTicketUpgradeApprovedMail(user.email);

    // invalidate cache
    try {
      await redis.del(`user:profile:${user._id}`);
    } catch (err) {
      console.error("Redis error:", err.message);
    }

    return sendSuccessResponse(res, {
      message: "Role upgraded successfully. Please login again.",
    });
  } catch (error) {
    return sendErrorResponse(res, "Unable to process ticket", 500);
  }
};

//get created tickets
export const getTickets = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalTickets = await Ticket.countDocuments({
      status: "created",
    });
    const totalPages = Math.ceil(totalTickets / limit);

    const tickets = await Ticket.find({ status: "created" })
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return sendSuccessResponse(
      res,
      {
        page,
        limit,
        totalTickets,
        totalPages,
        tickets,
      },
      200,
    );
  } catch (error) {
    return sendErrorResponse(res, "Unable to get tickets", 500);
  }
};

// get a ticket this determines if we send a new ticket req or fetch the old one
export const getMyTicket = async (req, res) => {
  try {
    const userId = req.user.userId;

    const ticket = await Ticket.findOne({
      user: userId,
      status: "created",
    }).sort({ createdAt: -1 });

    if (!ticket) {
      return sendSuccessResponse(res, { ticket: null }, 200);
    }

    return sendSuccessResponse(res, { ticket }, 200);
  } catch (error) {
    return sendErrorResponse(res, "Unable to fetch ticket", 500);
  }
};
