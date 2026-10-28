import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AuthContext,
  LEGACY_SESSION_KEY,
  SESSION_EXPIRED_EVENT,
  SESSION_KEY,
  VALID_ROLES,
  isInvalidSessionError,
} from "./authState";
import { fetchAuthenticatedUser } from "../api/auth";

function readSession() {
  try {
    const session = JSON.parse(window.sessionStorage.getItem(SESSION_KEY));
    if (typeof session?.access_token === "string" && VALID_ROLES.has(session?.user?.role)) {
      return session;
    }
  } catch {
    // A malformed or outdated browser session is treated as signed out.
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sessionError, setSessionError] = useState("");
  const [loading, setLoading] = useState(() => Boolean(readSession()?.access_token));

  const signOut = useCallback(() => {
    window.sessionStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
    setUser(null);
    setSessionError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    const session = readSession();
    window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
    if (!session) return undefined;

    let active = true;
    fetchAuthenticatedUser().then((verifiedUser) => {
      if (!active) return;
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        access_token: session.access_token,
        user: verifiedUser,
      }));
      setUser(verifiedUser);
    }).catch((error) => {
      if (!active) return;
      // Never grant access from cached role data. Keep the token only when
      // verification failed transiently so a later login/reload can retry.
      if (isInvalidSessionError(error)) {
        signOut();
      } else {
        setSessionError("Could not verify your saved session because the CampusSphere API is unavailable. Sign in again when the service is reachable.");
      }
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [signOut]);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, signOut);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, signOut);
  }, [signOut]);

  const value = useMemo(() => ({
    user,
    loading,
    sessionError,
    signIn(authResponse) {
      const session = { access_token: authResponse.access_token, user: authResponse.user };
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
      setUser(authResponse.user);
      setSessionError("");
      setLoading(false);
    },
    signOut,
  }), [user, loading, sessionError, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
