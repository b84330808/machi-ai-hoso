import { createRoot } from "react-dom/client";
import { STATIC } from "./api";
import { App } from "./App";
import "./styles.css";

// The playback build may be served from a sub-path (e.g. GitHub Pages); Remotion's staticFile() resolves
// narration and sound effects against this base instead of the site root.
if (STATIC) {
  (window as unknown as { remotion_staticBase: string }).remotion_staticBase = new URL(import.meta.env.BASE_URL, location.href).pathname.replace(/\/$/, "");
}

createRoot(document.getElementById("root")!).render(<App />);
