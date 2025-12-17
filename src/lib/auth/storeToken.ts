import Cookie from "js-cookie";

export const storeToken = (token: string, username: string, role:string) => {
      Cookie.remove("token");
      Cookie.remove("username");
      Cookie.remove("role");
      const isProduction = process.env.NODE_ENV === "production";
      const isSecure = isProduction && window.location.protocol === "https:";
      Cookie.set("token", token, { expires: 1, secure: isSecure, sameSite: "Strict" });
      Cookie.set("username", username, { expires: 1, secure: isSecure, sameSite: "Strict" });
      Cookie.set("role", role, { expires: 1, secure: isSecure, sameSite: "Strict" });    
};
