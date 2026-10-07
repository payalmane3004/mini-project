import { useMemo, useState } from "react";
import { AuthContext } from "./auth-context";
const STORAGE_KEY = "campussphere-session";

function loadSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadSession);
  const value = useMemo(() => ({
    user,
    login(email, remember = true) {
      const normalized = email.trim().toLowerCase();
      const admin = normalized.startsWith("admin") || normalized.includes("@admin.") || normalized.includes(".admin@");
      const next = { email: normalized, name: admin ? "Admin" : (normalized.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Student"), role: admin ? "ADMIN" : "STUDENT" };
      localStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(STORAGE_KEY);
      (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(next)); setUser(next); return next;
    },
    logout() { localStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(STORAGE_KEY); setUser(null); },
  }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

