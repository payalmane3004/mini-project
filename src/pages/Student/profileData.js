export function getStudentProfileDetails(user) {
  const name = typeof user?.full_name === "string" ? user.full_name.trim() : "";
  const email = typeof user?.email === "string" ? user.email.trim() : "";

  return {
    name,
    email,
    role: user?.role === "student" ? "Student" : "Unavailable",
  };
}
