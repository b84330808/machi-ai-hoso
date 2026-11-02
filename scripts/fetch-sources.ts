/**
 * Download a city's public source documents into sources/<city>/.
 * Usage: npm run fetch -- kumakogen
 */
import fs from "node:fs";
import path from "node:path";
import { docPath, loadCity } from "./city";

const city = loadCity(process.argv[2] ?? "kumakogen");
fs.mkdirSync(path.join("sources", city.id), { recursive: true });

for (const doc of city.docs) {
  const res = await fetch(doc.url);
  if (!res.ok) throw new Error(`${doc.url}: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.subarray(0, 4).toString() !== "%PDF") throw new Error(`${doc.url} is not a PDF`);
  fs.writeFileSync(docPath(city, doc), bytes);
  console.log(`${doc.id}: ${(bytes.length / 1024).toFixed(0)} KB`);
}
