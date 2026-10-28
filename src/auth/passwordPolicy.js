export function passwordPolicyError(password) {
  const categories = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)];
  if (password.length < 12 || categories.filter(Boolean).length < 3) {
    return "Use at least 12 characters and include at least three of: lowercase, uppercase, number, symbol.";
  }
  return "";
}

export function validateNewPassword(password, confirmation) {
  if (password !== confirmation) return "Passwords do not match.";
  return passwordPolicyError(password);
}
