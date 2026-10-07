import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";
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
import Login from "./pages/Login";
import StudentPortal from "./pages/StudentPortal";

function RoleGate({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace/>;
  if (user.role !== role) return <Navigate to={user.role === "ADMIN" ? "/" : "/student"} replace/>;
  return children;
}

function AdminRoutes() {
  return <Routes>
    <Route path="/" element={<Dashboard/>}/>
    <Route path="/digital-twin" element={<DigitalTwin/>}/>
    <Route path="/buildings" element={<Buildings/>}/>
    <Route path="/rooms" element={<WorkspacePage page="rooms"/>}/>
    <Route path="/occupancy" element={<Occupancy/>}/>
    <Route path="/energy" element={<Energy/>}/>
    <Route path="/maintenance" element={<Maintenance/>}/>
    <Route path="/booking" element={<RoomBooking/>}/>
    <Route path="/emergency" element={<WorkspacePage page="emergency"/>}/>
    <Route path="/analytics" element={<Analytics/>}/>
    <Route path="/scenario-lab" element={<ScenarioLab/>}/>
    <Route path="/predictions" element={<Predictions/>}/>
    <Route path="/alerts" element={<Alerts/>}/>
    <Route path="/users" element={<WorkspacePage page="users"/>}/>
    <Route path="/settings" element={<SettingsPage/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}

function AppRoutes() {
  const { user } = useAuth();
  return <Routes>
    <Route path="/login" element={<Login/>}/>
    <Route path="/student/*" element={<RoleGate role="STUDENT"><StudentPortal/></RoleGate>}/>
    <Route path="/*" element={<RoleGate role="ADMIN"><AppLayout><AdminRoutes/></AppLayout></RoleGate>}/>
    <Route path="*" element={<Navigate to={user ? (user.role === "ADMIN" ? "/" : "/student") : "/login"} replace/>}/>
  </Routes>;
}

function App() {
  return <AuthProvider><BrowserRouter><AppRoutes/></BrowserRouter></AuthProvider>;
}

export default App;
