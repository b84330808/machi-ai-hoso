/** The episodes on disk, shared by the app server and the static playback build. */
import fs from "node:fs";
import path from "node:path";
import { isVoiced, mp4File } from "./media";

const EPISODE_ID = /^(.+)-(\d{4}-\d{2}-\d{2})-(general|parents|seniors|easy)$/;

/** episodes/<id>.json only: .facts.json and .log.json sit beside it. */
const isEpisodeFile = (f: string) => /^[\w-]+\.json$/.test(f);

export const logFile = (id: string) => path.join("episodes", `${id}.log.json`);

export const listEpisodes = () =>
  fs
    .readdirSync("episodes")
    .filter(isEpisodeFile)
    .map((f) => {
      const id = path.basename(f, ".json");
      const m = id.match(EPISODE_ID);
      const { title } = JSON.parse(fs.readFileSync(path.join("episodes", f), "utf-8"));
      return {
        id,
        cityId: m?.[1] ?? null,
        date: m?.[2] ?? null,
        audience: m?.[3] ?? null,
        title,
        voiced: isVoiced(id),
        mp4: fs.existsSync(mp4File(id)),
        hasLog: fs.existsSync(logFile(id)),
      };
    });

export const readEpisode = (id: string) => {
  const factsFile = path.join("episodes", `${id}.facts.json`);
  return {
    episode: JSON.parse(fs.readFileSync(path.join("episodes", `${id}.json`), "utf-8")),
    ...(fs.existsSync(factsFile) ? JSON.parse(fs.readFileSync(factsFile, "utf-8")) : { story: null, facts: [] }),
  };
};
