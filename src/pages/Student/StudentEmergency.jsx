import { useState } from "react";
import {
  AlertTriangle,
  Ambulance,
  Flame,
  ShieldAlert,
  Phone,
  MapPin,
  Send,
  CheckCircle2,
  X,
} from "lucide-react";

const emergencyContacts = [
  {
    name: "Campus Security",
    number: "020-0000-1001",
    description: "24/7 campus security assistance",
    icon: ShieldAlert,
  },
  {
    name: "Medical Center",
    number: "020-0000-1002",
    description: "Medical assistance and first aid",
    icon: Ambulance,
  },
  {
    name: "Fire & Rescue",
    number: "101",
    description: "Fire and rescue emergency",
    icon: Flame,
  },
  {
    name: "Emergency Services",
    number: "112",
    description: "National emergency number",
    icon: Phone,
  },
];

function StudentEmergency() {
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [incident, setIncident] = useState({
    type: "Safety Issue",
    location: "",
    description: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;

    setIncident((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!incident.location || !incident.description.trim()) {
      return;
    }

    console.log("Emergency incident:", incident);

    setSubmitted(true);

    setIncident({
      type: "Safety Issue",
      location: "",
      description: "",
    });
  };

  return (
    <div className="student-emergency-page">
      <div className="student-page-header">
        <div>
          <h1>Emergency & Safety</h1>
          <p>
            Get immediate help and access important campus safety resources.
          </p>
        </div>
      </div>

      {/* Emergency Banner */}
      <section className="emergency-banner">
        <div className="emergency-banner-icon">
          <AlertTriangle size={26} />
        </div>

        <div>
          <span>Emergency Assistance</span>
          <h2>Need immediate help?</h2>
          <p>
            Contact campus security or emergency services using the
            options below.
          </p>
        </div>

        <a
          className="emergency-call-button"
          href="tel:112"
        >
          <Phone size={17} />
          Call 112
        </a>
      </section>

      {/* Quick Actions */}
      <section>
        <div className="emergency-section-heading">
          <div>
            <h2>Quick Emergency Actions</h2>
            <p>Choose the appropriate service for your situation.</p>
          </div>
        </div>

        <div className="emergency-actions-grid">
          <a
            href="tel:02000001001"
            className="emergency-action-card security"
          >
            <div className="emergency-action-icon">
              <ShieldAlert size={23} />
            </div>

            <div>
              <h3>Campus Security</h3>
              <p>Security or safety-related emergency</p>
              <strong>Call Security</strong>
            </div>
          </a>

          <a
            href="tel:02000001002"
            className="emergency-action-card medical"
          >
            <div className="emergency-action-icon">
              <Ambulance size={23} />
            </div>

            <div>
              <h3>Medical Emergency</h3>
              <p>Injury, illness or medical assistance</p>
              <strong>Call Medical Center</strong>
            </div>
          </a>

          <a
            href="tel:101"
            className="emergency-action-card fire"
          >
            <div className="emergency-action-icon">
              <Flame size={23} />
            </div>

            <div>
              <h3>Fire Emergency</h3>
              <p>Fire, smoke or evacuation situation</p>
              <strong>Call Fire & Rescue</strong>
            </div>
          </a>

          <button
            className="emergency-action-card report"
            onClick={() => setShowIncidentForm(true)}
          >
            <div className="emergency-action-icon">
              <AlertTriangle size={23} />
            </div>

            <div>
              <h3>Report an Incident</h3>
              <p>Report a safety issue on campus</p>
              <strong>Submit Report</strong>
            </div>
          </button>
        </div>
      </section>

      {/* Emergency Contacts */}
      <section className="emergency-contacts-section">
        <div className="emergency-section-heading">
          <div>
            <h2>Emergency Contacts</h2>
            <p>Important numbers for campus and external emergencies.</p>
          </div>
        </div>

        <div className="emergency-contacts-grid">
          {emergencyContacts.map((contact) => {
            const Icon = contact.icon;

            return (
              <div className="emergency-contact-card" key={contact.name}>
                <div className="contact-icon">
                  <Icon size={19} />
                </div>

                <div className="contact-info">
                  <h3>{contact.name}</h3>
                  <p>{contact.description}</p>
                  <strong>{contact.number}</strong>
                </div>

                <a
                  href={`tel:${contact.number.replace(/-/g, "")}`}
                  className="contact-call-button"
                  aria-label={`Call ${contact.name}`}
                >
                  <Phone size={15} />
                </a>
              </div>
            );
          })}
        </div>
      </section>

      {/* Safety Information */}
      <section className="safety-information">
        <div className="emergency-section-heading">
          <div>
            <h2>Campus Safety Information</h2>
            <p>Keep these guidelines in mind during an emergency.</p>
          </div>
        </div>

        <div className="safety-grid">
          <div className="safety-card">
            <div className="safety-number">01</div>
            <div>
              <h3>Stay Calm</h3>
              <p>
                Stay calm and follow instructions from campus security
                or emergency personnel.
              </p>
            </div>
          </div>

          <div className="safety-card">
            <div className="safety-number">02</div>
            <div>
              <h3>Move to Safety</h3>
              <p>
                Move away from dangerous areas and use marked emergency
                exits when required.
              </p>
            </div>
          </div>

          <div className="safety-card">
            <div className="safety-number">03</div>
            <div>
              <h3>Share Your Location</h3>
              <p>
                Tell emergency personnel the building, floor and room
                where assistance is required.
              </p>
            </div>
          </div>

          <div className="safety-card">
            <div className="safety-number">04</div>
            <div>
              <h3>Don't Take Risks</h3>
              <p>
                Do not return to an evacuated building until authorities
                declare it safe.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Incident Modal */}
      {showIncidentForm && (
        <div
          className="emergency-modal-overlay"
          onClick={() => setShowIncidentForm(false)}
        >
          <div
            className="emergency-modal"
            onClick={(event) => event.stopPropagation()}
          >
            {!submitted ? (
              <>
                <div className="emergency-modal-header">
                  <div>
                    <span>Safety Report</span>
                    <h2>Report an Incident</h2>
                  </div>

                  <button
                    onClick={() => setShowIncidentForm(false)}
                    className="emergency-modal-close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form
                  className="incident-form"
                  onSubmit={handleSubmit}
                >
                  <div className="incident-field">
                    <label>Incident Type</label>

                    <select
                      name="type"
                      value={incident.type}
                      onChange={handleChange}
                    >
                      <option>Safety Issue</option>
                      <option>Medical Emergency</option>
                      <option>Fire Hazard</option>
                      <option>Security Concern</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div className="incident-field">
                    <label>Location</label>

                    <div className="incident-input-icon">
                      <MapPin size={16} />

                      <input
                        name="location"
                        value={incident.location}
                        onChange={handleChange}
                        placeholder="Building, floor or room"
                      />
                    </div>
                  </div>

                  <div className="incident-field">
                    <label>Description</label>

                    <textarea
                      name="description"
                      value={incident.description}
                      onChange={handleChange}
                      rows="5"
                      placeholder="Describe what happened..."
                    />
                  </div>

                  <button
                    className="incident-submit-button"
                    type="submit"
                  >
                    <Send size={16} />
                    Submit Incident Report
                  </button>
                </form>
              </>
            ) : (
              <div className="incident-success">
                <div className="incident-success-icon">
                  <CheckCircle2 size={30} />
                </div>

                <h2>Report Submitted</h2>

                <p>
                  Your incident report has been recorded. Campus
                  authorities can review it and take appropriate action.
                </p>

                <button
                  onClick={() => {
                    setSubmitted(false);
                    setShowIncidentForm(false);
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentEmergency;