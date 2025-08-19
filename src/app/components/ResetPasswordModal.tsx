"use client";

import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";

type ResetPasswordModalProps = {
    onClose: () => void;
    userEmail: string | null;
};

function ResetPasswordModal({ onClose, userEmail }: ResetPasswordModalProps) {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const validatePasswords = () => {
        if (!password || !confirmPassword) return "Both fields are required.";
        if (password !== confirmPassword) return "Passwords do not match.";
        return null;
    };

    const handleResetPassword = async () => {
        const error = validatePasswords();
        if (error) {
            setError(error);
            return;
        }

        if (!userEmail) {
            setError("No email provided. Please try again.");
            return;
        }

        setLoading(true);
        setError(null);

        const res = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: userEmail, password }),
        });

        if (!res.ok) {
            const errorData = await res.json();
            const errorMessage = errorData?.message || "Failed to reset password!";
            setError(errorMessage);
            setLoading(false);
        } else {
            setSuccessMessage("Password reset successfully!"); 
            setLoading(false);
            setTimeout(() => {
                setSuccessMessage(null); 
                onClose(); 
            }, 10000); 
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
            <div className="w-full max-w-sm bg-white rounded-sm p-6 mx-5 relative">
                <button
                    onClick={onClose}
                    className="absolute top-7 right-2 font-bold text-white bg-[#005B97] rounded-full px-[7px] py-0"
                >
                    &times;
                </button>
                <h1 className="text-2xl font-bold text-center mb-3 text-black">Reset Password</h1>
                <p className="text-sm text-gray-500 text-center mb-10">
                    Please enter your new password. It should meet our security requirements.
                </p>

                {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
                {successMessage && <p className="text-green-500 text-sm mb-4 text-center">{successMessage}</p>}

                <form>
                    <label className="block text-black font-semibold">New Password</label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter new password"
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
                            {showPassword ? <FaEye size={20} className="text-[#005B97]" /> : <FaEyeSlash size={20} className="text-[#005B97]" />}
                        </button>
                    </div>
                    <label className="block text-black font-semibold mt-4">Confirm New Password</label>
                    <div className="relative">
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Re-Enter New Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute inset-y-0 right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                        >
                            {showConfirmPassword ? <FaEye size={20} className="text-[#005B97]" /> : <FaEyeSlash size={20} className="text-[#005B97]" />}
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleResetPassword}
                        className="w-full bg-[#005B97] text-white py-2 mt-16 rounded-md" disabled={loading}
                    >
                        {loading ? "Resetting..." : "Reset Password"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ResetPasswordModal;
