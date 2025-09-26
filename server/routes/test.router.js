const express = require("express"); // Import the Express framework to handle routing and HTTP requests.
const router = express.Router(); // Create a new Express router to define routes.

router.get('/', (req, res) => {
    console.log("Server Working");
    res.send("Hello World");
});

module.exports = router;