// Thin fetch wrapper. In development Vite proxies /api to Flask; in production Flask serves the build itself.
const BASE = import.meta.env.VITE_API_BASE || "/api";
const TOKEN_KEY = "ss_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(method, path, body, isForm = false) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isForm) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  } catch (e) {
    const err = new Error("network");
    err.code = "network";
    throw err;
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    const err = new Error((data && data.error) || `http_${res.status}`);
    err.code = (data && data.error) || `http_${res.status}`;
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request("GET", p),
  post: (p, b) => request("POST", p, b || {}),
  put: (p, b) => request("PUT", p, b || {}),
  del: (p) => request("DELETE", p),
  upload: (p, form) => request("POST", p, form, true),
  // POST a JSON body and save the returned file (e.g. an .xlsx) on the user's device.
  download: async (p, body, fallbackName) => {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(BASE + p, { method: "POST", headers, body: JSON.stringify(body || {}) });
    if (!res.ok) {
      if (res.status === 401 && token) onUnauthorized();
      const err = new Error(`http_${res.status}`);
      err.code = `http_${res.status}`;
      throw err;
    }
    const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || fallbackName;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
