import { BrowserRouter, Routes, Route } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import DigitalTwin from "./pages/DigitalTwin";
import Buildings from "./pages/Buildings";


function App() {
  return (
    <BrowserRouter>
      <AppLayout>

        <Routes>
          <Route path="/" element={<Dashboard />} />

          <Route path="/digital-twin" element={<DigitalTwin />} />

        <Route path="/buildings" element={<Buildings />} />

          <Route
            path="/rooms"
            element={<div>Floors & Rooms</div>}
          />

          <Route
            path="/occupancy"
            element={<div>Occupancy</div>}
          />

          <Route
            path="/energy"
            element={<div>Energy</div>}
          />

          <Route
            path="/maintenance"
            element={<div>Maintenance</div>}
          />

          <Route
            path="/booking"
            element={<div>Room Booking</div>}
          />

          <Route
            path="/emergency"
            element={<div>Emergency</div>}
          />

          <Route
            path="/analytics"
            element={<div>Analytics</div>}
          />

          <Route
            path="/predictions"
            element={<div>Predictions</div>}
          />

          <Route
            path="/alerts"
            element={<div>Alerts</div>}
          />

        </Routes>

      </AppLayout>
    </BrowserRouter>
  );
}

export default App;