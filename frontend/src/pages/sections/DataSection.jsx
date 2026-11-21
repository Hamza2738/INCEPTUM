import React, { useEffect, useRef, useState } from "react";
import { FileUp, Plus, Trash2 } from "lucide-react";
import { api } from "../../api";
import { useI18n } from "../../i18n";
import { dateLong, num } from "../../lib/format";
import { Button, Card, Empty, ErrorNote, Field, Notice, Pill, Spinner } from "../../components/ui";

const TEST_FIELDS = ["ph", "ec", "n_ppm", "p_ppm", "k_ppm", "om"];
const KINDS = ["irrigation", "fertilization", "treatment", "observation", "harvest", "expense"];
const today = () => new Date().toISOString().slice(0, 10);

function SoilTests({ plot, onChange }) {
  const { t, lang } = useI18n();
  const [tests, setTests] = useState(null);
  const [form, setForm] = useState(null); // null = hidden
  const [meta, setMeta] = useState(null); // extraction metadata
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState("");
  const file = useRef();

  const load = () => api.get(`/plots/${plot.id}/tests`).then((r) => setTests(r.tests)).catch(setErr);
  useEffect(() => { load(); }, [plot.id]);
  const open = () => { setForm({ date: today(), ph: "", ec: "", n_ppm: "", p_ppm: "", k_ppm: "", om: "", source: "manual" }); setMeta(null); setMsg(""); };

  const extract = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setBusy(true); setMsg(t("data.extracting")); setErr(null);
    const fd = new FormData(); fd.append("file", f);
    try {
      const r = await api.upload("/ai/extract-lab", fd);
      if (r.mode === "unconfigured") setMsg(t("data.extract_unconfigured"));
      else if (r.mode === "error" || !r.result) setMsg(t("data.extract_error"));
      else {
        const vals = r.result.values || {};
        const next = { date: r.result.date || today(), source: "extracted" };
        TEST_FIELDS.forEach((k) => { next[k] = vals[k] && vals[k].v != null ? vals[k].v : ""; });
        setForm(next); setMeta({ conf: Object.fromEntries(TEST_FIELDS.map((k) => [k, vals[k]?.conf ?? null])), unreadable: r.result.unreadable_fields || [] });
        setMsg(t("data.extract_check"));
      }
    } catch (ex) { setErr(ex); setMsg(""); } finally { setBusy(false); e.target.value = ""; }
  };

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { ...form }; TEST_FIELDS.forEach((k) => { body[k] = body[k] === "" ? null : Number(body[k]); });
      await api.post(`/plots/${plot.id}/tests`, body);
      setForm(null); setMeta(null); setMsg(""); await load(); onChange();
    } catch (ex) { setErr(ex); } finally { setBusy(false); }
  };
  const del = async (id) => { if (!window.confirm(t("confirm_delete"))) return; await api.del(`/tests/${id}`); await load(); onChange(); };
  const labels = { ph: t("data.ph"), ec: t("data.ec"), n_ppm: t("data.n_ppm"), p_ppm: t("data.p_ppm"), k_ppm: t("data.k_ppm"), om: t("data.om") };

  return (
    <Card title={t("data.tests")} sub={t("data.tests_sub")} right={!form && <Button className="sm" onClick={open}><Plus size={14} />{t("data.add_test")}</Button>}>
      <ErrorNote error={err} />
      {form && (
        <form className="stack" onSubmit={save} style={{ marginBottom: 16 }}>
          <div className="drop" onClick={() => file.current.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && file.current.click()}>
            <FileUp size={22} aria-hidden /><div><b>{t("data.upload")}</b></div><div className="tiny">{t("data.upload_hint")}</div>
            <input ref={file} type="file" accept="image/*,application/pdf" hidden onChange={extract} />
          </div>
          {msg && <Notice tone={msg === t("data.extract_check") ? "warn" : "info"}>{msg}</Notice>}
          {meta?.unreadable?.length > 0 && <div className="small muted">{t("data.unreadable")}: {meta.unreadable.join(", ")}</div>}
          <div className="form-grid">
            <Field label={t("date")}><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></Field>
            {TEST_FIELDS.map((k) => (
              <Field key={k} label={<>{labels[k]} {meta?.conf?.[k] != null && meta.conf[k] < 0.7 && <Pill tone="warn">{t("data.low_conf")}</Pill>}</>}>
                <input className="input" type="number" step="any" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
          <div className="row"><Button type="submit" busy={busy}>{meta ? t("data.use_values") : t("save")}</Button><Button type="button" className="ghost" onClick={() => { setForm(null); setMeta(null); setMsg(""); }}>{t("cancel")}</Button></div>
        </form>
      )}
      {tests === null ? <Spinner /> : tests.length === 0 ? <p className="muted">{t("data.no_tests")}</p> : (
        <div className="table-wrap"><table className="t"><thead><tr><th>{t("date")}</th>{TEST_FIELDS.map((k) => <th key={k} className="n">{labels[k]}</th>)}<th>{t("data.source")}</th><th /></tr></thead><tbody>
          {tests.map((x) => (
            <tr key={x.id}><td>{dateLong(x.date, lang)}</td>{TEST_FIELDS.map((k) => <td key={k} className="n">{x[k] == null ? "–" : num(x[k], lang, 1)}</td>)}
              <td>{t(`data.${x.source}`) }</td>
              <td><button className="btn danger sm" onClick={() => del(x.id)} aria-label={t("delete")}><Trash2 size={13} /></button></td></tr>
          ))}
        </tbody></table></div>
      )}
    </Card>
  );
}

function Journal({ plot }) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => api.get(`/plots/${plot.id}/journal`).then((r) => setRows(r.entries)).catch(setErr);
  useEffect(() => { load(); }, [plot.id]);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/plots/${plot.id}/journal`, { ...form, quantity: form.quantity === "" ? null : Number(form.quantity), cost: form.cost === "" ? null : Number(form.cost) });
      setForm(null); load();
    } catch (ex) { setErr(ex); }
  };
  const del = async (id) => { await api.del(`/journal/${id}`); load(); };

  return (
    <Card title={t("data.journal")} sub={t("data.journal_sub")} right={!form && <Button className="sm" onClick={() => setForm({ date: today(), kind: "irrigation", quantity: "", cost: "", note: "" })}><Plus size={14} />{t("data.add_entry")}</Button>}>
      <ErrorNote error={err} />
      {form && (
        <form className="stack" onSubmit={save} style={{ marginBottom: 16 }}>
          <div className="form-grid">
            <Field label={t("date")}><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></Field>
            <Field label={t("data.kind")}><select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{t(`data.kinds.${k}`)}</option>)}</select></Field>
            <Field label={t("quantity")}><input className="input" type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
            <Field label={t("cost")}><input className="input" type="number" step="any" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
          </div>
          <Field label={t("note")}><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={500} /></Field>
          <div className="row"><Button type="submit">{t("save")}</Button><Button type="button" className="ghost" onClick={() => setForm(null)}>{t("cancel")}</Button></div>
        </form>
      )}
      {rows === null ? <Spinner /> : rows.length === 0 ? <p className="muted">{t("data.no_journal")}</p> : (
        <div className="table-wrap"><table className="t"><thead><tr><th>{t("date")}</th><th>{t("data.kind")}</th><th className="n">{t("quantity")}</th><th className="n">{t("cost")}</th><th>{t("note")}</th><th /></tr></thead><tbody>
          {rows.map((r) => (
            <tr key={r.id}><td>{dateLong(r.date, lang)}</td><td>{t(`data.kinds.${r.kind}`)}</td><td className="n">{r.quantity == null ? "–" : num(r.quantity, lang, 1)}</td><td className="n">{r.cost == null ? "–" : num(r.cost, lang, 0)}</td><td>{r.note}</td>
              <td><button className="btn danger sm" onClick={() => del(r.id)} aria-label={t("delete")}><Trash2 size={13} /></button></td></tr>
          ))}
        </tbody></table></div>
      )}
    </Card>
  );
}

export default function DataSection({ plot, onChange }) {
  return <div className="stack"><SoilTests plot={plot} onChange={onChange} /><Journal plot={plot} /></div>;
}
