import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/*
    <div
  style={{
    position: "relative",
    minHeight: "100vh",
    backgroundImage: "url('/replog/background.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  }}
>
  {/* Overlay }
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: "rgba(255, 255, 255, 0.6)", // transparency
      backdropFilter: "blur(6px)",            // blur effect
      WebkitBackdropFilter: "blur(6px)",      // Safari support
    }}
  />

  {/* Actual app content *}
  <div style={{ position: "relative", zIndex: 1 }}>
    
  </div>
</div>
*/}

<App />

  </StrictMode>
);
