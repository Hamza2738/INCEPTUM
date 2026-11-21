import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { BookOpen, Bot, Calculator, LayoutDashboard, LogOut, Map as MapIcon, ScanLine, Sprout } from "lucide-react";
import { useAuth } from "../auth";
import { LANG_LABEL, useI18n } from "../i18n";
import { pick } from "../lib/format";
import Logo from "./Logo";

const NAV = [
  { to: "/", key: "dashboard", icon: LayoutDashboard, end: true },
  { to: "/plots", key: "plots", icon: Sprout },
  { to: "/map", key: "map", icon: MapIcon },
  { to: "/economics", key: "economics", icon: Calculator },
  { to: "/scanner", key: "scanner", icon: ScanLine },
  { to: "/advisor", key: "advisor", icon: Bot },
  { to: "/about", key: "about", icon: BookOpen },
];
// On small screens the bottom bar shows five items
const BOTTOM = ["dashboard", "plots", "map", "economics", "advisor"];

export function LangSwitch() {
  const { region, changeLang } = useAuth();
  const { lang } = useI18n();
  const langs = region ? region.languages : ["en", "fr", "ar", "ja"];
  return (
    <div className="lang-switch" role="group" aria-label="language">
      {langs.map((l) => <button key={l} className={l === lang ? "active" : ""} onClick={() => changeLang(l)} lang={l}>{LANG_LABEL[l]}</button>)}
    </div>
  );
}

export default function Layout() {
  const { user, region, logout } = useAuth();
  const { t, lang } = useI18n();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><Logo className="logo" />{t("app_name")}</div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <n.icon size={19} aria-hidden />{t(`nav.${n.key}`)}
          </NavLink>
        ))}
        <div className="spacer" />
        <button className="nav-item" style={{ background: "none", border: "none", cursor: "pointer", textAlign: "start" }} onClick={logout}><LogOut size={19} aria-hidden />{t("logout")}</button>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="row">
            <span className="region-chip">{region ? pick(region.name, lang) : ""} · {region ? region.currency : ""}</span>
            <span className="muted small hide-mobile">{user?.name}</span>
          </div>
          <div className="row"><LangSwitch /><button className="btn ghost icon sm no-print" onClick={logout} aria-label={t("logout")} title={t("logout")}><LogOut size={16} /></button></div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
      <nav className="bottomnav">
        {BOTTOM.map((k) => {
          const n = NAV.find((x) => x.key === k);
          return <NavLink key={k} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "active" : "")}><n.icon size={20} aria-hidden />{t(`nav.${k}`)}</NavLink>;
        })}
      </nav>
    </div>
  );
}
