import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";
import StudentLayout from "./components/layout/StudentLayout";

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

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<main className="route-loading" role="status">Loading page…</main>}>
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

        {/* Standalone interior study; intentionally absent from the sidebar. */}
        <Route
          path="/building-explorer/:buildingId"
          element={<AppLayout><BuildingExplorer /></AppLayout>}
        />

        <Route
          path="/main-building-interior"
          element={
            <AppLayout>
              <MainBuildingInteriorPrototype />
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
              <Rooms />
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
