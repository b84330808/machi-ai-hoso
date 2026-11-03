import fs from "node:fs";
import path from "node:path";

export type CityDoc = { id: string; title: string; url: string; page?: string };
/** `order` sets the position in the app's town list. */
export type CityConfig = { id: string; order?: number; city: string; prefecture: string; license: string; licenseUrl: string; docs: CityDoc[] };

export const loadCity = (id: string): CityConfig => JSON.parse(fs.readFileSync(path.join("cities", `${id}.json`), "utf-8"));

export const listCities = (): CityConfig[] =>
  fs
    .readdirSync("cities")
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadCity(path.basename(f, ".json")))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

/** Local copy of a source document (downloaded by fetch-sources, never committed). */
export const docPath = (city: CityConfig, doc: CityDoc) => path.join("sources", city.id, `${doc.id}.pdf`);

/** Download any of the city's documents that are not on disk yet. */
export const fetchSources = async (city: CityConfig, onDoc: (doc: CityDoc, bytes: number, cached: boolean) => void) => {
  fs.mkdirSync(path.join("sources", city.id), { recursive: true });
  for (const doc of city.docs) {
    const file = docPath(city, doc);
    if (fs.existsSync(file)) {
      onDoc(doc, fs.statSync(file).size, true);
      continue;
    }
    const res = await fetch(doc.url);
    if (!res.ok) throw new Error(`${doc.url}: HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.subarray(0, 4).toString() !== "%PDF") throw new Error(`${doc.url} is not a PDF`);
    fs.writeFileSync(file, bytes);
    onDoc(doc, bytes.length, false);
  }
};
