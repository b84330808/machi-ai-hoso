/**
 * Newsroom pipeline: municipal PDFs → cited facts → episode JSON.
 *
 *   desk     picks the item that matters most to residents (structured output)
 *   facts    extracts facts with page-level citations (Citations API)
 *   writer   writes the episode in the renderer's schema (structured output)
 *   checks   numbers must come from cited facts; a fact checker reviews the script
 *   revise   one rewrite round if any check fails
 *
 * Usage: npm run generate -- kumakogen [--audience general|parents|seniors|easy] [--hint 水道]
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { Episode } from "../src/schema";
import { docPath, loadCity } from "./city";
import { DESK_SYSTEM, FACTS_SYSTEM, REVIEW_SYSTEM, WRITER_SYSTEM } from "./prompts";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env: rely on the environment.
}

const MODEL = "claude-opus-5-5";
// Re-runs a declined request on a fallback model inside the same call.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    audience: { type: "string", default: "general" },
    hint: { type: "string" },
    date: { type: "string", default: new Date().toISOString().slice(0, 10) },
  },
});
const audience = Episode.shape.audience.unwrap().parse(values.audience);
const city = loadCity(positionals[0] ?? "kumakogen");
const client = new Anthropic();

type Fact = { id: string; text: string; ref: string; quote: string };

const log = (step: string, msg: string) => console.log(`[${step}] ${msg}`);

const assertNotRefused = (msg: Anthropic.Beta.BetaMessage, step: string) => {
  if (msg.stop_reason === "refusal") throw new Error(`${step}: refused (${msg.stop_details?.category ?? "unknown"})`);
  if (msg.stop_reason === "max_tokens") throw new Error(`${step}: hit max_tokens`);
};

const documents = (citations: boolean): Anthropic.Beta.BetaRequestDocumentBlock[] =>
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

const pickStory = async () => {
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
          ...documents(false),
          { type: "text", text: `${city.prefecture}${city.city}の公開資料です。住民向けニュースの候補を挙げてください。${values.hint ? `特に「${values.hint}」に関する項目を優先してください。` : ""}` },
        ],
      },
    ],
  });
  assertNotRefused(msg, "desk");
  const stories = msg.parsed_output?.stories ?? [];
  if (stories.length === 0) throw new Error("desk: no stories found");
  const story = [...stories].sort((a, b) => b.impact - a.impact)[0];
  log("desk", `${stories.length} candidates → 「${story.headline}」 (${story.status}, impact ${story.impact})`);
  return story;
};

/* ---------- 2. Facts with citations ---------- */

const extractFacts = async (story: z.infer<typeof Stories>["stories"][number]): Promise<Fact[]> => {
  const msg = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    ...FALLBACK,
    output_config: { effort: "medium" },
    system: FACTS_SYSTEM,
    messages: [
      {
        role: "user",
        content: [...documents(true), { type: "text", text: `ニュース項目：${story.headline}\n対象：${story.who}\n変化：${story.change}\n\nこの項目について、住民が知るべき事実を挙げてください。` }],
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
  log("facts", `${facts.length} cited facts`);
  return facts;
};

/* ---------- 3. Writer ---------- */

const factList = (facts: Fact[]) => facts.map((f) => `${f.id}: ${f.text}（出典：${f.ref}）`).join("\n");

const writerRequest = (facts: Fact[], story: z.infer<typeof Stories>["stories"][number]) =>
  [
    `町：${city.city}（${city.prefecture}）`,
    `日付：${values.date}`,
    `主な出典：${city.docs[0].title}`,
    `対象視聴者：${audience}`,
    `ニュース項目：${story.headline}（状態：${story.status}）`,
    "",
    "事実一覧：",
    factList(facts),
  ].join("\n");

const write = async (request: string, revision?: { previous: Episode; issues: string[] }): Promise<Episode> => {
  const content = revision
    ? `${request}\n\n前回の原稿：\n${JSON.stringify(revision.previous)}\n\n次の問題を直した原稿を出してください：\n${revision.issues.map((i) => `- ${i}`).join("\n")}`
    : request;
  const msg = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "high", format: betaZodOutputFormat(Episode) },
    system: WRITER_SYSTEM,
    messages: [{ role: "user", content }],
  });
  assertNotRefused(msg, "writer");
  if (!msg.parsed_output) throw new Error("writer: output did not match the episode schema");
  return msg.parsed_output;
};

/* ---------- 4. Checks ---------- */

const numbersIn = (s: string) => [...s.replaceAll(",", "").matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

/** Numbers in speech, telops and visuals must come from the cited facts (or a formula shown on screen). */
const checkNumbers = (episode: Episode, facts: Fact[]): string[] => {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const allowedGlobal = new Set(facts.flatMap((f) => numbersIn(f.text)));
  const issues: string[] = [];
  for (const scene of episode.scenes) {
    for (const line of scene.lines) {
      const cited = (line.factIds ?? []).map((id) => byId.get(id)).filter((f): f is Fact => !!f);
      if (line.speaker === "anchor" && cited.length === 0) issues.push(`${line.id}: anchor line has no valid factIds`);
      const allowed = new Set([...allowedGlobal, ...numbersIn(JSON.stringify(line.visual ?? {}).match(/"note":"([^"]*)"/)?.[1] ?? "")]);
      const shown = [line.text, line.telop ?? "", JSON.stringify(line.visual ?? {})].join(" ");
      for (const n of numbersIn(shown)) {
        if (n < 10 || allowed.has(n)) continue;
        issues.push(`${line.id}: the number ${n} does not appear in any cited fact; remove it or show the formula in a counter note`);
      }
      for (const row of (line.telop ?? line.text).split("\n")) {
        if (row.length > 14) issues.push(`${line.id}: telop row "${row}" is longer than 13 characters`);
      }
    }
  }
  return issues;
};

const Review = z.object({ issues: z.array(z.object({ lineId: z.string(), problem: z.string(), fix: z.string() })) });

const review = async (episode: Episode, facts: Fact[]): Promise<string[]> => {
  const msg = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    ...FALLBACK,
    output_config: { effort: "high", format: betaZodOutputFormat(Review) },
    system: REVIEW_SYSTEM,
    messages: [{ role: "user", content: `事実一覧：\n${factList(facts)}\n\n原稿：\n${JSON.stringify(episode, null, 1)}` }],
  });
  assertNotRefused(msg, "review");
  return (msg.parsed_output?.issues ?? []).map((i) => `${i.lineId}: ${i.problem} → ${i.fix}`);
};

/* ---------- 5. Finish ---------- */

/** Stable ids for TTS file names, and a page citation under every line. */
const finalize = (episode: Episode, facts: Fact[]): Episode => {
  const byId = new Map(facts.map((f) => [f.id, f]));
  return {
    ...episode,
    city: city.city,
    date: values.date!,
    sourceNote: `${city.license}に基づき加工`,
    scenes: episode.scenes.map((scene, si) => ({
      ...scene,
      id: `s${si + 1}`,
      lines: scene.lines.map((line, li) => ({
        ...line,
        id: `s${si + 1}l${li + 1}`,
        sourceRef: line.factIds?.map((id) => byId.get(id)?.ref).find(Boolean),
      })),
    })),
  };
};

const story = await pickStory();
const facts = await extractFacts(story);
const request = writerRequest(facts, story);
let episode = await write(request);
log("writer", `${episode.scenes.length} scenes, ${episode.scenes.flatMap((s) => s.lines).length} lines`);

let issues = [...checkNumbers(episode, facts), ...(await review(episode, facts))];
if (issues.length > 0) {
  issues.forEach((i) => log("check", i));
  episode = await write(request, { previous: episode, issues });
  issues = [...checkNumbers(episode, facts), ...(await review(episode, facts))];
  log("revise", issues.length === 0 ? "all checks pass" : `${issues.length} issues remain`);
  issues.forEach((i) => log("check", i));
} else {
  log("check", "all checks pass");
}

const final = Episode.parse(finalize(episode, facts));
const outBase = path.join("episodes", `${city.id}-${values.date}-${audience}`);
fs.writeFileSync(`${outBase}.json`, JSON.stringify(final, null, 2));
fs.writeFileSync(`${outBase}.facts.json`, JSON.stringify({ story, facts, remainingIssues: issues }, null, 2));
log("done", `${outBase}.json`);
