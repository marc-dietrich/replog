import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

function syncThemeColorWithPreference() {
  if (typeof window === "undefined") return;
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (!metaThemeColor) return;
  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
  const applyColor = () => {
    const styles = getComputedStyle(document.documentElement);
    const lightColor = styles.getPropertyValue("--status-bar-light").trim() || "#F8F9FA";
    const darkColor = styles.getPropertyValue("--status-bar-dark").trim() || "#121212";
    metaThemeColor.setAttribute("content", mediaQuery?.matches ? darkColor : lightColor);
  };
  applyColor();
  if (!mediaQuery) return;
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", applyColor);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(applyColor);
  }
}

syncThemeColorWithPreference();

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
      .then((reg) => console.log("Service worker registered:", reg))
      .catch((err) => console.error("Service worker registration failed:", err));
  });
}

