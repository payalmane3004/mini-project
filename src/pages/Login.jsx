import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Activity, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Wifi } from "lucide-react";
import { useAuth } from "../auth/useAuth";

function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  if (user) return <Navigate to={user.role === "ADMIN" ? "/" : "/student"} replace />;

  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const account = login(String(form.get("email")), remember);
    navigate(account.role === "ADMIN" ? "/" : "/student", { replace: true });
  }

  return <main className="login-page"><section className="login-card"><div className="login-brand"><span className="login-logo"><Wifi size={24}/></span><div><strong>SMART CAMPUS</strong><small>Digital Twin Platform</small></div></div><div className="login-heading"><span className="login-eyebrow"><Activity size={14}/> WALCHAND COLLEGE OF ENGINEERING</span><h1>Welcome back</h1><p>Sign in to continue to your campus workspace.</p></div><form onSubmit={submit} className="login-form"><label>Email / College ID<span className="login-input"><Mail size={17}/><input name="email" type="email" placeholder="name@walchandsangli.ac.in" required autoComplete="username"/></span></label><label>Password<span className="login-input"><LockKeyhole size={17}/><input name="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" required autoComplete="current-password"/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label><div className="login-options"><label className="login-remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)}/>Remember me</label><button type="button" onClick={() => window.alert("Please contact your campus administrator to reset your password.")}>Forgot password?</button></div><button className="login-submit" type="submit">Sign in <ArrowRight size={17}/></button></form><div className="login-role-note"><LockKeyhole size={15}/><span>Your campus account determines your workspace. Admin and student access is assigned automatically.</span></div><footer>CampusSphere <span>·</span> Smart Campus Digital Twin</footer></section><aside className="login-visual"><div className="login-orbit orbit-one"/><div className="login-orbit orbit-two"/><div className="login-visual-copy"><span>ONE CONNECTED CAMPUS</span><h2>See your campus<br/>in a smarter way.</h2><p>Rooms, resources and campus services connected in one digital experience.</p><div className="login-campus-status"><i/> Campus systems online <span>·</span> Walchand College of Engineering</div></div><div className="login-building-shapes"><div/><div/><div/><div/><span/></div></aside></main>;
}

export default Login;
