import React, { useEffect, useRef, useState } from "react";
import { Camera, ScanLine, SwitchCamera } from "lucide-react";
import Webcam from "react-webcam";
import { api } from "../api";
import { useI18n } from "../i18n";
import { dateLong, num } from "../lib/format";
import { Button, Card, ErrorNote, Notice, Pill } from "../components/ui";

export default function Scanner() {
  const { t, lang } = useI18n();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState("upload");
  const [live, setLive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraRequested, setCameraRequested] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("environment");
  const [frameStatus, setFrameStatus] = useState("idle");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  const [label, setLabel] = useState("");
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState([]);
  const input = useRef();
  const video = useRef();
  const webcam = useRef();
  const canvas = useRef();
  const streamRef = useRef(null);
  const liveTimer = useRef(null);
  const busyRef = useRef(false);

  const loadHistory = () => api.get("/ai/scans").then((r) => setHistory(r.scans)).catch(() => {});
  useEffect(() => { loadHistory(); }, []);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  useEffect(() => () => stopCamera(), []);

  const choose = (f) => { if (!f) return; setFile(f); setPreview(URL.createObjectURL(f)); setRes(null); setSaved(false); setLabel(""); };

  const analyze = async () => { if (file) await analyzeFile(file); };

  const stopCamera = () => {
    if (liveTimer.current) clearInterval(liveTimer.current);
    liveTimer.current = null;
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (video.current) {
      video.current.pause?.();
      video.current.srcObject = null;
    }
    setCameraRequested(false);
    setLive(false);
    setCameraStarting(false);
  };

  const analyzeFile = async (imageFile) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(null); setRes(null); setSaved(false); setLabel("");
    const fd = new FormData();
    fd.append("file", imageFile);
    fd.append("lang", lang);
    try {
      const next = await api.upload("/ai/scan", fd);
      setRes(next); setFrameStatus(next?.result?.plante_detectee ? "plant" : next?.result ? "searching" : "searching"); loadHistory();
    } catch (e) { setError(e); } finally { busyRef.current = false; setBusy(false); }
  };

  const captureAndAnalyze = async () => {
    const player = webcam.current?.video || video.current;
    if (!player || !canvas.current || busyRef.current) return;
    if (player.readyState < 2) return;
    const width = player.videoWidth;
    const height = player.videoHeight;
    if (!width || !height) return;
    canvas.current.width = width;
    canvas.current.height = height;
    const ctx = canvas.current.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(player, 0, 0, width, height);

    const insetX = Math.round(width * 0.12);
    const insetY = Math.round(height * 0.12);
    const frameW = width - insetX * 2;
    const frameH = height - insetY * 2;
    const pixels = ctx.getImageData(insetX, insetY, frameW, frameH).data;
    let greenPixels = 0;
    for (let i = 0; i < pixels.length; i += 16) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      if (g > r * 1.08 && g > b * 1.05 && g > 55) greenPixels++;
    }
    const greenRatio = greenPixels / Math.max(1, pixels.length / 16);
    setFrameStatus(greenRatio > 0.12 ? "checking" : "searching");

    const blob = await new Promise((resolve) => canvas.current.toBlob(resolve, "image/jpeg", 0.88));
    if (blob) await analyzeFile(new File([blob], "live-scan.jpg", { type: "image/jpeg" }));
  };

  const handleCameraReady = () => {
    setLive(true);
    setCameraStarting(false);
    setFrameStatus("searching");
    if (liveTimer.current) clearInterval(liveTimer.current);
    window.setTimeout(captureAndAnalyze, 500);
    liveTimer.current = window.setInterval(captureAndAnalyze, 6000);
  };

  const handleCameraError = (cameraError) => {
    setCameraStarting(false);
    setCameraRequested(false);
    setLive(false);

    let message = t("scan.camera_failed");
    const name = cameraError?.name;
    if (name === "NotAllowedError" || name === "PermissionDeniedError") message = t("scan.camera_denied");
    else if (name === "NotFoundError" || name === "DevicesNotFoundError") message = t("scan.camera_not_found");
    else if (name === "NotReadableError" || name === "TrackStartError") message = t("scan.camera_busy");
    setError({ message });
  };

  const startCamera = async (preferredFacing = cameraFacing) => {
    setError(null);
    setFrameStatus("idle");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError({ message: t("scan.camera_unavailable") });
      setCameraStarting(false);
      return;
    }
    if (!window.isSecureContext) {
      setError({ message: t("scan.camera_secure") });
      setCameraStarting(false);
      return;
    }

    setCameraFacing(preferredFacing);
    setCameraStarting(true);
    setCameraRequested(true);
  };

  const switchCamera = async () => {
    const next = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(next);
    stopCamera();
    await startCamera(next);
  };
  const confirm = async () => { await api.post(`/ai/scan/${res.scan_id}/confirm`, { label }); setSaved(true); loadHistory(); };

  const reasonText = (r) => t(`scan.q_${r}`);
  const r = res?.result;

  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t("scan.title")}</h1><p>{t("scan.sub")}</p></div></div>
      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <Card>
          <div className="tabs" style={{ marginBottom: 14 }}>
            <button type="button" className={`tab ${mode === "upload" ? "active" : ""}`} onClick={() => { stopCamera(); setMode("upload"); }}><Camera size={16} />{t("scan.upload_mode")}</button>
            <button type="button" className={`tab ${mode === "live" ? "active" : ""}`} onClick={() => setMode("live")}><SwitchCamera size={16} />{t("scan.live_mode")}</button>
          </div>

          {mode === "upload" ? (
            <>
              <div className="drop" onClick={() => input.current.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files[0]); }} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && input.current.click()}>
                {preview ? <img src={preview} alt="" /> : <><Camera size={30} aria-hidden /><div><b>{t("scan.upload")}</b></div><div className="tiny">{t("scan.hint")}</div></>}
                <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(e) => choose(e.target.files[0])} />
              </div>
              <div className="stack" style={{ marginTop: 14 }}>
                <Button busy={busy} disabled={!file} onClick={analyze}><ScanLine size={16} />{busy ? t("scan.analyzing") : t("scan.analyze")}</Button>
              </div>
            </>
          ) : (
            <div className="stack">
              <div className="live-camera">
                {cameraRequested ? (
                  <Webcam
                    ref={webcam}
                    audio={false}
                    muted
                    playsInline
                    mirrored={cameraFacing === "user"}
                    screenshotFormat="image/jpeg"
                    screenshotQuality={0.88}
                    videoConstraints={{
                      facingMode: { ideal: cameraFacing },
                      width: { ideal: 1280 },
                      height: { ideal: 720 },
                    }}
                    onUserMedia={handleCameraReady}
                    onUserMediaError={handleCameraError}
                    aria-label={t("scan.live_video")}
                  />
                ) : (
                  <div className="live-camera-placeholder"><Camera size={34} /><div>{cameraStarting ? t("scan.camera_starting") : t("scan.live_hint")}</div></div>
                )}
                {live && <div className={`plant-focus-frame ${frameStatus}`}><span /><span /><span /><span /></div>}
                {live && <div className={`plant-frame-status ${frameStatus}`}><ScanLine size={14} />{t(`scan.frame_${frameStatus}`)}</div>}
              </div>
              <canvas ref={canvas} hidden />
              <div className="row wrap">
                {!live ? (
                  <Button onClick={() => startCamera(cameraFacing)} busy={cameraStarting}><Camera size={16} />{cameraStarting ? t("scan.camera_starting") : t("scan.start_live")}</Button>
                ) : (
                  <>
                    <Button onClick={captureAndAnalyze} busy={busy}><ScanLine size={16} />{t("scan.scan_now")}</Button>
                    <Button className="ghost" onClick={switchCamera}><SwitchCamera size={16} />{t("scan.switch_camera")}</Button>
                    <Button className="ghost" onClick={stopCamera}>{t("scan.stop_live")}</Button>
                  </>
                )}
              </div>
            </div>
          )}
        </Card>

        <div className="stack">
          <ErrorNote error={error} />
          {res && res.ok === false && <Notice tone="warn"><div><b>{t("scan.quality_bad")}</b> {(res.quality?.reasons || []).map(reasonText).join(", ")}</div></Notice>}
          {res?.mode === "unconfigured" && <Notice tone="info">{t("scan.unconfigured")}</Notice>}
          {res?.mode === "error" && <Notice tone="risk">{t("scan.error")}</Notice>}
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
              {res.scan_id && (res.mode === "model" || res.mode === "gemini") && (
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
