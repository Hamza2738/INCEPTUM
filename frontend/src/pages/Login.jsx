import React, { useEffect, useState } from "react";
import { Droplets, Factory, Sprout, Sun, Waves, Zap, FlaskConical } from "lucide-react";
import { useAuth } from "../auth";
import { LANG_LABEL, useI18n } from "../i18n";
import Logo from "../components/Logo";
import { Button, Notice } from "../components/ui";

const DEMO = { TN: "demo.tn@salinityshield.app", JP: "demo.jp@salinityshield.app" };
const PANEL_LANGS = { TN: ["fr", "ar", "en"], JP: ["ja", "en"] };

function ArtTN() {
  return (
    <svg className="art" viewBox="0 0 600 800" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <circle cx="430" cy="230" r="86" fill="#F4C96B" opacity=".55" />
      <circle cx="430" cy="230" r="130" fill="#F4C96B" opacity=".14" />
      <path d="M0 610 C120 560 220 600 330 570 S520 540 600 580 V800 H0Z" fill="#0A4A4B" opacity=".5" />
      <path d="M0 680 C150 630 260 690 380 650 S540 640 600 670 V800 H0Z" fill="#073B3C" opacity=".55" />
      <g stroke="#073B3C" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".7">
        <path d="M95 660 C100 600 92 560 98 520" />
        <path d="M98 520 c-30 -6 -48 6 -58 22 M98 520 c26 -16 46 -12 62 4 M98 520 c-6 -26 8 -44 24 -54 M98 520 c-14 -24 -34 -34 -52 -30" />
        <path d="M485 690 C490 640 482 610 488 575" />
        <path d="M488 575 c-26 -5 -42 5 -50 19 M488 575 c22 -14 40 -10 54 3 M488 575 c-5 -22 7 -38 20 -46 M488 575 c-12 -20 -30 -29 -45 -26" />
      </g>
      <g stroke="#fff" strokeWidth="2" opacity=".25" fill="none"><path d="M0 740 q75 -14 150 0 t150 0 t150 0 t150 0" /><path d="M0 765 q75 -14 150 0 t150 0 t150 0 t150 0" /></g>
    </svg>
  );
}

function ArtJP() {
  return (
    <svg className="art" viewBox="0 0 600 800" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <circle cx="150" cy="190" r="52" fill="#fff" opacity=".22" />
      <path d="M-20 640 L230 330 L270 372 L310 335 L620 640Z" fill="#162C4C" opacity=".55" />
      <path d="M230 330 L270 372 L310 335 L330 355 L270 330Z" fill="#fff" opacity=".6" />
      <path d="M-20 700 C140 640 300 700 440 660 S580 650 620 690 V800 H-20Z" fill="#6E8F4E" opacity=".45" />
      <g fill="none" stroke="#DDE9C9" strokeWidth="3" opacity=".35" strokeLinecap="round">
        <path d="M0 720 C150 690 300 740 450 705 S560 700 600 710" />
        <path d="M0 745 C150 715 300 765 450 730 S560 725 600 735" />
        <path d="M0 770 C150 740 300 790 450 755 S560 750 600 760" />
      </g>
    </svg>
  );
}

function Side({ code, onSwitch, panelLang, setPanelLang }) {
  const { tl } = useI18n();
  const L = (k, p) => tl(panelLang, `login.${k}`, p);
  const pre = code === "TN" ? "tn" : "jp";
  const icons = code === "TN" ? [Waves, Zap, Sun] : [Sprout, Droplets, Factory];
  const figs = code === "TN" ? ["fig_tn_1", "fig_tn_2"] : ["fig_jp_1", "fig_jp_2"];
  const figVals = code === "TN" ? ["3.8 – 4.5", "0.3 – 1.3"] : ["10", "−20%"];
  const dir = panelLang === "ar" ? "rtl" : "ltr";

  return (
    <div
      className={`side ${pre} active`}
      dir={dir}
      data-theme={pre}
    >
      {code === "TN" ? <ArtTN /> : <ArtJP />}
      <div className="row between" style={{ position: "relative", zIndex: 3 }}>
        <div className="brandline"><Logo className="logo" mono style={{ width: 30, height: 30 }} /><span>SalinityShield</span></div>
        <div className="mini-lang">
          <div className="lang-switch">
            {PANEL_LANGS[code].map((l) => <button key={l} className={l === panelLang ? "active" : ""} onClick={() => setPanelLang(l)} lang={l}>{LANG_LABEL[l]}</button>)}
          </div>
          <button type="button" className="country-switch" onClick={onSwitch}>
            {L("switch")}: {L(`${pre === "tn" ? "jp" : "tn"}_name`)}
          </button>
        </div>
      </div>

      <div className="inner">
        <div>
          <div className="native">{L(`${pre}_native`)}</div>
          <h1>{L(`${pre}_name`)}</h1>
        </div>
        <p style={{ fontSize: 17, opacity: .95, margin: 0 }}>{L(`${pre}_head`)}</p>

        <div className="problems">
          {[1, 2, 3].map((i) => {
            const Ico = icons[i - 1];
            return <div className="problem" key={i}><Ico size={20} aria-hidden /><div><b>{L(`${pre}_p${i}_t`)}</b>{L(`${pre}_p${i}`)}</div></div>;
          })}
        </div>
        <div className="figures">{figs.map((f, i) => <div key={f}><b className="num">{figVals[i]}</b><span>{L(f)}</span></div>)}</div>
        <AuthCard code={code} panelLang={panelLang} onBack={onSwitch} />
      </div>

      <div className="tiny" style={{ position: "relative", zIndex: 2, opacity: .85 }}>{L("footer")}</div>
    </div>
  );
}

function AuthCard({ code, panelLang, onBack }) {
  const { login, register } = useAuth();
  const { tl, setLang } = useI18n();
  const L = (k, p) => tl(panelLang, `login.${k}`, p);
  const [mode, setMode] = useState("signin");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setLang(panelLang); }, [panelLang, setLang]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e, override) => {
    e && e.preventDefault();
    setErr(""); setBusy(true);
    const v = override || f;
    try {
      if (mode === "signin" || override) await login(v.email, v.password, code);
      else await register({ name: v.name, email: v.email, password: v.password, region: code, lang: panelLang });
    } catch (ex) {
      const key = `err_${ex.code}`;
      setErr(ex.code === "network" ? tl(panelLang, "error_network") : tl(panelLang, `login.${key}`) !== `login.${key}` ? L(key) : tl(panelLang, "error_generic"));
    } finally { setBusy(false); }
  };

  return (
    <div className="login-card" onClick={(e) => e.stopPropagation()}>
      <h2>{mode === "signin" ? L("sign_in") : L("create")}</h2>
      <form className="stack" onSubmit={submit}>
        {mode === "register" && <div className="field"><label>{L("name")}</label><input className="input" value={f.name} onChange={set("name")} required autoComplete="name" /></div>}
        <div className="field"><label>{L("email")}</label><input className="input" type="email" value={f.email} onChange={set("email")} required autoComplete="email" dir="ltr" /></div>
        <div className="field"><label>{L("password")}</label><input className="input" type="password" value={f.password} onChange={set("password")} required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} dir="ltr" /></div>
        {err && <Notice tone="risk">{err}</Notice>}
        <Button type="submit" busy={busy} className="block">{mode === "signin" ? L("sign_in") : L("create")}</Button>
        <Button type="button" className="ghost block" disabled={busy} onClick={() => submit(null, { email: DEMO[code], password: "demo1234" })}><FlaskConical size={16} />{L("demo")}</Button>
        <div className="tiny muted" style={{ textAlign: "center" }}>{L("demo_hint")}</div>
        <div className="small" style={{ textAlign: "center" }}>
          {mode === "signin" ? L("no_account") : L("have_account")}{" "}
          <button type="button" className="link" onClick={() => { setMode(mode === "signin" ? "register" : "signin"); setErr(""); }}>{mode === "signin" ? L("create") : L("sign_in")}</button>
        </div>
        <div className="small" style={{ textAlign: "center" }}><button type="button" className="link" onClick={onBack}>{L("switch")}</button></div>
      </form>
    </div>
  );
}

export default function Login() {
  const { regions } = useAuth();
  const [sel, setSel] = useState("TN");
  const [tnLang, setTnLang] = useState("fr");
  const [jpLang, setJpLang] = useState("ja");
  const { setLang } = useI18n();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", sel === "JP" ? "jp" : "tn");
    if (sel === "TN") setLang(tnLang);
    if (sel === "JP") setLang(jpLang);
  }, [sel, tnLang, jpLang, setLang]);
  useEffect(() => () => document.documentElement.removeAttribute("data-theme"), []);

  return (
    <div className="login" dir="ltr">
      {sel === "TN"
        ? <Side code="TN" onSwitch={() => setSel("JP")} panelLang={tnLang} setPanelLang={setTnLang} />
        : <Side code="JP" onSwitch={() => setSel("TN")} panelLang={jpLang} setPanelLang={setJpLang} />}
      {!regions && <div className="toast" role="alert">…</div>}
    </div>
  );
}
