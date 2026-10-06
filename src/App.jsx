import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";
import StudentLayout from "./components/layout/StudentLayout";

import Login from "./pages/login";

// Admin pages
import Dashboard from "./pages/Admin/Dashboard";
import DigitalTwin from "./pages/Admin/DigitalTwin";
import Buildings from "./pages/Admin/Buildings";
import WorkspacePage from "./pages/Admin/WorkspacePage";
import Occupancy from "./pages/Admin/Occupancy";
import Energy from "./pages/Admin/Energy";
import Maintenance from "./pages/Admin/Maintenance";
import RoomBooking from "./pages/Admin/RoomBooking";
import Analytics from "./pages/Admin/Analytics";
import ScenarioLab from "./pages/Admin/ScenarioLab";
import Predictions from "./pages/Admin/Predictions";
import Alerts from "./pages/Admin/Alerts";
import SettingsPage from "./pages/Admin/SettingsPage";
import StudentBuildings from "./pages/Student/StudentBuildings";
import StudentRooms from "./pages/Student/StudentRooms";

// Student pages
import StudentDashboard from "./pages/Student/StudentDashboard";
import StudentMaintenance from "./pages/Student/StudentMaintenance";
import StudentBooking from "./pages/Student/StudentBooking";
import StudentEvents from "./pages/Student/StudentEvents";
import StudentEmergency from "./pages/Student/StudentEmergency";
import StudentProfile from "./pages/Student/StudentProfile";
import StudentMap from "./pages/Student/StudentMap";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login: no sidebar or topbar */}
        <Route path="/login" element={<Login />} />

        {/* Admin routes */}
        <Route
          path="/"
          element={
            <AppLayout>
              <Dashboard />
            </AppLayout>
          }
        />

        <Route
          path="/digital-twin"
          element={
            <AppLayout>
              <DigitalTwin />
            </AppLayout>
          }
        />

        <Route
          path="/buildings"
          element={
            <AppLayout>
              <Buildings />
            </AppLayout>
          }
        />

        <Route
          path="/rooms"
          element={
            <AppLayout>
              <WorkspacePage page="rooms" />
            </AppLayout>
          }
        />

        <Route
          path="/occupancy"
          element={
            <AppLayout>
              <Occupancy />
            </AppLayout>
          }
        />

        <Route
          path="/energy"
          element={
            <AppLayout>
              <Energy />
            </AppLayout>
          }
        />

        <Route
          path="/maintenance"
          element={
            <AppLayout>
              <Maintenance />
            </AppLayout>
          }
        />

        <Route
          path="/booking"
          element={
            <AppLayout>
              <RoomBooking />
            </AppLayout>
          }
        />

        <Route
          path="/emergency"
          element={
            <AppLayout>
              <WorkspacePage page="emergency" />
            </AppLayout>
          }
        />

        <Route
          path="/analytics"
          element={
            <AppLayout>
              <Analytics />
            </AppLayout>
          }
        />

        <Route
          path="/scenario-lab"
          element={
            <AppLayout>
              <ScenarioLab />
            </AppLayout>
          }
        />

        <Route
          path="/predictions"
          element={
            <AppLayout>
              <Predictions />
            </AppLayout>
          }
        />

        <Route
          path="/alerts"
          element={
            <AppLayout>
              <Alerts />
            </AppLayout>
          }
        />

        <Route
          path="/users"
          element={
            <AppLayout>
              <WorkspacePage page="users" />
            </AppLayout>
          }
        />

        <Route
          path="/settings"
          element={
            <AppLayout>
              <SettingsPage />
            </AppLayout>
          }
        />

        {/* Student routes */}
        <Route path="/student-dashboard" element={<StudentLayout><StudentDashboard /></StudentLayout>} />
        <Route path="/student-buildings" element={<StudentLayout><StudentBuildings /></StudentLayout>} />
        <Route path="/student-rooms" element={<StudentLayout><StudentRooms /></StudentLayout>} />
        <Route path="/student-booking" element={<StudentLayout><StudentBooking /></StudentLayout>} />
        <Route path="/student-maintenance" element={<StudentLayout><StudentMaintenance /></StudentLayout>} />
        <Route path="/student-events" element={<StudentLayout><StudentEvents /></StudentLayout>} />
        <Route path="/student-emergency" element={<StudentLayout><StudentEmergency /></StudentLayout>} />
        <Route path="/student-profile" element={<StudentLayout><StudentProfile /></StudentLayout>} />
        <Route path="/student-map" element={<StudentLayout><StudentMap /></StudentLayout>} />

        {/* Unknown route */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;