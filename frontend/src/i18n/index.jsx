import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en from "./en";
import fr from "./fr";
import ar from "./ar";
import ja from "./ja";

const DICTS = { en, fr, ar, ja };
export const LANG_LABEL = { en: "EN", fr: "FR", ar: "العربية", ja: "日本語" };
export const RTL = new Set(["ar"]);

function lookup(dict, key) {
  return key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), dict);
}

function interpolate(s, params) {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined && params[k] !== null ? String(params[k]) : `{${k}}`));
}

export function translate(lang, key, params) {
  let v = lookup(DICTS[lang], key);
  if (v === undefined) v = lookup(DICTS.en, key);
  if (typeof v !== "string") return key;
  return interpolate(v, params);
}

const Ctx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem("ss_lang") || "en");

  const setLang = useCallback((l) => {
    if (!DICTS[l]) return;
    localStorage.setItem("ss_lang", l);
    setLangState(l);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL.has(lang) ? "rtl" : "ltr";
  }, [lang]);

  const value = useMemo(() => ({
    lang, setLang, rtl: RTL.has(lang),
    t: (key, params) => translate(lang, key, params),
    tl: (l, key, params) => translate(l, key, params),
  }), [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
