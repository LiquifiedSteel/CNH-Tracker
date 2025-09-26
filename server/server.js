// Dependancies
const express = require("express");
const app = express();
require("dotenv").config();
const PORT = process.env.PORT || 5001;

// Route Includes
const test = require("./routes/test.router");
const sheets = require("./routes/googlesheets.router");

// Express Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("build"));

// Routes
app.use("/api/test", test);
app.use("/api/googleSheets", sheets);

// Listen Server & Port
app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
});