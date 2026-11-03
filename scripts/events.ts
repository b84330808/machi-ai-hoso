/** Progress events streamed from a job to the web UI. Types only, so the browser can import them. */
import type { Episode } from "../src/schema";

export type Audience = NonNullable<Episode["audience"]>;

export type Story = {
  headline: string;
  who: string;
  change: string;
  status: "decided" | "proposal" | "info";
  residentAction?: string;
  impact: number;
};

export type Fact = { id: string; text: string; ref: string; quote: string };

export type Issue = { by: "numbers" | "reviewer"; text: string };

export type StepId = "fetch" | "desk" | "facts" | "writer" | "check" | "revise" | "voice" | "render";

export type JobEvent =
  | { type: "step"; step: StepId; state: "start" | "done" | "skipped"; detail?: string }
  | { type: "doc"; title: string; kb: number; cached: boolean }
  | { type: "stories"; stories: Story[]; chosen: number; reused: boolean }
  | { type: "facts"; facts: Fact[]; reused: boolean }
  | { type: "line"; round: number; speaker: "anchor" | "kid"; text: string }
  | { type: "script"; round: number; scenes: number; lines: number }
  | { type: "issues"; round: number; issues: Issue[] }
  | { type: "voiced"; lineId: string; done: number; total: number }
  | { type: "rendered"; done: number; total: number }
  | { type: "done"; episodeId: string }
  | { type: "error"; message: string };
