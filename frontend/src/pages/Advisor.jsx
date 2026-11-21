import React, { useEffect, useRef, useState } from "react";
import { Send, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { AdviceList } from "../components/Advice";
import { Button, Card, ErrorNote, Field, Notice, Spinner } from "../components/ui";

export default function Advisor() {
  const { region } = useAuth();
  const { t, lang } = useI18n();
  const [plots, setPlots] = useState(null);
  const [plotId, setPlotId] = useState("");
  const [status, setStatus] = useState(null);
  const [advice, setAdvice] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const end = useRef();

  useEffect(() => {
    api.get("/plots").then((r) => { setPlots(r.plots); if (r.plots[0]) setPlotId(String(r.plots[0].id)); }).catch(setError);
    api.get("/ai/status").then(setStatus).catch(() => {});
  }, []);
  useEffect(() => {
    if (!plotId) return;
    setMsgs([]);
    api.post("/ai/advice", { plot_id: Number(plotId), lang }).then((r) => setAdvice(r.advice)).catch(setError);
  }, [plotId, lang]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const send = async (text) => {
    const message = (text ?? q).trim();
    if (!message || !plotId) return;
    setQ(""); setBusy(true); setError(null);
    const history = msgs.map((m) => ({ role: m.role === "me" ? "user" : "assistant", content: m.text }));
    setMsgs((m) => [...m, { role: "me", text: message }]);
    try {
      const r = await api.post("/ai/chat", { plot_id: Number(plotId), message, lang, history });
      setMsgs((m) => [...m, { role: "ai", text: r.reply || t("adv.unconfigured") }]);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  if (!plots) return <Spinner />;
  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t("adv.title")}</h1><p>{t("adv.sub")}</p></div></div>
      <ErrorNote error={error} />
      {!plots.length ? <Notice tone="info">{t("dash.empty_d")}</Notice> : (
        <div className="grid cols-2" style={{ alignItems: "start" }}>
          <div className="stack">
            <Card title={t("adv.rules")} right={<span className="pill ok"><ShieldCheck size={14} aria-hidden />{t("adv.grounded")}</span>}>
              <Field label={t("adv.pick_plot")}><select className="input" value={plotId} onChange={(e) => setPlotId(e.target.value)}>{plots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <div style={{ marginTop: 12 }}><AdviceList items={advice} crops={region.crop_list} /></div>
            </Card>
          </div>
          <Card title={t("adv.title")}>
            {status && !status.llm && <Notice tone="info">{t("adv.unconfigured")}</Notice>}
            <div className="chat" style={{ marginTop: 10 }}>
              {msgs.length === 0 && (
                <div className="stack tight"><span className="small muted">{t("adv.suggestions")}</span>
                  {["s1", "s2", "s3", "s4"].map((k) => <button key={k} className="chip" onClick={() => send(t(`adv.${k}`))}>{t(`adv.${k}`)}</button>)}
                </div>
              )}
              {msgs.map((m, i) => <div key={i} className={`bubble ${m.role}`}>{m.text}</div>)}
              {busy && <div className="bubble ai muted">{t("adv.thinking")}</div>}
              <div ref={end} />
            </div>
            <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); send(); }}>
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("adv.ph")} maxLength={1000} />
              <Button type="submit" disabled={busy || !q.trim()} aria-label={t("adv.send")}><Send size={16} className="flip" /></Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
