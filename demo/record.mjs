/**
 * Records the clips for the submission video by driving the real app in headless Chrome.
 *
 * Each clip is a CDP screencast saved as public/demo/<clip>.mp4 plus public/demo/<clip>.events.json, which logs
 * where the cursor clicked, when key elements appeared (and where), and which episode the player showed.
 * src/demo/Demo.tsx edits the clips from these logs: speed-ups, zooms, a drawn cursor and narration.
 *
 * Usage: node demo/record.mjs <clip...>   clips: site make result audiences towns
 * Needs `npm run app` running, Google Chrome installed, and for "make" an API key (it runs the real newsroom).
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const APP = "http://localhost:5173";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = path.join("public", "demo");
const PORT = 9335;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Chrome over CDP ---------- */

const launch = async () => {
  const profile = path.resolve("out", "demo-chrome-profile");
  const chrome = spawn(
    CHROME,
    ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1920,1080", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--autoplay-policy=no-user-gesture-required", "--mute-audio", "about:blank"],
    { stdio: "ignore" },
  );
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    await sleep(300);
    targets = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json(), () => undefined);
  }
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      pending.get(d.id)(d.result ?? d.error);
      pending.delete(d.id);
    }
    if (d.method) listeners.forEach((l) => l(d));
  };
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  return { send, listeners, close: () => chrome.kill() };
};

/* ---------- One clip ---------- */

const record = async (name, script) => {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "frames"), { recursive: true });
  const browser = await launch();
  const { send, listeners } = browser;
  const frames = [];
  const events = [];
  let t0 = 0;
  const now = () => Date.now() / 1000 - t0;

  const js = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;
  const rectOf = (selector) => js(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  const log = (event) => events.push({ t: now(), ...event });
  const waitFor = async (selector, timeoutMs = 20000) => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const rect = await rectOf(selector);
      if (rect && rect.w > 0) return rect;
      await sleep(200);
    }
    throw new Error(`${name}: ${selector} did not appear`);
  };
  const mouse = (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, ...extra });

  const api = {
    js,
    rectOf,
    log,
    waitFor,
    sleep,
    navigate: async (url) => {
      await send("Page.navigate", { url });
      await sleep(2500);
    },
    /** Moves the (drawn) cursor to an element and clicks it with real mouse events. */
    click: async (selector, label = selector) => {
      const r = await waitFor(selector);
      const x = r.x + r.w / 2;
      const y = r.y + r.h / 2;
      log({ type: "click", x, y, label });
      await sleep(450); // time for the drawn cursor to travel
      await mouse("mouseMoved", x, y);
      await mouse("mousePressed", x, y);
      await mouse("mouseReleased", x, y);
    },
    /** Native select menus do not render headless: show a click on it, then set the value. */
    select: async (value) => {
      const r = await waitFor("select");
      log({ type: "click", x: r.x + r.w / 2, y: r.y + r.h / 2, label: `select ${value}` });
      await sleep(450);
      await js(`(() => { const s = document.querySelector("select"); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    },
    wheel: async (x, y, deltaY, times, gapMs) => {
      for (let i = 0; i < times; i++) {
        await mouse("mouseWheel", x, y, { deltaX: 0, deltaY });
        await sleep(gapMs);
      }
    },
    /** Logs when each selector first appears, with its rect, while `until` runs. */
    watch: async (marks, until) => {
      const seen = new Set();
      let done = false;
      const poll = (async () => {
        while (!done) {
          for (const [mark, selector] of Object.entries(marks)) {
            if (seen.has(mark)) continue;
            const rect = await rectOf(selector);
            if (rect && rect.w > 0) {
              seen.add(mark);
              log({ type: "mark", mark, rect });
            }
          }
          await sleep(250);
        }
      })();
      try {
        await until();
      } finally {
        done = true;
        await poll;
      }
    },
    /** The episode the app shows for a city and audience, and where the phone frame is. */
    showing: async (cityId, audience) => {
      const state = await fetch(`${APP}/api/state`).then((r) => r.json());
      const episode = state.episodes.filter((e) => e.cityId === cityId && e.audience === audience && e.voiced).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
      await waitFor(".phone > div:not(.phone-empty)");
      log({ type: "play", episodeId: episode.id, rect: await rectOf(".phone"), fromLine: 0 });
      return episode.id;
    },
  };

  listeners.add((d) => {
    if (d.method !== "Page.screencastFrame") return;
    const file = path.join(dir, "frames", `${String(frames.length).padStart(6, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(d.params.data, "base64"));
    frames.push(d.params.metadata.timestamp);
    send("Page.screencastFrameAck", { sessionId: d.params.sessionId });
  });

  const start = async () => {
    t0 = Date.now() / 1000;
    await send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  };

  let stopped = 0;
  try {
    await script({ ...api, start });
    await sleep(500);
    stopped = Date.now() / 1000;
    await send("Page.stopScreencast");
  } finally {
    browser.close();
  }

  // Frames arrive only when the page repaints; hold each one until the next to get real-time video.
  const first = frames[0];
  const startOffset = first - t0;
  // The last frame lasts until recording stopped: a page that stops changing sends no more frames.
  const end = Math.max(stopped, frames.at(-1) + 0.5);
  const list = frames.map((ts, i) => `file 'frames/${String(i).padStart(6, "0")}.jpg'\nduration ${((frames[i + 1] ?? end) - ts).toFixed(4)}`);
  list.push(`file 'frames/${String(frames.length - 1).padStart(6, "0")}.jpg'`);
  fs.writeFileSync(path.join(dir, "frames.txt"), list.join("\n"));
  const cli = path.join("node_modules", "@remotion", "cli", "remotion-cli.js");
  const encode = () =>
    spawnSync(process.execPath, [cli, "ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "frames.txt"), "-fps_mode", "cfr", "-r", "30", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "16", path.join(OUT, `${name}.mp4`)], { stdio: "inherit" });
  // Once seen failing right after Chrome exited and passing when rerun on the same files, so try twice.
  if (encode().status !== 0 && (await sleep(1500), encode().status !== 0)) throw new Error(`${name}: ffmpeg failed`);
  // Event times are relative to the first frame, which is t = 0 in the video.
  const shifted = events.map((e) => ({ ...e, t: Math.max(0, e.t - startOffset) }));
  fs.writeFileSync(path.join(OUT, `${name}.events.json`), JSON.stringify({ duration: end - first, events: shifted }, null, 2));
  fs.rmSync(path.join(dir, "frames"), { recursive: true, force: true });
  console.log(`${name}: ${frames.length} frames, ${(frames.at(-1) - first).toFixed(1)}s, ${events.length} events`);
};

/* ---------- Scenario ---------- */

/**
 * Moves matching episode scripts out of the app's sight (it lists episodes from episodes/*.json); returns what
 * moved so it can be put back. Narration folders stay: Vite watches them, and Windows refuses to rename them.
 */
const setAside = (pattern) => {
  const backup = path.join("out", "demo-backup");
  fs.mkdirSync(backup, { recursive: true });
  const moved = fs.readdirSync("episodes").filter((f) => pattern.test(f)).map((f) => [path.join("episodes", f), path.join(backup, f)]);
  for (const [from, to] of moved) fs.renameSync(from, to);
  return moved;
};

const restore = (moved) => {
  for (const [from, to] of moved) if (!fs.existsSync(from) && fs.existsSync(to)) fs.renameSync(to, from);
};

const makeRun = async (a) => {
  await a.navigate(APP);
  await ready(a);
  await a.start();
  await a.sleep(1200);
  await a.select("kumakogen");
  await a.sleep(600);
  await a.click(".audience button:first-child", "一般");
  await a.sleep(600);
  if (await a.js(`document.querySelector(".check input")?.checked ?? false`)) {
    await a.click(".check input", "reuse off");
    await a.sleep(500);
  }
  await a.click(".go", "取材をはじめる");
  await a.watch(
    {
      desk: ".neta-item",
      facts: ".memo",
      writer: ".genko-line",
      check: ".redpen li, .passed",
      revise: ".revision",
      stamp: ".hanko:not(.small)",
      voice: ".meter",
      done: ".t-line",
    },
    () => a.waitFor(".t-line", 15 * 60 * 1000),
  );
  await a.log({ type: "play", episodeId: await a.js(`fetch("/api/state").then(r => r.json()).then(s => s.episodes.filter(e => e.cityId === "kumakogen" && e.audience === "general").sort((x, y) => x.date.localeCompare(y.date)).at(-1).id)`), rect: await a.rectOf(".phone"), fromLine: 0 });
  await a.sleep(6000);
};

/** The app has loaded its towns (closed <option>s have no size, so count them instead). */
const ready = async (a) => {
  await a.waitFor("select");
  for (let i = 0; i < 100; i++) {
    if (await a.js(`document.querySelectorAll("select option").length > 1`)) return;
    await a.sleep(200);
  }
  throw new Error("app did not load its towns");
};

const CLIPS = {
  /** The town's own website and the PDF nobody reads. */
  site: async (a) => {
    await a.navigate("https://www.kumakogen.jp/soshiki/8/27111.html");
    await a.start();
    await a.sleep(1500);
    await a.wheel(960, 600, 120, 6, 500);
    await a.sleep(800);
    a.log({ type: "mark", mark: "pdf" });
    await a.navigate("https://www.kumakogen.jp/uploaded/attachment/15391.pdf");
    await a.wheel(1100, 600, 400, 18, 450);
    await a.sleep(1000);
  },

  /** A full newsroom run, from the button to the finished video. Starts with no Kumakogen general episode on screen. */
  make: async (a) => {
    let moved = [];
    try {
      moved = setAside(/^kumakogen-.*-general(\.facts)?\.json$/);
      await makeRun(a);
    } catch (err) {
      restore(moved);
      throw err;
    }
  },
  /** Playback, jumping to a line, and opening the cited page of the PDF. */
  result: async (a) => {
    await a.navigate(APP);
    await ready(a);
    await a.waitFor(".t-line");
    await a.start();
    await a.showing("kumakogen", "general");
    await a.sleep(12000);
    await a.click(".t-line:nth-child(4)", "line 4");
    a.log({ type: "play", fromLine: 3, rect: await a.rectOf(".phone") });
    await a.sleep(5000);
    // The link opens a new tab in the app; a headless background tab stops answering input, so open it here.
    await a.js(`document.querySelector(".t-line:nth-child(4) .t-page")?.setAttribute("target", "_self")`);
    await a.click(".t-line:nth-child(4) .t-page", "出典");
    a.log({ type: "stop" });
    await a.sleep(3000);
    // A still PDF sends no screencast frames, so scroll slowly through the cited page.
    await a.wheel(1100, 600, 40, 14, 380);
  },

  /** The same story for other audiences. */
  audiences: async (a) => {
    await a.navigate(APP);
    await ready(a);
    await a.start();
    await a.sleep(800);
    for (const [label, audience] of [["シニア", "seniors"], ["やさしい日本語", "easy"]]) {
      await a.click(`.audience button:nth-child(${audience === "seniors" ? 3 : 4})`, label);
      await a.sleep(1200);
      await a.showing("kumakogen", audience);
      await a.sleep(7000);
    }
  },

  /** Other towns whose whole site is open data. */
  towns: async (a) => {
    await a.navigate(APP);
    await ready(a);
    await a.start();
    await a.sleep(800);
    for (const city of ["komono", "hokkaido-mori", "muroran"]) {
      await a.select(city);
      await a.sleep(1200);
      await a.showing(city, "general");
      await a.sleep(6000);
    }
  },
};

const names = process.argv.slice(2);
if (names.length === 0 || names.some((n) => !CLIPS[n])) {
  console.error(`Usage: node demo/record.mjs <${Object.keys(CLIPS).join("|")}>...`);
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
for (const name of names) await record(name, CLIPS[name]);
