import React from "react";
import { createRoot } from "react-dom/client";
import ReviewerClient from "../app/reviewer/reviewer-client";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <React.StrictMode>
    <ReviewerClient />
  </React.StrictMode>,
);
