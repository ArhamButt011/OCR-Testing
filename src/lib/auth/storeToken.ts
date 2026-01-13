export const storeToken = (username: string, role: string, token: string) => {
  if (typeof window === "undefined") return;

  localStorage.setItem("username", username);
  localStorage.setItem("role", role);
  localStorage.setItem("token", token);
};
