import React from "react";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "../i18n";
import { useMode } from "../lib/mode";

// Sun / moon button that switches between the light and dark Web3 themes.
export default function ModeToggle({ className = "" }) {
  const { t } = useI18n();
  const [mode, toggle] = useMode();
  const label = mode === "dark" ? t("mode_light") : t("mode_dark");
  return (
    <button type="button" className={`btn ghost icon sm no-print mode-toggle ${className}`} onClick={toggle} aria-label={label} title={label}>
      {mode === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  );
}
