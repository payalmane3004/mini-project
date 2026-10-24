import { LogOut, Mail, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { getStudentProfileDetails } from "./profileData";
import "./StudentProfile.css";

function StudentProfile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const profile = getStudentProfileDetails(user);

  return (
    <div className="student-profile-page">
      <div className="student-page-header">
        <div>
          <h1>My Profile</h1>
          <p>Verified account information for your signed-in session.</p>
        </div>
      </div>

      <div className="student-profile-layout">
        <section className="student-profile-card profile-main-card">
          <div className="profile-avatar"><User size={42} /></div>
          <h2>{profile.name || "Name unavailable"}</h2>
          <span className="profile-role">{profile.role}</span>
          <div className="profile-divider" />
          <p className="student-profile-unavailable">
            Department, student ID, phone, and academic details are not provided by the current account API.
          </p>
        </section>

        <section className="student-profile-card">
          <div className="profile-section-header">
            <div><h2>Account information</h2><p>Only fields supplied by the authenticated account are shown.</p></div>
          </div>
          <div className="profile-form-grid">
            <div className="profile-field">
              <label>Full Name</label>
              <div className="profile-input-wrapper"><User size={17} /><span>{profile.name || "Unavailable"}</span></div>
            </div>
            <div className="profile-field">
              <label>Email</label>
              <div className="profile-input-wrapper"><Mail size={17} /><span>{profile.email || "Unavailable"}</span></div>
            </div>
            <div className="profile-field">
              <label>Role</label>
              <div className="profile-input-wrapper"><User size={17} /><span>{profile.role}</span></div>
            </div>
          </div>
        </section>

        <section className="student-profile-card">
          <div className="profile-section-header">
            <div><h2>Profile changes</h2><p>Editing is not supported by the current account API.</p></div>
          </div>
          <p className="student-profile-unavailable">
            No changes can be saved here. Contact a CampusSphere administrator if your account details need correction.
          </p>
        </section>

        <section className="student-profile-card profile-logout-card">
          <div><h3>Sign out</h3><p>End your current student session.</p></div>
          <button className="profile-logout-btn" type="button" onClick={() => { signOut(); navigate("/login", { replace: true }); }}>
            <LogOut size={17} /> Logout
          </button>
        </section>
      </div>
    </div>
  );
}

export default StudentProfile;
