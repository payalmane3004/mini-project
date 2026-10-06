import { useState } from "react";
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  Hash,
  Building2,
  CalendarDays,
  Lock,
  Bell,
  LogOut,
  Edit3,
  Save,
} from "lucide-react";

function StudentProfile() {
  const [editing, setEditing] = useState(false);

  const [profile, setProfile] = useState({
    name: "Rahul Patil",
    rollNo: "CSE2023001",
    department: "Computer Science & Engineering",
    year: "Third Year",
    email: "rahul.patil@college.edu",
    phone: "+91 98765 43210",
    batch: "2023 - 2027",
  });

  const handleChange = (e) => {
    setProfile({
      ...profile,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = () => {
    setEditing(false);
    console.log("Profile updated:", profile);
  };

  return (
    <div className="student-profile-page">

      {/* Header */}
      <div className="student-page-header">
        <div>
          <h1>My Profile</h1>
          <p>View and manage your student information.</p>
        </div>

        {!editing ? (
          <button
            className="student-primary-btn"
            onClick={() => setEditing(true)}
          >
            <Edit3 size={17} />
            Edit Profile
          </button>
        ) : (
          <button
            className="student-primary-btn"
            onClick={handleSave}
          >
            <Save size={17} />
            Save Changes
          </button>
        )}
      </div>

      <div className="student-profile-layout">

        {/* Profile Card */}
        <div className="student-profile-card profile-main-card">
          <div className="profile-avatar">
            <User size={42} />
          </div>

          <h2>{profile.name}</h2>
          <span className="profile-role">Student</span>

          <div className="profile-id">
            <Hash size={15} />
            {profile.rollNo}
          </div>

          <div className="profile-divider" />

          <div className="profile-quick-info">
            <div>
              <Building2 size={17} />
              <span>{profile.department}</span>
            </div>

            <div>
              <GraduationCap size={17} />
              <span>{profile.year}</span>
            </div>

            <div>
              <CalendarDays size={17} />
              <span>Batch {profile.batch}</span>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="student-profile-card">
          <div className="profile-section-header">
            <div>
              <h2>Personal Information</h2>
              <p>Your basic contact information.</p>
            </div>
          </div>

          <div className="profile-form-grid">

            <div className="profile-field">
              <label>Full Name</label>
              <div className="profile-input-wrapper">
                <User size={17} />
                <input
                  type="text"
                  name="name"
                  value={profile.name}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>
            </div>

            <div className="profile-field">
              <label>Roll Number</label>
              <div className="profile-input-wrapper">
                <Hash size={17} />
                <input
                  type="text"
                  value={profile.rollNo}
                  disabled
                />
              </div>
            </div>

            <div className="profile-field">
              <label>Email</label>
              <div className="profile-input-wrapper">
                <Mail size={17} />
                <input
                  type="email"
                  name="email"
                  value={profile.email}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>
            </div>

            <div className="profile-field">
              <label>Phone Number</label>
              <div className="profile-input-wrapper">
                <Phone size={17} />
                <input
                  type="tel"
                  name="phone"
                  value={profile.phone}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Academic Information */}
        <div className="student-profile-card">
          <div className="profile-section-header">
            <div>
              <h2>Academic Information</h2>
              <p>Your academic details.</p>
            </div>
          </div>

          <div className="academic-info-grid">

            <div className="academic-info-item">
              <span>Department</span>
              <strong>{profile.department}</strong>
            </div>

            <div className="academic-info-item">
              <span>Current Year</span>
              <strong>{profile.year}</strong>
            </div>

            <div className="academic-info-item">
              <span>Batch</span>
              <strong>{profile.batch}</strong>
            </div>

            <div className="academic-info-item">
              <span>Student Status</span>
              <strong className="active-text">Active</strong>
            </div>

          </div>
        </div>

        {/* Account Settings */}
        <div className="student-profile-card">
          <div className="profile-section-header">
            <div>
              <h2>Account & Preferences</h2>
              <p>Manage account-related settings.</p>
            </div>
          </div>

          <div className="profile-settings-list">

            <button className="profile-setting-item">
              <div className="profile-setting-icon">
                <Lock size={18} />
              </div>

              <div>
                <strong>Change Password</strong>
                <span>Update your account password</span>
              </div>

              <span className="setting-arrow">›</span>
            </button>

            <button className="profile-setting-item">
              <div className="profile-setting-icon">
                <Bell size={18} />
              </div>

              <div>
                <strong>Notification Preferences</strong>
                <span>Manage alerts and campus notifications</span>
              </div>

              <span className="setting-arrow">›</span>
            </button>

          </div>
        </div>

        {/* Logout */}
        <div className="student-profile-card profile-logout-card">
          <div>
            <h3>Sign out</h3>
            <p>End your current student session.</p>
          </div>

          <button
            className="profile-logout-btn"
            onClick={() => {
              window.location.href = "/login";
            }}
          >
            <LogOut size={17} />
            Logout
          </button>
        </div>

      </div>
    </div>
  );
}

export default StudentProfile;