/**
 * Local app server: the web UI (Vite) plus a small JSON/SSE API that runs the newsroom,
 * narration and MP4 rendering as jobs.
 *
 * Usage: npm run app  →  http://localhost:5173
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createServer as createVite } from "vite";
import { listCities } from "../scripts/city";
import type { Audience, JobEvent } from "../scripts/events";
import { isVoiced, mp4File, render, voice } from "../scripts/media";
import { hasApiKey, runNewsroom } from "../scripts/newsroom";

const PORT = Number(process.env.PORT ?? 5173);
const AUDIENCES: Audience[] = ["general", "parents", "seniors", "easy"];
const EPISODE_ID = /^(.+)-(\d{4}-\d{2}-\d{2})-(general|parents|seniors|easy)$/;

/* ---------- Jobs ---------- */

type Job = { events: JobEvent[]; listeners: Set<(e: JobEvent) => void>; finished: boolean };
const jobs = new Map<string, Job>();

const startJob = (work: (emit: (e: JobEvent) => void) => Promise<string>) => {
  const id = randomUUID();
  const job: Job = { events: [], listeners: new Set(), finished: false };
  jobs.set(id, job);
  const emit = (e: JobEvent) => {
    job.events.push(e);
    job.listeners.forEach((l) => l(e));
  };
  work(emit)
    .then((episodeId) => emit({ type: "done", episodeId }))
    .catch((err: Error) => {
      console.error(err);
      emit({ type: "error", message: err.message });
    })
    .finally(() => {
      job.finished = true;
      job.listeners.clear();
    });
  return id;
};

const lineTotal = (episodeId: string) =>
  JSON.parse(fs.readFileSync(path.join("episodes", `${episodeId}.json`), "utf-8")).scenes.flatMap((s: { lines: unknown[] }) => s.lines).length;

const voiceStep = async (episodeId: string, emit: (e: JobEvent) => void) => {
  emit({ type: "step", step: "voice", state: "start" });
  const total = lineTotal(episodeId);
  let done = 0;
  await voice(episodeId, (lineId) => emit({ type: "voiced", lineId, done: ++done, total }));
  emit({ type: "step", step: "voice", state: "done" });
  return episodeId;
};

/* ---------- Episodes on disk ---------- */

const listEpisodes = () =>
  fs
    .readdirSync("episodes")
    .filter((f) => f.endsWith(".json") && !f.endsWith(".facts.json"))
    .map((f) => {
      const id = path.basename(f, ".json");
      const m = id.match(EPISODE_ID);
      const { title } = JSON.parse(fs.readFileSync(path.join("episodes", f), "utf-8"));
      return { id, cityId: m?.[1] ?? null, date: m?.[2] ?? null, audience: m?.[3] ?? null, title, voiced: isVoiced(id), mp4: fs.existsSync(mp4File(id)) };
    });

const readEpisode = (id: string) => {
  const factsFile = path.join("episodes", `${id}.facts.json`);
  return {
    episode: JSON.parse(fs.readFileSync(path.join("episodes", `${id}.json`), "utf-8")),
    ...(fs.existsSync(factsFile) ? JSON.parse(fs.readFileSync(factsFile, "utf-8")) : { story: null, facts: [] }),
  };
};

/* ---------- HTTP ---------- */

const json = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

const readBody = async (req: http.IncomingMessage) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
};

const safeId = (id: unknown): string => {
  if (typeof id !== "string" || !/^[\w-]+$/.test(id)) throw new Error("invalid id");
  return id;
};

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

const MIME: Record<string, string> = { ".json": "application/json", ".mp3": "audio/mpeg", ".mp4": "video/mp4" };

/** Static file with Range support, which the browser needs to seek inside audio. */
const sendFile = (req: http.IncomingMessage, res: http.ServerResponse, file: string, download?: string) => {
  if (!fs.existsSync(file)) return json(res, 404, { error: "not found" });
  const size = fs.statSync(file).size;
  const headers = {
    "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    ...(download ? { "Content-Disposition": `attachment; filename="${download}"` } : {}),
  };
  const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, "Content-Length": size });
  fs.createReadStream(file).pipe(res);
};

const api = async (req: http.IncomingMessage, res: http.ServerResponse, url: URL) => {
  const route = `${req.method} ${url.pathname}`;

  if (route === "GET /api/state") return json(res, 200, { hasApiKey: hasApiKey(), cities: listCities(), episodes: listEpisodes() });

  if (route === "POST /api/make") {
    if (!hasApiKey()) return json(res, 400, { error: "ANTHROPIC_API_KEY is not set" });
    const { cityId, audience, reuseFacts } = await readBody(req);
    if (!listCities().some((c) => c.id === cityId) || !AUDIENCES.includes(audience)) return json(res, 400, { error: "unknown city or audience" });
    const jobId = startJob(async (emit) => voiceStep(await runNewsroom({ cityId, audience, date: today(), reuseFacts: !!reuseFacts }, emit), emit));
    return json(res, 200, { jobId });
  }

  if (route === "POST /api/voice") {
    const episodeId = safeId((await readBody(req)).episodeId);
    return json(res, 200, { jobId: startJob((emit) => voiceStep(episodeId, emit)) });
  }

  if (route === "POST /api/render") {
    const episodeId = safeId((await readBody(req)).episodeId);
    const jobId = startJob(async (emit) => {
      emit({ type: "step", step: "render", state: "start" });
      await render(episodeId, (done, total) => emit({ type: "rendered", done, total }));
      emit({ type: "step", step: "render", state: "done" });
      return episodeId;
    });
    return json(res, 200, { jobId });
  }

  const jobMatch = url.pathname.match(/^\/api\/jobs\/([\w-]+)$/);
  if (req.method === "GET" && jobMatch) {
    const job = jobs.get(jobMatch[1]);
    if (!job) return json(res, 404, { error: "no such job" });
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const send = (e: JobEvent) => res.write(`data: ${JSON.stringify(e)}\n\n`);
    job.events.forEach(send);
    if (job.finished) return res.end();
    const listener = (e: JobEvent) => {
      send(e);
      if (e.type === "done" || e.type === "error") res.end();
    };
    job.listeners.add(listener);
    req.on("close", () => job.listeners.delete(listener));
    return;
  }

  const episodeMatch = url.pathname.match(/^\/api\/episodes\/([\w-]+)$/);
  if (req.method === "GET" && episodeMatch) return json(res, 200, readEpisode(safeId(episodeMatch[1])));

  json(res, 404, { error: "not found" });
};

const server = http.createServer();
// NO_HMR=1 keeps pages from reloading when files change, e.g. while demo/record.mjs is recording.
const hmr = process.env.NO_HMR ? false : { server };
const vite = await createVite({ configFile: path.resolve("vite.config.ts"), server: { middlewareMode: true, hmr }, appType: "spa" });

server.on("request", (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    api(req, res, url).catch((err: Error) => json(res, 500, { error: err.message }));
    return;
  }
  // Narration is written while the server runs, so serve it straight from disk.
  const voiced = url.pathname.match(/^\/episodes\/([\w-]+)\/([\w.-]+)$/);
  if (voiced) return sendFile(req, res, path.join("public", "episodes", voiced[1], voiced[2]));
  const mp4 = url.pathname.match(/^\/out\/([\w-]+)\.mp4$/);
  if (mp4) return sendFile(req, res, mp4File(mp4[1]), `${mp4[1]}.mp4`);
  vite.middlewares(req, res);
});

server.listen(PORT, () => console.log(`まちのAI放送局: http://localhost:${PORT}  (API key: ${hasApiKey() ? "set" : "not set — playback only"})`));
