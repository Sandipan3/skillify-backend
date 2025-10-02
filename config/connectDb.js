import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

//Connection to MongoDb
const connectDB = async () => {
  await mongoose
    .connect(process.env.DB_URL)
    .then((conn) => {
      console.log("MongoDB connection was successful! Now trying to ping.");
      return conn.connection.db.admin().ping();
    })
    .then((res) => {
      console.log("Ping result:", res);
      console.log("MongoDB connection is alive (ping successful)");
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
};

export default connectDB;
