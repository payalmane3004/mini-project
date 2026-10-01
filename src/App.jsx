import { BrowserRouter, Routes, Route } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import DigitalTwin from "./pages/DigitalTwin";
import Buildings from "./pages/Buildings";
import WorkspacePage from "./pages/WorkspacePage";
import Occupancy from "./pages/Occupancy";
import Energy from "./pages/Energy";
import Maintenance from "./pages/Maintenance";
import RoomBooking from "./pages/RoomBooking";
import Analytics from "./pages/Analytics";
import ScenarioLab from "./pages/ScenarioLab";
import Predictions from "./pages/Predictions";
import Alerts from "./pages/Alerts";
import SettingsPage from "./pages/SettingsPage";


function App() {
  return (
    <BrowserRouter>
      <AppLayout>

        <Routes>
          <Route path="/" element={<Dashboard />} />

          <Route path="/digital-twin" element={<DigitalTwin />} />

        <Route path="/buildings" element={<Buildings />} />

          <Route path="/rooms" element={<WorkspacePage page="rooms" />} />
          <Route path="/occupancy" element={<Occupancy />} />
          <Route path="/energy" element={<Energy />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/booking" element={<RoomBooking />} />
          <Route path="/emergency" element={<WorkspacePage page="emergency" />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/scenario-lab" element={<ScenarioLab />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/users" element={<WorkspacePage page="users" />} />
          <Route path="/settings" element={<SettingsPage />} />

        </Routes>

      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
