import fs from "node:fs";
import path from "node:path";

export type CityDoc = { id: string; title: string; url: string; page?: string };
export type CityConfig = { id: string; city: string; prefecture: string; license: string; licenseUrl: string; docs: CityDoc[] };

export const loadCity = (id: string): CityConfig => JSON.parse(fs.readFileSync(path.join("cities", `${id}.json`), "utf-8"));

/** Local copy of a source document (downloaded by fetch-sources, never committed). */
export const docPath = (city: CityConfig, doc: CityDoc) => path.join("sources", city.id, `${doc.id}.pdf`);
