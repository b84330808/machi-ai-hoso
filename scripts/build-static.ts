/**
 * Public playback build: the web app without a server, for GitHub Pages or any static host.
 * It plays the voiced episodes and replays recorded newsroom runs (episodes/<id>.log.json); it cannot make new ones.
 *
 * Usage: npm run build:static  →  dist/
 */
import fs from "node:fs";
import path from "node:path";
import { build } from "vite";
import { listCities } from "./city";
import { listEpisodes, logFile, readEpisode } from "./library";

const OUT = path.resolve("dist");
fs.rmSync(OUT, { recursive: true, force: true });

process.env.VITE_STATIC = "1";
// Relative base, so the site works under any path (https://<user>.github.io/<repo>/).
// publicDir is off: public/ also holds the demo recordings, which must not ship.
await build({ configFile: path.resolve("vite.config.ts"), base: "./", publicDir: false, build: { outDir: OUT, emptyOutDir: true }, logLevel: "warn" });

const write = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(value));
};

const cities = listCities();
const episodes = listEpisodes().filter((e) => e.voiced && e.cityId && cities.some((c) => c.id === e.cityId));
write("data/state.json", { hasApiKey: false, cities, episodes: episodes.map((e) => ({ ...e, mp4: false })) });

for (const e of episodes) {
  write(`data/episodes/${e.id}.json`, readEpisode(e.id));
  if (e.hasLog) {
    fs.mkdirSync(path.join(OUT, "data", "logs"), { recursive: true });
    fs.copyFileSync(logFile(e.id), path.join(OUT, "data", "logs", `${e.id}.json`));
  }
  fs.cpSync(path.join("public", "episodes", e.id), path.join(OUT, "episodes", e.id), { recursive: true });
}
fs.cpSync(path.join("public", "audio"), path.join(OUT, "audio"), { recursive: true });
// GitHub Pages would otherwise run the files through Jekyll.
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");

const size = (dir: string): number => fs.readdirSync(dir, { withFileTypes: true }).reduce((s, d) => s + (d.isDirectory() ? size(path.join(dir, d.name)) : fs.statSync(path.join(dir, d.name)).size), 0);
console.log(`dist/: ${episodes.length} episodes (${episodes.filter((e) => e.hasLog).length} with a recorded run), ${(size(OUT) / 1e6).toFixed(1)} MB`);
