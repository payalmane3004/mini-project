import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";
import StudentLayout from "./components/layout/StudentLayout";
import { AuthProvider } from "./auth/AuthContext";
import RequireRole from "./auth/RequireRole";

const Login = lazy(() => import("./pages/login"));
const Dashboard = lazy(() => import("./pages/Admin/Dashboard"));
const DigitalTwin = lazy(() => import("./pages/Admin/DigitalTwin"));
const Buildings = lazy(() => import("./pages/Admin/Buildings"));
const WorkspacePage = lazy(() => import("./pages/Admin/WorkspacePage"));
const Occupancy = lazy(() => import("./pages/Admin/Occupancy"));
const Energy = lazy(() => import("./pages/Admin/Energy"));
const Maintenance = lazy(() => import("./pages/Admin/Maintenance"));
const RoomBooking = lazy(() => import("./pages/Admin/RoomBooking"));
const Analytics = lazy(() => import("./pages/Admin/Analytics"));
const ScenarioLab = lazy(() => import("./pages/Admin/ScenarioLab"));
const Predictions = lazy(() => import("./pages/Admin/Predictions"));
const Alerts = lazy(() => import("./pages/Admin/Alerts"));
const SettingsPage = lazy(() => import("./pages/Admin/SettingsPage"));
const StudentBuildings = lazy(() => import("./pages/Student/StudentBuildings"));
const StudentRooms = lazy(() => import("./pages/Student/StudentRooms"));
const MainBuildingInteriorPrototype = lazy(() => import("./pages/Admin/MainBuildingInteriorPrototype"));
const BuildingExplorer = lazy(() => import("./pages/Admin/BuildingExplorer"));
const Rooms = lazy(() => import("./pages/Admin/Rooms"));
const StudentDashboard = lazy(() => import("./pages/Student/StudentDashboard"));
const StudentMaintenance = lazy(() => import("./pages/Student/StudentMaintenance"));
const StudentBooking = lazy(() => import("./pages/Student/StudentBooking"));
const StudentEvents = lazy(() => import("./pages/Student/StudentEvents"));
const StudentEmergency = lazy(() => import("./pages/Student/StudentEmergency"));
const StudentProfile = lazy(() => import("./pages/Student/StudentProfile"));
const StudentMap = lazy(() => import("./pages/Student/StudentMap"));
const StudentDigitalTwin = lazy(() => import("./pages/Student/StudentDigitalTwin"));

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <Suspense fallback={<main className="route-loading" role="status">Loading page…</main>}>
      <Routes>
        {/* Login: no sidebar or topbar */}
        <Route path="/login" element={<Login />} />

        {/* Admin routes */}
        <Route
          path="/"
          element={
            <RequireRole role="admin"><AppLayout><Dashboard /></AppLayout></RequireRole>
          }
        />

        <Route
          path="/digital-twin"
          element={
            <RequireRole role="admin"><AppLayout><DigitalTwin /></AppLayout></RequireRole>
          }
        />

        {/* Standalone interior study; intentionally absent from the sidebar. */}
        <Route
          path="/building-explorer/:buildingId"
          element={<RequireRole role="admin"><AppLayout><BuildingExplorer /></AppLayout></RequireRole>}
        />

        <Route
          path="/main-building-interior"
          element={
            <RequireRole role="admin"><AppLayout><MainBuildingInteriorPrototype /></AppLayout></RequireRole>
          }
        />

        <Route
          path="/buildings"
          element={
            <RequireRole role="admin"><AppLayout><Buildings /></AppLayout></RequireRole>
          }
        />

        <Route
          path="/rooms"
          element={
            <RequireRole role="admin"><AppLayout><Rooms /></AppLayout></RequireRole>
          }
        />

        <Route
          path="/occupancy"
          element={
            <RequireRole role="admin"><AppLayout><Occupancy /></AppLayout></RequireRole>
          }
        />

        <Route
          path="/energy"
          element={
            <RequireRole role="admin"><AppLayout><Energy /></AppLayout></RequireRole>
          }
        />

        <Route
          path="/maintenance"
          element={
            <RequireRole role="admin"><AppLayout><Maintenance /></AppLayout></RequireRole>
          }
        />

        <Route
          path="/booking"
          element={
            <RequireRole role="admin"><AppLayout><RoomBooking /></AppLayout></RequireRole>
          }
        />

        <Route
          path="/emergency"
          element={
            <RequireRole role="admin"><AppLayout><WorkspacePage page="emergency" /></AppLayout></RequireRole>
          }
        />

        <Route
          path="/analytics"
          element={
            <RequireRole role="admin"><AppLayout><Analytics /></AppLayout></RequireRole>
          }
        />

        <Route
          path="/scenario-lab"
          element={
            <RequireRole role="admin"><AppLayout><ScenarioLab /></AppLayout></RequireRole>
          }
        />

        <Route
          path="/predictions"
          element={
            <RequireRole role="admin"><AppLayout><Predictions /></AppLayout></RequireRole>
          }
        />

        <Route
          path="/alerts"
          element={
            <RequireRole role="admin"><AppLayout><Alerts /></AppLayout></RequireRole>
          }
        />

        <Route
          path="/users"
          element={
            <RequireRole role="admin"><AppLayout><WorkspacePage page="users" /></AppLayout></RequireRole>
          }
        />

        <Route
          path="/settings"
          element={
            <RequireRole role="admin"><AppLayout><SettingsPage /></AppLayout></RequireRole>
          }
        />

        {/* Student routes */}
        <Route path="/student-dashboard" element={<RequireRole role="student"><StudentLayout><StudentDashboard /></StudentLayout></RequireRole>} />
        <Route path="/student-digital-twin" element={<RequireRole role="student"><StudentLayout><StudentDigitalTwin /></StudentLayout></RequireRole>} />
        <Route path="/student-buildings" element={<RequireRole role="student"><StudentLayout><StudentBuildings /></StudentLayout></RequireRole>} />
        <Route path="/student-rooms" element={<RequireRole role="student"><StudentLayout><StudentRooms /></StudentLayout></RequireRole>} />
        <Route path="/student-booking" element={<RequireRole role="student"><StudentLayout><StudentBooking /></StudentLayout></RequireRole>} />
        <Route path="/student-maintenance" element={<RequireRole role="student"><StudentLayout><StudentMaintenance /></StudentLayout></RequireRole>} />
        <Route path="/student-events" element={<RequireRole role="student"><StudentLayout><StudentEvents /></StudentLayout></RequireRole>} />
        <Route path="/student-emergency" element={<RequireRole role="student"><StudentLayout><StudentEmergency /></StudentLayout></RequireRole>} />
        <Route path="/student-profile" element={<RequireRole role="student"><StudentLayout><StudentProfile /></StudentLayout></RequireRole>} />
        <Route path="/student-map" element={<RequireRole role="student"><StudentLayout><StudentMap /></StudentLayout></RequireRole>} />

        {/* Unknown route */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
