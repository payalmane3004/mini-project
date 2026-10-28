import { useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { createDemoResetLink, requestPasswordReset } from "../api/auth";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    setResetUrl("");
    try {
      const result = await requestPasswordReset(email);
      setMessage(result.message);
      const demoResult = await createDemoResetLink(email);
      if (demoResult.reset_url) setResetUrl(demoResult.reset_url);
    } catch (requestError) {
      setError(requestError.message || "Password reset is unavailable in this environment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card recovery-card" aria-labelledby="forgot-title">
        <div className="login-logo"><GraduationCap size={32} /></div>
        <h1 id="forgot-title">Forgot password?</h1>
        <p className="login-subtitle">Enter the email for your documented local demo account.</p>
        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="recovery-email">Email</label>
            <input id="recovery-email" name="email" type="email" autoComplete="email" required maxLength={255}
              value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          {message && <p className="recovery-message" role="status">{message}</p>}
          {resetUrl && <p className="recovery-link-result"><Link to={resetUrl}>Open your local demo reset link</Link></p>}
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-button" type="submit" disabled={submitting}>
            {submitting ? "Preparing…" : "Request reset link"}
          </button>
        </form>
        <p className="login-recovery-link"><Link to="/login">Back to login</Link></p>
      </section>
    </main>
  );
}

export default ForgotPassword;
