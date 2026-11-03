import { z } from "zod";

/**
 * Episode format shared by the Claude script writer (structured output) and the Remotion renderer.
 * Timing is never stored here: scene lengths come from the narration audio.
 */

export const Speaker = z.enum(["anchor", "kid"]).describe("anchor = マチコ (AI announcer), kid = ソウタ (a primary-school boy)");

/** A word of the line; the visual animates when the narration reaches it. */
const At = z.string().describe("A word from the spoken text; the animation starts when it is spoken").optional();

export const StampVisual = z.object({
  type: z.literal("stamp"),
  tag: z.string().describe("Short ribbon such as 来年度から"),
  label: z.string().describe("What changes, e.g. 給食費"),
  big: z.string().describe("The headline number, e.g. 月+500円. 8 characters max"),
  at: At,
});

export const CounterVisual = z.object({
  type: z.literal("counter"),
  label: z.string().describe("e.g. 1年で"),
  from: z.number(),
  to: z.number(),
  prefix: z.string().describe("e.g. 約").optional(),
  unit: z.string().describe("e.g. 円, 人, 日"),
  note: z.string().describe("How the number was derived, e.g. 月500円 × 11か月").optional(),
  icon: z.enum(["meal", "yen", "calendar", "house", "bus", "trash", "school"]).optional(),
});

export const PeopleVisual = z.object({
  type: z.literal("people"),
  count: z.number().int().describe("1 to 4 figures"),
  each: z.string().describe("Tag under each figure, e.g. +5,500円/年"),
  totalPrefix: z.string().describe("e.g. 年").optional(),
  total: z.number().optional(),
  totalUnit: z.string().optional(),
  at: At,
});

export const CardVisual = z.object({
  type: z.literal("card"),
  icon: z.enum(["check", "calendar", "warning", "yen", "info"]),
  title: z.string().describe("12 characters max"),
  note: z.string().optional(),
});

export const PointsVisual = z.object({
  type: z.literal("points"),
  title: z.string().describe("e.g. ポイントは3つ"),
  items: z.array(z.object({ text: z.string().describe("10 characters max"), at: At })).describe("1 to 3 items"),
});

export const QuestionVisual = z.object({
  type: z.literal("question"),
  mark: z.enum(["？", "！"]),
  at: At,
});

export const Visual = z.discriminatedUnion("type", [StampVisual, CounterVisual, PeopleVisual, CardVisual, PointsVisual, QuestionVisual]);

export const Line = z.object({
  id: z.string(),
  speaker: Speaker,
  text: z.string().describe("Spoken sentence, natural Japanese"),
  yomi: z.string().describe("Same sentence for the TTS: kanji kept, only names, units and ambiguous readings replaced with kana").optional(),
  telop: z.string().describe("On-screen version of text with \\n line breaks, 13 characters per line max").optional(),
  emphasis: z.array(z.string()).describe("Substrings of telop to highlight").optional(),
  visual: Visual.optional(),
  factIds: z.array(z.string()).describe("IDs of the cited facts this line relies on").optional(),
  sourceRef: z.string().describe("Filled in by the pipeline, not the writer").optional(),
});

export const Scene = z.object({
  id: z.string(),
  layout: z
    .enum(["skit", "anchor", "desk"])
    .describe("skit = kid at the family dinner table; anchor = announcer large at the desk; desk = announcer small with visuals"),
  prop: z.object({ type: z.literal("letter"), title: z.string() }).describe("Only for skit").optional(),
  lines: z.array(Line).describe("1 to 3 lines"),
});

export const Episode = z.object({
  title: z.string(),
  city: z.string(),
  date: z.string().describe("YYYY-MM-DD"),
  source: z.string().describe("Main source document, e.g. ○○町議会 令和8年第3回定例会 議決結果"),
  sourceNote: z.string().optional(),
  audience: z.enum(["general", "parents", "seniors", "easy"]).optional(),
  scenes: z.array(Scene).describe("4 to 6 scenes"),
});

export type Episode = z.infer<typeof Episode>;
export type Scene = z.infer<typeof Scene>;
export type Line = z.infer<typeof Line>;
export type Visual = z.infer<typeof Visual>;
