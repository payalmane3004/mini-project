import { Building2, Map, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import "./StudentMap.css";

function StudentMap() {
  return (
    <div className="student-map-page">
      <div className="student-page-header">
        <div>
          <h1>Campus Map</h1>
          <p>Campus navigation requires verified building locations.</p>
        </div>
      </div>

      <section className="student-panel student-map-unavailable" role="status">
        <MapPin size={32} aria-hidden="true" />
        <h2>Verified map locations are unavailable</h2>
        <p>
          CampusSphere does not have verified geographic coordinates for its database building records.
          The previous schematic used sample markers and counts, so it has been removed rather than shown as a campus map.
        </p>
        <nav className="student-map-links" aria-label="Campus references">
          <Link className="student-explore-button" to="/student-digital-twin"><Map size={17} /> Open CAD Digital Twin</Link>
          <Link className="student-explore-button" to="/student-buildings"><Building2 size={17} /> Browse building records</Link>
        </nav>
      </section>
    </div>
  );
}

export default StudentMap;
