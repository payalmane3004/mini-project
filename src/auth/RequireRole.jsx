import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

const HOME_BY_ROLE = {
  admin: "/",
  student: "/student-dashboard",
};

export default function RequireRole({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.role !== role) {
    return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  }

  return children;
}
