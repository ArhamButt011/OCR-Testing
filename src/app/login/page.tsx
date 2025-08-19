"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import Image from "next/image";
import Link from "next/link";
import ForgotPasswordModal from "../components/ForgotPasswordModal";
import ResetPasswordModal from "../components/ResetPasswordModal";
import Router from "next/router";
import { storeToken } from "@/lib/auth/storeToken";


export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isForgotPasswordVisible, setIsForgotPasswordVisible] = useState(false);
  const [isResetPasswordVisible, setIsResetPasswordVisible] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const router = useRouter();

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password}),
      });

      const data = await res.json();


      if (!res.ok) {
          throw new Error(data.message);
      }
  
      localStorage.removeItem("token");
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.name);

      storeToken(data.token, data.name, data.role);

      router.push("/extracted-data-monitoring");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
      setLoading(false);
    } finally {
      Router.events.on("routeChangeComplete", () => setLoading(false));
    }
  }, [email, password, router]);

  useEffect(() => {
    return () => {
      Router.events.off("routeChangeComplete", () => setLoading(false));
    };
  }, []);


  const openForgotPasswordModal = () => setIsForgotPasswordVisible(true);
  const closeForgotPasswordModal = () => setIsForgotPasswordVisible(false);

  const openResetPasswordModal = () => {
    setIsForgotPasswordVisible(false);
    setIsResetPasswordVisible(true);
  };
  const closeResetPasswordModal = () => setIsResetPasswordVisible(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[url('/images/bg.jpg')] bg-cover bg-center">
      <div className="w-full max-w-md bg-white rounded-sm shadow-lg p-6 mx-5">
        <div className="flex justify-center items-center my-3">
          <Image
            src="/images/logo.svg"
            alt="logo"
            width={200}
            height={200}
            priority
            style={{ width: "auto", height: "auto" }}
          />
        </div>
        <h1 className="text-2xl font-bold text-center mb-4 text-black">Sign In</h1>
        <p className="text-center text-gray-500 mb-6">
          Sign in with your email and password to continue to MPG OCR
        </p>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        {loading && (
          <p className="text-center text-blue-500 font-medium mb-4">
            Processing your login, please wait...
          </p>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-black font-semibold">Email Address</label>
            <input
              type="email"
              placeholder="Enter your Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 mt-1 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
              required
            />
          </div>

          <div className="mb-2 relative">
            <label className="block text-black font-semibold">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
              >
                {showPassword ? (
                  <FaEye size={20} className="text-[#005B97]" />
                ) : (
                  <FaEyeSlash size={20} className="text-[#005B97]" />
                )}
              </button>
            </div>
          </div>
          <div className="flex justify-end items-center mb-10 mt-0">
            <p className="font-medium mt-0">
              <a
                onClick={openForgotPasswordModal}
                className="text-[#005B97] cursor-pointer hover:underline"
              >
                Forgot Password?
              </a>
            </p>
          </div>

          <button
            type="submit"
            className={`w-full bg-[#005B97] text-white py-2 px-4 font-bold rounded-md hover:bg-[#005b97f0] transition duration-300 ${loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            disabled={loading}
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-black font-medium">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#005B97] hover:underline">
            Register
          </Link>
        </p>
      </div>
      {isForgotPasswordVisible && (
        <ForgotPasswordModal
          onClose={closeForgotPasswordModal}
          openResetPasswordModal={openResetPasswordModal}
          setUserEmail={setUserEmail}
        />
      )}
      {isResetPasswordVisible && (
        <ResetPasswordModal onClose={closeResetPasswordModal} userEmail={userEmail} />
      )}
    </div>
  );
}
