/**
 * Newsroom pipeline: municipal PDFs → cited facts → episode JSON.
 *
 *   desk     picks the item that matters most to residents (structured output)
 *   facts    extracts facts with page-level citations (Citations API)
 *   writer   writes the episode in the renderer's schema (structured output, streamed)
 *   checks   numbers must come from cited facts; a fact checker reviews the script
 *   revise   up to two rewrite rounds while any check fails
 *
 * Every step reports progress through `emit`, so the CLI and the web UI share this code.
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { Episode, type Line } from "../src/schema";
import { CityConfig, docPath, fetchSources, loadCity } from "./city";
import type { Audience, Fact, Issue, JobEvent, Story } from "./events";
import { DESK_SYSTEM, FACTS_SYSTEM, REVIEW_SYSTEM, WRITER_SYSTEM } from "./prompts";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env: rely on the environment.
}

export const hasApiKey = () => !!process.env.ANTHROPIC_API_KEY;

const MODEL = "claude-opus-5-5";
const MAX_REVISIONS = 2;
// Re-runs a declined request on a fallback model inside the same call.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

export type NewsroomOptions = {
  cityId: string;
  audience: Audience;
  date: string;
  hint?: string;
  /** Skip desk and facts by reusing the latest facts extracted for this city. */
  reuseFacts?: boolean;
};

type Emit = (event: JobEvent) => void;

export const episodeIdFor = (cityId: string, date: string, audience: Audience) => `${cityId}-${date}-${audience}`;

const assertNotRefused = (msg: Anthropic.Beta.BetaMessage, step: string) => {
  if (msg.stop_reason === "refusal") throw new Error(`${step}: refused (${msg.stop_details?.category ?? "unknown"})`);
  if (msg.stop_reason === "max_tokens") throw new Error(`${step}: hit max_tokens`);
};

const documents = (city: CityConfig, citations: boolean): Anthropic.Beta.BetaRequestDocumentBlock[] =>
  city.docs.map((doc, i) => ({
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: fs.readFileSync(docPath(city, doc)).toString("base64") },
    title: doc.title,
    citations: { enabled: citations },
    ...(i === city.docs.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));

/* ---------- 1. Desk ---------- */

const Stories = z.object({
  stories: z.array(
    z.object({
      headline: z.string().describe("One-line headline in Japanese"),
      who: z.string().describe("Who is affected"),
      change: z.string().describe("What changes for them, with numbers"),
      status: z.enum(["decided", "proposal", "info"]),
      residentAction: z.string().describe("What residents can do and by when, or なし").optional(),
      impact: z.number().int().describe("1 (minor) to 5 (changes most households' daily life or money)"),
    }),
  ),
});

const pickStory = async (client: Anthropic, city: CityConfig, hint?: string) => {
  const msg = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    ...FALLBACK,
    output_config: { effort: "medium", format: betaZodOutputFormat(Stories) },
    system: DESK_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...documents(city, false),
          { type: "text", text: `${city.prefecture}${city.city}の公開資料です。住民向けニュースの候補を挙げてください。${hint ? `特に「${hint}」に関する項目を優先してください。` : ""}` },
        ],
      },
    ],
  });
  assertNotRefused(msg, "desk");
  const stories = [...(msg.parsed_output?.stories ?? [])].sort((a, b) => b.impact - a.impact);
  if (stories.length === 0) throw new Error("desk: no stories found");
  return stories;
};

/* ---------- 2. Facts with citations ---------- */

const extractFacts = async (client: Anthropic, city: CityConfig, story: Story): Promise<Fact[]> => {
  const msg = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    ...FALLBACK,
    output_config: { effort: "medium" },
    system: FACTS_SYSTEM,
    messages: [
      {
        role: "user",
        content: [...documents(city, true), { type: "text", text: `ニュース項目：${story.headline}\n対象：${story.who}\n変化：${story.change}\n\nこの項目について、住民が知るべき事実を挙げてください。` }],
      },
    ],
  });
  assertNotRefused(msg, "facts");
  const facts: Fact[] = [];
  for (const block of msg.content) {
    if (block.type !== "text" || !block.citations?.length) continue;
    const cite = block.citations.find((c) => c.type === "page_location");
    if (!cite || cite.type !== "page_location") continue;
    const text = block.text.replace(/^[\s\-・]+/, "").trim();
    if (!text) continue;
    facts.push({ id: `f${facts.length + 1}`, text, ref: `${cite.document_title ?? "資料"} p.${cite.start_page_number}`, quote: cite.cited_text.trim() });
  }
  if (facts.length === 0) throw new Error("facts: no cited facts returned");
  return facts;
};

/** The most recent facts extracted for this city, from any audience's run. */
const latestFacts = (cityId: string): { story: Story; facts: Fact[] } | undefined => {
  const file = fs
    .readdirSync("episodes")
    .filter((f) => f.startsWith(`${cityId}-`) && f.endsWith(".facts.json"))
    .sort()
    .at(-1);
  return file ? JSON.parse(fs.readFileSync(path.join("episodes", file), "utf-8")) : undefined;
};

/* ---------- 3. Writer ---------- */

const factList = (facts: Fact[]) => facts.map((f) => `${f.id}: ${f.text}（出典：${f.ref}）`).join("\n");

// A finished line inside the streamed JSON; the schema puts speaker right before text.
const STREAMED_LINE = /"speaker"\s*:\s*"(anchor|kid)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

const write = async (
  client: Anthropic,
  request: string,
  round: number,
  emit: Emit,
  revision?: { previous: Episode; issues: Issue[] },
): Promise<Episode> => {
  const content = revision
    ? `${request}\n\n前回の原稿：\n${JSON.stringify(revision.previous)}\n\n次の問題を直した原稿を出してください：\n${revision.issues.map((i) => `- ${i.text}`).join("\n")}`
    : request;
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "high", format: betaZodOutputFormat(Episode) },
    system: WRITER_SYSTEM,
    messages: [{ role: "user", content }],
  });
  let shown = 0;
  stream.on("text", (_delta, snapshot) => {
    const found = [...snapshot.matchAll(STREAMED_LINE)];
    for (const m of found.slice(shown)) {
      try {
        emit({ type: "line", round, speaker: m[1] as "anchor" | "kid", text: JSON.parse(`"${m[2]}"`) });
      } catch {
        // Unusual escape in a partial string; the full script still arrives below.
      }
    }
    shown = found.length;
  });
  const msg = await stream.finalMessage();
  assertNotRefused(msg, "writer");
  if (!msg.parsed_output) throw new Error("writer: output did not match the episode schema");
  return msg.parsed_output;
};

/* ---------- 4. Checks ---------- */

// NFKC turns full-width digits (common in municipal PDFs) into ASCII, so "１２月" and "12月" match.
const numbersIn = (s: string) => [...s.normalize("NFKC").replaceAll(",", "").matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

/** Numbers in speech, telops and visuals must come from the cited facts (or a formula shown on screen). */
const checkNumbers = (episode: Episode, facts: Fact[]): Issue[] => {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const allowedGlobal = new Set(facts.flatMap((f) => numbersIn(f.text)));
  const issues: string[] = [];
  for (const scene of episode.scenes) {
    for (const line of scene.lines) {
      const cited = (line.factIds ?? []).map((id) => byId.get(id)).filter((f): f is Fact => !!f);
      if (line.speaker === "anchor" && cited.length === 0) issues.push(`${line.id}：アナウンサーのセリフに出典の事実（factIds）がない`);
      const allowed = new Set([...allowedGlobal, ...numbersIn(JSON.stringify(line.visual ?? {}).match(/"note":"([^"]*)"/)?.[1] ?? "")]);
      const shown = [line.text, line.telop ?? "", JSON.stringify(line.visual ?? {})].join(" ");
      for (const n of numbersIn(shown)) {
        if (n < 10 || allowed.has(n)) continue;
        issues.push(`${line.id}：「${n}」はどの事実にも出てこない数字。消すか、計算式をカウンターの note に書く`);
      }
      const spoken = line.text.normalize("NFKC").length;
      if (spoken > 45) issues.push(`${line.id}：セリフが${spoken}文字で長すぎる。40文字以内のセリフ2つに分ける`);
      for (const row of (line.telop ?? line.text).split("\n")) {
        if (row.length > 14) issues.push(`${line.id}：テロップ「${row}」が13文字を超えている`);
      }
    }
  }
  return [...new Set(issues)].map((text) => ({ by: "numbers", text }));
};

const Review = z.object({ issues: z.array(z.object({ lineId: z.string(), problem: z.string(), fix: z.string() })) });

const review = async (client: Anthropic, episode: Episode, facts: Fact[]): Promise<Issue[]> => {
  const msg = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    ...FALLBACK,
    output_config: { effort: "high", format: betaZodOutputFormat(Review) },
    system: REVIEW_SYSTEM,
    messages: [{ role: "user", content: `事実一覧：\n${factList(facts)}\n\n原稿：\n${JSON.stringify(episode, null, 1)}` }],
  });
  assertNotRefused(msg, "review");
  return (msg.parsed_output?.issues ?? []).map((i) => ({ by: "reviewer", text: `${i.lineId}: ${i.problem} → ${i.fix}` }));
};

const runChecks = async (client: Anthropic, episode: Episode, facts: Fact[]) => [...checkNumbers(episode, facts), ...(await review(client, episode, facts))];

/* ---------- 5. Finish ---------- */

const halfWidthDigits = <T>(value: T): T => JSON.parse(JSON.stringify(value).replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));

/** The cited fact that shares the most numbers with what the line shows; ties keep the writer's order. */
const bestRef = (line: Line, byId: Map<string, Fact>) => {
  const shown = new Set(numbersIn([line.text, line.telop ?? "", JSON.stringify(line.visual ?? {})].join(" ")));
  const score = (f: Fact) => numbersIn(f.text).filter((n) => n >= 10 && shown.has(n)).length;
  const cited = (line.factIds ?? []).map((id) => byId.get(id)).filter((f): f is Fact => !!f);
  return [...cited].sort((a, b) => score(b) - score(a))[0]?.ref;
};

/** Stable ids for TTS file names, half-width digits, and the best page citation under every line. */
const finalize = (draft: Episode, facts: Fact[], city: CityConfig, date: string): Episode => {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const episode = halfWidthDigits(draft);
  return {
    ...episode,
    city: city.city,
    date,
    sourceNote: `${city.license}に基づき加工`,
    scenes: episode.scenes.map((scene, si) => ({
      ...scene,
      id: `s${si + 1}`,
      lines: scene.lines.map((line, li) => ({
        ...line,
        id: `s${si + 1}l${li + 1}`,
        sourceRef: bestRef(line, byId),
      })),
    })),
  };
};

const lineCount = (episode: Episode) => episode.scenes.flatMap((s) => s.lines).length;

/**
 * Runs the whole newsroom and writes episodes/<episodeId>.json and .facts.json, plus .log.json: every progress
 * event with its time, which the public playback build replays.
 */
export const runNewsroom = async (opts: NewsroomOptions, report: Emit): Promise<string> => {
  const started = Date.now();
  const log: { at: number; event: JobEvent }[] = [];
  const emit: Emit = (event) => {
    log.push({ at: (Date.now() - started) / 1000, event });
    report(event);
  };
  const city = loadCity(opts.cityId);
  const client = new Anthropic();

  emit({ type: "step", step: "fetch", state: "start" });
  await fetchSources(city, (doc, bytes, cached) => emit({ type: "doc", title: doc.title, kb: Math.round(bytes / 1024), cached }));
  emit({ type: "step", step: "fetch", state: "done" });

  let story: Story;
  let facts: Fact[];
  const reused = opts.reuseFacts ? latestFacts(city.id) : undefined;
  if (reused) {
    ({ story, facts } = reused);
    emit({ type: "stories", stories: [story], chosen: 0, reused: true });
    emit({ type: "step", step: "desk", state: "skipped", detail: "前回の取材を再利用" });
    emit({ type: "facts", facts, reused: true });
    emit({ type: "step", step: "facts", state: "skipped", detail: "前回の取材を再利用" });
  } else {
    emit({ type: "step", step: "desk", state: "start" });
    const stories = await pickStory(client, city, opts.hint);
    story = stories[0];
    emit({ type: "stories", stories, chosen: 0, reused: false });
    emit({ type: "step", step: "desk", state: "done" });

    emit({ type: "step", step: "facts", state: "start" });
    facts = await extractFacts(client, city, story);
    emit({ type: "facts", facts, reused: false });
    emit({ type: "step", step: "facts", state: "done" });
  }

  const request = [
    `町：${city.city}（${city.prefecture}）`,
    `日付：${opts.date}`,
    `主な出典：${city.docs[0].title}`,
    `対象視聴者：${opts.audience}`,
    `ニュース項目：${story.headline}（状態：${story.status}）`,
    "",
    "事実一覧：",
    factList(facts),
  ].join("\n");

  emit({ type: "step", step: "writer", state: "start" });
  let episode = await write(client, request, 1, emit);
  emit({ type: "script", round: 1, scenes: episode.scenes.length, lines: lineCount(episode) });
  emit({ type: "step", step: "writer", state: "done" });

  emit({ type: "step", step: "check", state: "start" });
  let issues = await runChecks(client, episode, facts);
  emit({ type: "issues", round: 1, issues });
  emit({ type: "step", step: "check", state: "done" });

  if (issues.length > 0) {
    emit({ type: "step", step: "revise", state: "start" });
    for (let round = 2; issues.length > 0 && round <= 1 + MAX_REVISIONS; round++) {
      episode = await write(client, request, round, emit, { previous: episode, issues });
      emit({ type: "script", round, scenes: episode.scenes.length, lines: lineCount(episode) });
      issues = await runChecks(client, episode, facts);
      emit({ type: "issues", round, issues });
    }
    emit({ type: "step", step: "revise", state: "done" });
  } else {
    emit({ type: "step", step: "revise", state: "skipped", detail: "修正不要" });
  }

  const episodeId = episodeIdFor(city.id, opts.date, opts.audience);
  const final = Episode.parse(finalize(episode, facts, city, opts.date));
  fs.writeFileSync(path.join("episodes", `${episodeId}.json`), JSON.stringify(final, null, 2));
  fs.writeFileSync(path.join("episodes", `${episodeId}.facts.json`), JSON.stringify({ story, facts, remainingIssues: issues }, null, 2));
  fs.writeFileSync(path.join("episodes", `${episodeId}.log.json`), JSON.stringify({ episodeId, events: log }));
  return episodeId;
};
