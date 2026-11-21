import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FlaskConical, Info, Loader2, XCircle } from "lucide-react";
import { useI18n } from "../i18n";

export const Spinner = () => <div className="center"><div className="spinner" role="status" aria-label="loading" /></div>;

export function Card({ title, sub, right, children, className = "", tint }) {
  return (
    <section className={`card ${tint ? "tint" : ""} ${className}`}>
      {(title || right) && (
        <div className="row between" style={{ alignItems: "flex-start", marginBottom: sub ? 0 : 10 }}>
          <div>{title && <h3>{title}</h3>}{sub && <div className="sub">{sub}</div>}</div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, note, tone }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value" style={tone ? { color: `var(--${tone}-ink)` } : undefined}>{value}{unit && <small>{unit}</small>}</div>
      {note && <div className="note">{note}</div>}
    </div>
  );
}

const TONE_ICON = { ok: CheckCircle2, warn: AlertTriangle, risk: XCircle, info: Info, neutral: Info };

// Status is always icon + word + colour
export function Pill({ tone = "neutral", children, icon = true }) {
  const Icon = TONE_ICON[tone] || Info;
  return <span className={`pill ${tone}`}>{icon && <Icon size={14} aria-hidden />}{children}</span>;
}

export function Notice({ tone = "info", children, icon, ...props }) {
  const Icon = icon || TONE_ICON[tone] || Info;
  return <div {...props} className={`notice ${tone} ${props.className || ""}`} role={tone === "risk" ? "alert" : undefined}><Icon size={18} aria-hidden /><div>{children}</div></div>;
}

export function AssumptionBadge() {
  const { t } = useI18n();
  return <span className="badge-assumption" title={t("assumption_hint")}><AlertTriangle size={11} aria-hidden />{t("assumption")}</span>;
}
export function ModelBadge() {
  const { t } = useI18n();
  return <span className="badge-model" title={t("model_hint")}><FlaskConical size={11} aria-hidden />{t("model_estimate")}</span>;
}

export function Field({ label, hint, children }) {
  return <div className="field"><label>{label}</label>{children}{hint && <span className="hint">{hint}</span>}</div>;
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tb) => {
        const Icon = tb.icon;
        return (
          <button key={tb.id} role="tab" aria-selected={value === tb.id} className={`tab ${value === tb.id ? "active" : ""}`} onClick={() => onChange(tb.id)}>
            {Icon && <Icon size={16} aria-hidden />}{tb.label}
          </button>
        );
      })}
    </div>
  );
}

export function Button({ busy, children, ...p }) {
  return <button {...p} disabled={p.disabled || busy} className={`btn ${p.className || ""}`}>{busy && <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />}{children}</button>;
}

export function Empty({ icon: Icon, title, children }) {
  return <div className="empty">{Icon && <Icon size={34} style={{ opacity: .5 }} aria-hidden />}<h3 style={{ marginTop: 10, color: "var(--ink)" }}>{title}</h3><div style={{ marginTop: 6 }}>{children}</div></div>;
}

export function Toast({ message, onDone }) {
  useEffect(() => { if (!message) return undefined; const id = setTimeout(onDone, 2600); return () => clearTimeout(id); }, [message, onDone]);
  return message ? <div className="toast" role="status">{message}</div> : null;
}

export function useToast() {
  const [msg, setMsg] = useState("");
  return [msg, setMsg, <Toast key="toast" message={msg} onDone={() => setMsg("")} />];
}

// Key/value list
export function KV({ rows }) {
  return <dl className="kv">{rows.filter(Boolean).map(([k, v], i) => <React.Fragment key={i}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>;
}

export function ErrorNote({ error }) {
  const { t } = useI18n();
  if (!error) return null;
  const msg = error.code === "network" ? t("error_network") : t("error_generic");
  return <Notice tone="risk">{msg}</Notice>;
}

// Horizontal range visual: a band [low, high] and a marker, explained by a swatch legend (no floating labels)
export function RangeViz({ low, high, mark, max, bandLabel, markLabel }) {
  const m = Math.max(max || 0, high || 0, mark || 0) * 1.1 || 1;
  const x = (v) => `${Math.min(100, Math.max(0, (v / m) * 100))}%`;
  return (
    <div>
      <div className="range-viz" aria-hidden>
        <div className="track" />
        <div className="band" style={{ insetInlineStart: x(low), width: `calc(${x(high)} - ${x(low)})` }} />
        {mark != null && <div className="mark" style={{ insetInlineStart: x(mark) }} />}
      </div>
      <div className="legend">
        <span><i className="sq" style={{ background: "var(--c1)" }} />{bandLabel}</span>
        {mark != null && <span><i className="sq" style={{ background: "var(--c2)", width: 4 }} />{markLabel}</span>}
      </div>
    </div>
  );
}
