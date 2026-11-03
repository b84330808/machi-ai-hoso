/**
 * Run the newsroom from the command line.
 * Usage: npm run generate -- kumakogen [--audience general|parents|seniors|easy] [--hint 水道] [--reuse-facts]
 */
import { parseArgs } from "node:util";
import { Episode } from "../src/schema";
import type { JobEvent } from "./events";
import { runNewsroom } from "./newsroom";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    audience: { type: "string", default: "general" },
    hint: { type: "string" },
    date: { type: "string", default: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }) },
    "reuse-facts": { type: "boolean", default: false },
  },
});

const print = (e: JobEvent) => {
  switch (e.type) {
    case "step":
      if (e.state !== "done") console.log(`[${e.step}] ${e.state}${e.detail ? `: ${e.detail}` : ""}`);
      break;
    case "doc":
      console.log(`  ${e.title} (${e.kb} KB${e.cached ? ", cached" : ""})`);
      break;
    case "stories":
      e.stories.forEach((s, i) => console.log(`  ${i === e.chosen ? "▶" : " "} [${s.impact}] ${s.headline} (${s.status})`));
      break;
    case "facts":
      e.facts.forEach((f) => console.log(`  ${f.id}: ${f.text} (${f.ref})`));
      break;
    case "line":
      console.log(`  ${e.speaker === "anchor" ? "マチコ" : "ソウタ"}: ${e.text}`);
      break;
    case "issues":
      console.log(e.issues.length === 0 ? "  all checks pass" : e.issues.map((i) => `  ✗ ${i.text}`).join("\n"));
      break;
  }
};

const episodeId = await runNewsroom(
  {
    cityId: positionals[0] ?? "kumakogen",
    audience: Episode.shape.audience.unwrap().parse(values.audience),
    date: values.date!,
    hint: values.hint,
    reuseFacts: values["reuse-facts"],
  },
  print,
);
console.log(`[done] episodes/${episodeId}.json`);
