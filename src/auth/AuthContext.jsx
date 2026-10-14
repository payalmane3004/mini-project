import { useMemo, useState } from "react";
import { AuthContext, SESSION_KEY, VALID_ROLES } from "./authState";

function readSession() {
  try {
    const session = JSON.parse(window.sessionStorage.getItem(SESSION_KEY));
    return VALID_ROLES.has(session?.role) ? { role: session.role } : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);

  const value = useMemo(() => ({
    user,
    signIn(role) {
      if (!VALID_ROLES.has(role)) throw new Error("Unsupported demo role");
      const session = { role };
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setUser(session);
    },
    signOut() {
      window.sessionStorage.removeItem(SESSION_KEY);
      setUser(null);
    },
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
