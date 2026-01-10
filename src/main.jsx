import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";


createRoot(document.getElementById("root")).render(
  <StrictMode>

<App />

  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then((reg) => console.log("Service Worker registriert:", reg))
      .catch((err) => console.error("Service Worker Registrierung fehlgeschlagen:", err));
  });
}

