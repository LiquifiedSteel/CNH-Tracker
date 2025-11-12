import 'bootstrap/dist/css/bootstrap.min.css';

// Use BrowserRouter from react-router-dom for web apps
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

// Import your page components (default exports assumed).
// Adjust the relative paths to match your project structure.
import Home from "../Home/Home";         // example: src/Home/Home.jsx
import ComputerDetails from '../ComputerDetails/ComputerDetails';
import Total from '../Total/Total';
import Pending from '../Pending/Pending';

export default function App() {
  // Example: replace this with your real auth/user state (context, redux, etc.)
  // For now it's a simple placeholder so the example routes render.
  const user = { id: null }; // or { id: "abc" } to simulate logged-in

  return (
    // BrowserRouter provides the HTML5 history-based routing
    <BrowserRouter>
      <Routes>
        {/* redirect root to /home */}
        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* home route */}
        <Route path="/home" element={<Home />} />

        <Route path="/computers" element={<ComputerDetails />} />

        <Route path="/total" element={<Total />} />

        <Route path="/pending" element={<Pending />} />

        {/* optional: a catch-all 404 route */}
        <Route path="*" element={<div>404 — Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}
