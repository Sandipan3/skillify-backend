import express from "express";
import morgan from "morgan";
import cors from "cors";
import courseRoutes from "./routes/courseRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import enrollmentRoutes from "./routes/enrollmentRoutes.js";
import cookieParser from "cookie-parser";
import connectDB from "./config/connectDb.js";
import errorMiddleware from "./middlewares/errorMiddleware.js";

// app setup
const app = express();

//=========GLOBAL MIDDLEWARES===========
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [process.env.FRONTEND_URL, "http://localhost:5173"],
    credentials: true,
  })
);
//====localhost=====================
// app.use(
//   cors({
//     origin: "http://localhost:5173",
//     credentials: true,
//   })
// );
//=======================================

// MongoDB Connection
connectDB();

//routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/course", courseRoutes);
app.use("/api/v1/enrollment", enrollmentRoutes);

app.use(errorMiddleware);

export default app;
