// Dependencies
const express = require("express");
const app = express();
require("dotenv").config();
const PORT = process.env.PORT || 5001;

// --- No-index / nofollow for all responses ---
app.use((req, res, next) => {
  // Helps keep all content out of search results (covers non-HTML too)
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});

// --- robots.txt that disallows everything ---
// Put this BEFORE express.static so it always wins.
app.get("../robots.txt", (_req, res) => {
  res
    .type("text/plain")
    .send("User-agent: *\nDisallow: /");
});

// Route Includes
const test = require("./routes/test.router");
const sheets = require("./routes/googlesheets.router");

// Express Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (after robots.txt so our custom one wins)
app.use(express.static("build"));

// Routes
app.use("/api/test", test);
app.use("/api/googleSheets", sheets);

// Listen Server & Port
app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
});