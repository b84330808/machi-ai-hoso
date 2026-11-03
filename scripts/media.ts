/** Narration (scripts/tts.py) and MP4 rendering (Remotion CLI) as child processes with progress callbacks. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const run = (command: string, args: string[], onLine: (line: string) => void) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    let tail = "";
    const read = (chunk: Buffer) => {
      const text = chunk.toString("utf-8");
      tail = (tail + text).slice(-2000);
      // Remotion redraws its progress bar with \r, so split on both.
      text.split(/[\r\n]+/).filter(Boolean).forEach(onLine);
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}\n${tail}`))));
  });

export const episodeFile = (episodeId: string) => path.join("episodes", `${episodeId}.json`);
export const isVoiced = (episodeId: string) => fs.existsSync(path.join("public", "episodes", episodeId, "manifest.json"));
export const mp4File = (episodeId: string) => path.join("out", `${episodeId}.mp4`);

/** Synthesizes every line; calls onLine with each finished line id. */
export const voice = (episodeId: string, onLine: (lineId: string) => void) =>
  run("python", ["-X", "utf8", path.join("scripts", "tts.py"), episodeFile(episodeId)], (line) => {
    const id = line.match(/^(\S+): [\d.]+s/)?.[1];
    if (id) onLine(id);
  });

/** Renders out/<episodeId>.mp4; onProgress gets permille, counting frame rendering as 80% and encoding as 20%. */
export const render = async (episodeId: string, onProgress: (done: number, total: number) => void) => {
  fs.mkdirSync("out", { recursive: true });
  const props = path.join("out", `${episodeId}.props.json`);
  fs.writeFileSync(props, JSON.stringify({ episodeId, timeline: null }));
  const cli = path.join("node_modules", "@remotion", "cli", "remotion-cli.js");
  let best = 0;
  await run(process.execPath, [cli, "render", "Episode", mp4File(episodeId), `--props=${props}`], (line) => {
    const m = line.match(/(Rendered|Encoded)\D*(\d+)\/(\d+)/);
    if (!m) return;
    const frac = Number(m[2]) / Number(m[3]);
    const permille = Math.round((m[1] === "Rendered" ? frac * 0.8 : 0.8 + frac * 0.2) * 1000);
    if (permille <= best) return;
    best = permille;
    onProgress(permille, 1000);
  });
  fs.rmSync(props, { force: true });
};
