import { staticFile } from "remotion";
import { Episode } from "./schema";
import { buildTimeline, Manifest, Timeline } from "./timeline";

const fetchJson = async (path: string) => {
  const res = await fetch(staticFile(path));
  if (!res.ok) throw new Error(`${path} missing. Run \`npm run tts -- episodes/<name>.json\` first.`);
  return res.json();
};

/** Episode script plus TTS manifest from public/episodes/<id>/, used by both the renderer and the web player. */
export const loadTimeline = async (episodeId: string): Promise<Timeline> => {
  const episode = Episode.parse(await fetchJson(`episodes/${episodeId}/episode.json`));
  const manifest = (await fetchJson(`episodes/${episodeId}/manifest.json`)) as Manifest;
  return buildTimeline(episode, manifest);
};
