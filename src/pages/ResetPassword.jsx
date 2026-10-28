import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, GraduationCap } from "lucide-react";
import { completePasswordReset } from "../api/auth";
import { passwordPolicyError, validateNewPassword } from "../auth/passwordPolicy.js";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const validationError = validateNewPassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!token) {
      setError("This reset link is missing its token. Request a new demo reset link.");
      return;
    }
    setSubmitting(true);
    try {
      await completePasswordReset({ token, newPassword: password, confirmPassword: confirmation });
      navigate("/login?reset=success", { replace: true });
    } catch (resetError) {
      setError(resetError.message || "This reset link is invalid or expired. Request a new demo reset link.");
    } finally {
      setSubmitting(false);
    }
  }

  const policyMessage = password ? passwordPolicyError(password) : "Use at least 12 characters and three character classes.";
  return (
    <main className="login-page">
      <section className="login-card recovery-card" aria-labelledby="reset-title">
        <div className="login-logo"><GraduationCap size={32} /></div>
        <h1 id="reset-title">Set a new password</h1>
        <p className="login-subtitle">Choose a strong password for this local demo account.</p>
        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="new-password">New password</label>
            <div className="recovery-password-field">
              <input id="new-password" name="new_password" type={showPassword ? "text" : "password"}
                autoComplete="new-password" required maxLength={1024} value={password}
                onChange={(event) => setPassword(event.target.value)} aria-describedby="password-guidance" />
              <button className="password-visibility" type="button" aria-label={showPassword ? "Hide new password" : "Show new password"}
                aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <small id="password-guidance" className={policyMessage && password ? "recovery-policy recovery-policy-error" : "recovery-policy"}>{policyMessage}</small>
          </div>
          <div className="login-field">
            <label htmlFor="confirm-password">Confirm new password</label>
            <div className="recovery-password-field">
              <input id="confirm-password" name="confirm_password" type={showConfirmation ? "text" : "password"}
                autoComplete="new-password" required maxLength={1024} value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)} />
              <button className="password-visibility" type="button" aria-label={showConfirmation ? "Hide confirmation" : "Show confirmation"}
                aria-pressed={showConfirmation} onClick={() => setShowConfirmation((visible) => !visible)}>
                {showConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-button" type="submit" disabled={submitting}>{submitting ? "Saving…" : "Reset password"}</button>
        </form>
        <p className="login-recovery-link"><Link to="/forgot-password">Request another reset link</Link></p>
      </section>
    </main>
  );
}

export default ResetPassword;
