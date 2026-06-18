import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { MotionProvider } from "./lib/motion";
import "./styles/tailwind-entry.css";
import "./styles/app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MotionProvider>
      <App />
    </MotionProvider>
  </React.StrictMode>
);
