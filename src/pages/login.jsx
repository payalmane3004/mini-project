import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, User, GraduationCap } from "lucide-react";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();

    // Temporary login credentials
    if (email === "admin@college.com" && password === "admin123") {
      navigate("/Admin");
      return;
    }

    if (email === "student@college.com" && password === "student123") {
      navigate("/student-dashboard");
      return;
    }

    alert("Invalid email or password");
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

        <form onSubmit={handleLogin}>

          <div className="login-field">
            <label>Email</label>

            <div className="login-input">
              <User size={18} />

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label>Password</label>

            <div className="login-input">
              <LockKeyhole size={18} />

              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button className="login-button" type="submit">
            Login
          </button>

        </form>

        <div className="demo-credentials">
          <p>Demo Accounts</p>

          <span>
            Admin: admin@college.com / admin123
          </span>

          <span>
            Student: student@college.com / student123
          </span>
        </div>

      </div>
    </div>
  );
}

export default Login;