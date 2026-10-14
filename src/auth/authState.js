import { createContext } from "react";

export const AuthContext = createContext(null);
export const SESSION_KEY = "smart-campus-demo-session";
export const VALID_ROLES = new Set(["admin", "student"]);
