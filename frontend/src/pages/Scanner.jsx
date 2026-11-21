import React, { useEffect, useRef, useState } from "react";
import { Camera, ScanLine } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { dateLong, num, pick } from "../lib/format";
import { Button, Card, ErrorNote, Field, Notice, Pill } from "../components/ui";

export default function Scanner() {
  const { region } = useAuth();
  const { t, lang } = useI18n();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [crop, setCrop] = useState("");
  const [plotId, setPlotId] = useState("");
  const [plots, setPlots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  const [label, setLabel] = useState("");
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState([]);
  const input = useRef();

  const loadHistory = () => api.get("/ai/scans").then((r) => setHistory(r.scans)).catch(() => {});
  useEffect(() => { api.get("/plots").then((r) => setPlots(r.plots)).catch(() => {}); loadHistory(); }, []);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const choose = (f) => { if (!f) return; setFile(f); setPreview(URL.createObjectURL(f)); setRes(null); setSaved(false); setLabel(""); };

  const analyze = async () => {
    setBusy(true); setError(null); setRes(null); setSaved(false);
    const fd = new FormData();
    fd.append("file", file); fd.append("lang", lang);
    if (crop) fd.append("crop_id", crop);
    if (plotId) fd.append("plot_id", plotId);
    try { setRes(await api.upload("/ai/scan", fd)); loadHistory(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const confirm = async () => { await api.post(`/ai/scan/${res.scan_id}/confirm`, { label }); setSaved(true); loadHistory(); };

  const reasonText = (r) => t(`scan.q_${r}`);
  const r = res?.result;

  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t("scan.title")}</h1><p>{t("scan.sub")}</p></div></div>
      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <Card>
          <div className="drop" onClick={() => input.current.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files[0]); }} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && input.current.click()}>
            {preview ? <img src={preview} alt="" /> : <><Camera size={30} aria-hidden /><div><b>{t("scan.upload")}</b></div><div className="tiny">{t("scan.hint")}</div></>}
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(e) => choose(e.target.files[0])} />
          </div>
          <div className="stack" style={{ marginTop: 14 }}>
            <Field label={t("scan.crop")}><select className="input" value={crop} onChange={(e) => setCrop(e.target.value)}><option value="">–</option>{region.crop_list.map((c) => <option key={c.id} value={c.id}>{pick(c.name, lang)}</option>)}</select></Field>
            <Field label={t("scan.plot")}><select className="input" value={plotId} onChange={(e) => setPlotId(e.target.value)}><option value="">–</option>{plots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Button busy={busy} disabled={!file} onClick={analyze}><ScanLine size={16} />{busy ? t("scan.analyzing") : t("scan.analyze")}</Button>
          </div>
        </Card>

        <div className="stack">
          <ErrorNote error={error} />
          {res && res.ok === false && <Notice tone="warn"><div><b>{t("scan.quality_bad")}</b> {(res.quality?.reasons || []).map(reasonText).join(", ")}</div></Notice>}
          {res?.mode === "unconfigured" && <Notice tone="info">{t("scan.unconfigured")}</Notice>}
          {res?.mode === "error" && <Notice tone="risk">{t("scan.error")}</Notice>}
          {res?.mode === "demo" && <Notice tone="warn">{t("scan.demo")}</Notice>}
          {r && (
            <Card title={t("scan.hyp")}>
              <div className="row wrap" style={{ marginBottom: 12 }}>
                <Pill tone={r.gravite === "elevee" || r.gravite === "high" ? "risk" : r.gravite === "moyenne" || r.gravite === "medium" ? "warn" : "ok"}>{t("scan.severity")}: {t(`scan.sev.${r.gravite}`) !== `scan.sev.${r.gravite}` ? t(`scan.sev.${r.gravite}`) : r.gravite}</Pill>
                {r.consulter_expert && <Pill tone="info">{t("scan.consult")}</Pill>}
              </div>
              <div className="stack tight">
                {(r.hypotheses || []).map((h, i) => (
                  <div key={i} className="advice low" style={{ flexDirection: "column", gap: 6 }}>
                    <div className="row between"><b>{h.nom}</b><span className="pill neutral">{t("scan.conf")} {num(Math.min(0.85, h.confiance) * 100, lang, 0)}%</span></div>
                    <div className="bar" aria-hidden><i style={{ width: `${Math.min(0.85, h.confiance) * 100}%`, background: "var(--c1)" }} /></div>
                    <div className="tiny muted">{t(`scan.types.${h.type}`) !== `scan.types.${h.type}` ? t(`scan.types.${h.type}`) : h.type}</div>
                    {h.signes_observes?.length > 0 && <div className="small"><b>{t("scan.seen")}:</b> {h.signes_observes.join(", ")}</div>}
                    {h.a_verifier?.length > 0 && <div className="small"><b>{t("scan.check")}:</b> {h.a_verifier.join(", ")}</div>}
                  </div>
                ))}
              </div>
              {r.actions_prudentes?.length > 0 && <div style={{ marginTop: 14 }}><h4>{t("scan.prudent")}</h4><ul style={{ margin: "6px 0 0", paddingInlineStart: 20 }}>{r.actions_prudentes.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
              <Notice tone="warn">{t("scan.disclaimer")}</Notice>
              {res.scan_id && res.mode === "model" && (
                <div style={{ marginTop: 12 }}>
                  {saved ? <Notice tone="ok">{t("scan.confirmed")}</Notice> : (
                    <div className="row"><input className="input" placeholder={t("scan.confirm_ph")} value={label} onChange={(e) => setLabel(e.target.value)} aria-label={t("scan.confirm")} /><Button className="ghost" onClick={confirm} disabled={!label}>{t("scan.confirm")}</Button></div>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <Card title={t("scan.history")}>
          <table className="t"><thead><tr><th>{t("date")}</th><th>{t("plots.crop")}</th><th>{t("scan.hyp")}</th><th>{t("scan.confirm")}</th></tr></thead><tbody>
            {history.slice(0, 8).map((s) => (
              <tr key={s.id}><td>{dateLong(s.created_at?.slice(0, 10), lang)}</td><td>{s.crop || "–"}</td><td>{s.result?.hypotheses?.[0]?.nom || "–"}</td><td>{s.confirmed || "–"}</td></tr>
            ))}
          </tbody></table>
        </Card>
      )}
    </div>
  );
}
