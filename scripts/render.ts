/**
 * Render a voiced episode to out/<episodeId>.mp4.
 * Usage: npm run render -- sample-kyushokuhi
 */
import { isVoiced, mp4File, render } from "./media";

const episodeId = process.argv[2] ?? "sample-kyushokuhi";
if (!isVoiced(episodeId)) throw new Error(`No narration for ${episodeId}. Run \`npm run tts -- episodes/${episodeId}.json\` first.`);

let last = -1;
await render(episodeId, (done, total) => {
  const pct = Math.floor((done / total) * 10) * 10;
  if (pct !== last) console.log(`${pct}%`);
  last = pct;
});
console.log(mp4File(episodeId));
