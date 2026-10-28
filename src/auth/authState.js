import { createContext } from "react";

export const AuthContext = createContext(null);
export const SESSION_KEY = "smart-campus-auth-session";
export const LEGACY_SESSION_KEY = "smart-campus-demo-session";
export const SESSION_EXPIRED_EVENT = "campussphere:session-expired";
export const VALID_ROLES = new Set(["admin", "student"]);

export function isInvalidSessionError(error) {
  // Only a server rejection proves that the bearer token is no longer valid.
  // Network errors and 5xx responses must not erase a restorable session.
  return error?.status === 401;
}
