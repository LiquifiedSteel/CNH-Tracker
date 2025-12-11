// server/server.js

// Core dependencies
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const requireApiKey = require("./auth/apiKey");

// Create app
const app = express();
const PORT = process.env.PORT || 5001;

// ----------------- Global security middleware -----------------

// Security-related HTTP headers (HSTS, no-sniff, etc.)
app.use(helmet());

// CORS – adjust origin to your actual frontend domain in production
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*", // e.g. "https://yourdomain.com"
    credentials: false,
  })
);

// No-index / nofollow for all responses
app.use((req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});

// robots.txt that disallows everything
app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send("User-agent: *\nDisallow: /");
});

// Body parsers with size limits
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// ----------------- Static files -----------------

// Serve built React app
app.use(express.static(path.join(__dirname, "..", "build")));

// ----------------- API security -----------------

// Basic rate limiting for all /api routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // 100 requests per IP per window
});

// Apply rate limit and API key auth to all /api routes
app.use("/api", apiLimiter, requireApiKey);

// ----------------- Routes -----------------

const sheets = require("./routes/googlesheets.router");

// Mount routers under /api
app.use("/api/googleSheets", sheets);

// ----------------- Catch-all for SPA (optional) -----------------
// If you want React Router to handle unknown paths, uncomment:
//
// const fs = require("fs");
// app.get("*", (req, res, next) => {
//   if (req.path.startsWith("/api/")) return next();
//   const indexPath = path.join(__dirname, "..", "build", "index.html");
//   if (fs.existsSync(indexPath)) {
//     return res.sendFile(indexPath);
//   }
//   next();
// });

// ----------------- Error handler -----------------

// Generic error handler so you don't leak stack traces to clients
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  const status = err.status || 500;
  const body = { ok: false, error: "Internal server error" };

  if (process.env.NODE_ENV !== "production" && err.message) {
    body.details = err.message;
  }

  res.status(status).json(body);
});

// ----------------- Start server -----------------

app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
});