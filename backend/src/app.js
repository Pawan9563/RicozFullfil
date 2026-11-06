import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middlewares/error.middleware.js";

// Route imports
import authRouter from "./routes/auth.routes.js";
import userRouter from "./routes/user.routes.js";
import productRouter from "./routes/product.routes.js";
import inventoryRouter from "./routes/inventory.routes.js";
import warehouseRouter from "./routes/warehouse.routes.js";
import orderRouter from "./routes/order.routes.js";
import pickListRouter from "./routes/pickList.routes.js";
import packageRouter from "./routes/package.routes.js";
import shipmentRouter from "./routes/shipment.routes.js";
import returnRouter from "./routes/return.routes.js";
import analyticsRouter from "./routes/analytics.routes.js";
import onboardingRouter from "./routes/onboarding.routes.js";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Routes declaration
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/inventory", inventoryRouter);
app.use("/api/v1/warehouses", warehouseRouter);
app.use("/api/v1/orders", orderRouter);
app.use("/api/v1/pick-lists", pickListRouter);
app.use("/api/v1/packages", packageRouter);
app.use("/api/v1/shipments", shipmentRouter);
app.use("/api/v1/returns", returnRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/onboarding", onboardingRouter);

// Global Error Handler Middleware
app.use(errorHandler);

export { app };
