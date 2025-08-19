import Cookie from "js-cookie";

export const storeToken = (token: string, username: string, role:string) => {
  // Remove any previous token and username
  Cookie.remove("token");
  Cookie.remove("username");

  // Set new token and username in cookies
  Cookie.set("token", token, { expires: 1, secure: true, sameSite: "Strict" });
  Cookie.set("username", username, { expires: 1, secure: true, sameSite: "Strict" });
  Cookie.set("role", role, { expires: 1, secure: true, sameSite: "Strict" });

};
