import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import userRoutes from "./src/routes/user.routes.js";
import inventoryRoute from "./src/routes/inventoryRoutes.js";
import connectDB from "./src/config/db.js";
import customerRoutes from "./src/routes/customerRoutes.js";
import morgan from "morgan"; // 1. Import Morgan

const app = express();

// 2. Use Morgan middleware (using the 'dev' format)
app.use(morgan("dev"));

// Connect to MongoDB

connectDB();
// Middleware
const allowedOrigins = [
  "http://localhost:5173", // Standard Vite frontend port
  "https://albiappbackend.onrender.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      } else {
        return callback(new Error("Blocked by CORS policy"));
      }
    },
    credentials: true, // Allows frontend to pass cookies or Authorization headers
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());

// Routes
app.use("/api/auth", userRoutes);
app.use("/api/product", inventoryRoute);
app.use("/api/customer", customerRoutes);

// Healthcheck Route
app.get("/", (req, res) => {
  res.send("ALBIJO Backend API is running...");
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
