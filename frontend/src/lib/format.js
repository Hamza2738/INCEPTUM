// Region-aware formatting. The backend always stores SI-style units (ha, kg N/ha, dS/m).
// Display units per region come from regions.json: Tunisia = ha, kg N/ha, TND; Japan = 10 a (tan), kg N/10 a, JPY.

const LOCALES = { en: "en-GB", fr: "fr-TN", ar: "ar-TN-u-nu-latn", ja: "ja-JP" };

export const localeOf = (lang) => LOCALES[lang] || "en-GB";

export function num(v, lang = "en", digits = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  return new Intl.NumberFormat(localeOf(lang), { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(v);
}

export function money(v, currency, lang = "en") {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const digits = currency === "JPY" ? 0 : Math.abs(v) < 100 ? 1 : 0;
  try {
    return new Intl.NumberFormat(localeOf(lang), { style: "currency", currency, maximumFractionDigits: digits, currencyDisplay: currency === "JPY" ? "narrowSymbol" : "code" }).format(v).replace(/ /g, " ");
  } catch (e) {
    return `${num(v, lang, digits)} ${currency}`;
  }
}

export function compactMoney(v, currency, lang = "en") {
  if (v === null || v === undefined) return "–";
  const n = new Intl.NumberFormat(localeOf(lang), { notation: "compact", maximumFractionDigits: 1 }).format(v);
  return `${n} ${currency}`;
}

// area: backend ha -> display unit
export const areaOut = (ha, region) => (ha == null ? null : ha * region.area_factor);
export const areaIn = (v, region) => v / region.area_factor;
// nitrogen: backend kg/ha -> display (kg/ha or kg/10a)
export const nOut = (kgHa, region) => (kgHa == null ? null : kgHa * region.n_factor);
export const nIn = (v, region) => v / region.n_factor;

export const fmtArea = (ha, region, lang) => `${num(areaOut(ha, region), lang, region.area_factor > 1 ? 1 : 1)} ${region.area_unit}`;
export const fmtN = (kgHa, region, lang) => `${num(nOut(kgHa, region), lang, region.n_factor < 1 ? 1 : 0)} ${region.n_unit}`;

export function dateShort(iso, lang) {
  if (!iso) return "–";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return new Intl.DateTimeFormat(localeOf(lang), { day: "numeric", month: "short" }).format(d);
}
export function dateLong(iso, lang) {
  if (!iso) return "–";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return new Intl.DateTimeFormat(localeOf(lang), { day: "numeric", month: "long", year: "numeric" }).format(d);
}

export const pct = (v, lang, digits = 0) => (v == null ? "–" : `${num(v, lang, digits)}%`);

// Pick a localized name from {en, fr, ar, ja}
export const pick = (obj, lang) => (obj ? obj[lang] || obj.en || Object.values(obj)[0] : "");

export const VERDICT_TONE = { OK: "ok", RISKY: "warn", NOT_SUITABLE: "risk" };
