import { defineConfig } from "vite";

// The web UI lives in web/ and shares public/ (narration, SFX, BGM) with the Remotion renderer.
export default defineConfig({
  root: "web",
  publicDir: "../public",
  oxc: { jsx: { runtime: "automatic" } },
});
