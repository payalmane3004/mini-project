import { useState } from "react";
import {
  ClipboardList,
  Plus,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wrench,
} from "lucide-react";

const initialRequests = [
  {
    id: "MR-001",
    title: "AC not working",
    location: "CSE-204",
    description: "Air conditioner is not cooling properly.",
    priority: "Medium",
    status: "In Progress",
    date: "02 Oct 2026",
  },
  {
    id: "MR-002",
    title: "Projector issue",
    location: "CSE-105",
    description: "Projector is not turning on.",
    priority: "Low",
    status: "Resolved",
    date: "28 Sep 2026",
  },
];

function StudentMaintenance() {
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    location: "",
    description: "",
    priority: "Medium",
  });

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    console.log("Maintenance request:", formData);

    setFormData({
      title: "",
      location: "",
      description: "",
      priority: "Medium",
    });

    setShowForm(false);
  };

  return (
    <div className="student-maintenance-page">
      <div className="student-page-header">
        <div>
          <p className="page-label">MAINTENANCE</p>
          <h1>Maintenance & Complaints</h1>
          <p>
            Report campus issues and track your maintenance requests.
          </p>
        </div>

        <button
          className="primary-student-button"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={18} />
          Report an Issue
        </button>
      </div>

      {showForm && (
        <section className="maintenance-form-card">
          <div className="student-panel-header">
            <div>
              <h2>Report a New Issue</h2>
              <p>Provide details about the problem.</p>
            </div>

            <Wrench size={20} />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="maintenance-form-grid">
              <div className="form-group">
                <label>Issue Title</label>

                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. AC not working"
                  required
                />
              </div>

              <div className="form-group">
                <label>Location</label>

                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g. CSE-204"
                  required
                />
              </div>

              <div className="form-group">
                <label>Priority</label>

                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div className="form-group full-width">
                <label>Description</label>

                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe the issue..."
                  rows="5"
                  required
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-student-button"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>

              <button type="submit" className="primary-student-button">
                Submit Request
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="maintenance-summary">
        <div className="maintenance-summary-card">
          <ClipboardList size={20} />
          <div>
            <span>Total Requests</span>
            <strong>{initialRequests.length}</strong>
          </div>
        </div>

        <div className="maintenance-summary-card">
          <Clock size={20} />
          <div>
            <span>In Progress</span>
            <strong>
              {
                initialRequests.filter(
                  (request) => request.status === "In Progress"
                ).length
              }
            </strong>
          </div>
        </div>

        <div className="maintenance-summary-card">
          <CheckCircle2 size={20} />
          <div>
            <span>Resolved</span>
            <strong>
              {
                initialRequests.filter(
                  (request) => request.status === "Resolved"
                ).length
              }
            </strong>
          </div>
        </div>
      </section>

      <section className="maintenance-requests">
        <div className="student-panel-header">
          <div>
            <h2>My Maintenance Requests</h2>
            <p>Track the issues you have reported.</p>
          </div>
        </div>

        <div className="maintenance-request-list">
          {initialRequests.map((request) => (
            <div className="maintenance-request-card" key={request.id}>
              <div className="maintenance-request-top">
                <div>
                  <span className="request-id">{request.id}</span>
                  <h3>{request.title}</h3>
                </div>

                <span
                  className={`request-status ${request.status
                    .toLowerCase()
                    .replace(" ", "-")}`}
                >
                  {request.status}
                </span>
              </div>

              <p>{request.description}</p>

              <div className="maintenance-request-meta">
                <span>
                  <MapPin size={15} />
                  {request.location}
                </span>

                <span>
                  <AlertCircle size={15} />
                  {request.priority}
                </span>

                <span>
                  <Clock size={15} />
                  {request.date}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default StudentMaintenance;