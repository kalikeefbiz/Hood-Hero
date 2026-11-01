import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/700-italic.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/600.css";
import "./ui/style.css";
import "./ui/art-direction.css";
import "./ui/illustrated-actions.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
