import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, setUnauthorizedHandler } from "./api";
import { useI18n } from "./i18n";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const { setLang } = useI18n();
  const [user, setUser] = useState(null);
  const [regions, setRegions] = useState(null);
  const [booting, setBooting] = useState(true);

  const logout = useCallback(() => { setToken(null); setUser(null); document.documentElement.removeAttribute("data-theme"); }, []);

  // Apply the regional theme whenever the user changes
  useEffect(() => {
    if (user) document.documentElement.setAttribute("data-theme", user.region === "JP" ? "jp" : "tn");
  }, [user]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    (async () => {
      try {
        const r = await api.get("/regions");
        setRegions(r.regions);
      } catch (e) { /* login page shows the network error */ }
      if (getToken()) {
        try {
          const me = await api.get("/auth/me");
          setUser(me.user);
          setLang(me.user.lang);
        } catch (e) { setToken(null); }
      }
      setBooting(false);
    })();
  }, [logout, setLang]);

  const onAuth = (res) => { setToken(res.token); setUser(res.user); setLang(res.user.lang); };

  const login = async (email, password, region) => onAuth(await api.post("/auth/login", { email, password, region }));
  const register = async (payload) => onAuth(await api.post("/auth/register", payload));
  const changeLang = async (l) => {
    setLang(l);
    if (user) { try { const r = await api.put("/auth/me", { lang: l }); setUser(r.user); } catch (e) { /* ignore */ } }
  };

  const region = user && regions ? regions[user.region] : null;

  return <Ctx.Provider value={{ user, region, regions, booting, login, register, logout, changeLang }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
