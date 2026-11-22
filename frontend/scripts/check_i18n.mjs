// Verifies that every t("key") used in the UI exists in all four dictionaries.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = fileURLToPath(new URL("../src/", import.meta.url));
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(root).filter((f) => /\.(jsx?|mjs)$/.test(f) && !f.includes("/i18n/"));
const used = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bt\(\s*["'`]([\w.]+)["'`]/g)) used.add(m[1]);
  for (const m of src.matchAll(/\bL\(\s*["'`]([\w.]+)["'`]/g)) used.add("login." + m[1]);
}
const load = async (n) => (await import(pathToFileURL(path.join(root, "i18n", n + ".js")).href)).default;
const get = (d, k) => k.split(".").reduce((o, p) => (o && typeof o === "object" ? o[p] : undefined), d);
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, p + k + ".") : [p + k]));
const dicts = { en: await load("en") };
for (const l of ["fr", "ar", "ja"]) { try { dicts[l] = await load(l); } catch { dicts[l] = null; } }
let bad = 0;
for (const k of [...used].sort()) if (get(dicts.en, k) === undefined && !k.endsWith(".")) { console.log("MISSING in en:", k); bad++; }
const enKeys = flat(dicts.en);
for (const l of ["fr", "ar", "ja"]) {
  if (!dicts[l]) { console.log(`(no ${l}.js yet)`); continue; }
  const miss = enKeys.filter((k) => get(dicts[l], k) === undefined);
  console.log(`${l}: ${enKeys.length - miss.length}/${enKeys.length} keys`, miss.length ? "missing: " + miss.slice(0, 40).join(", ") : "");
}
console.log(bad ? `${bad} keys used in code but missing in en.js` : "all used keys exist in en.js");
