/**
 * Download a city's public source documents into sources/<city>/.
 * Usage: npm run fetch -- kumakogen
 */
import { fetchSources, loadCity } from "./city";

await fetchSources(loadCity(process.argv[2] ?? "kumakogen"), (doc, bytes, cached) =>
  console.log(`${doc.id}: ${(bytes / 1024).toFixed(0)} KB${cached ? " (already downloaded)" : ""}`),
);
