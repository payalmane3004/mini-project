export function readLoginCredentials(formData) {
  const email = formData.get("email");
  const password = formData.get("password");

  return {
    email: typeof email === "string" ? email : "",
    password: typeof password === "string" ? password : "",
  };
}
