import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LockKeyhole, User, GraduationCap } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { loginWithPassword } from "../api/auth";
import { readLoginCredentials } from "../auth/loginForm.js";
import { Link } from "react-router-dom";

const HOME_BY_ROLE = { admin: "/", student: "/student-dashboard" };

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, sessionError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // Read the submitted controls themselves. Password managers and browser
      // autofill can update input values without synchronizing React state.
      const formData = new FormData(e.currentTarget);
      const credentials = readLoginCredentials(formData);
      const authResponse = await loginWithPassword(credentials.email, credentials.password);
      signIn(authResponse);
      const destination = location.state?.from?.pathname || HOME_BY_ROLE[authResponse.user.role];
      navigate(destination, { replace: true });
    } catch (loginError) {
      setError(loginError.message || "Could not sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-logo">
          <GraduationCap size={32} />
        </div>

        <h1>Smart Campus</h1>

        <p className="login-subtitle">
          Digital Twin Campus Management System
        </p>

        {new URLSearchParams(location.search).get("reset") === "success" && (
          <p className="recovery-message" role="status">Password updated. Sign in with your new password.</p>
        )}

        <form onSubmit={handleLogin}>

          <div className="login-field">
            <label htmlFor="login-email">Email</label>

            <div className="login-input">
              <User size={18} />

              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>

            <div className="login-input">
              <LockKeyhole size={18} />

              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {sessionError && <p className="login-error" role="status">{sessionError}</p>}
          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="login-button" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Login"}
          </button>

        </form>

        <div className="login-recovery-link"><Link to="/forgot-password">Forgot password?</Link></div>

        <p className="login-account-note">Sign in with an account provisioned by your CampusSphere administrator.</p>

      </div>
    </div>
  );
}

export default Login;
