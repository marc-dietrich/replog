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
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;

    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL })
      .then((reg) => console.log("Service Worker registriert:", reg))
      .catch((err) => console.error("Service Worker Registrierung fehlgeschlagen:", err));
  });
}

