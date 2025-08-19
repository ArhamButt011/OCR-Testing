"use client";

import { useState } from "react";

type ForgotPasswordModalProps = {
    onClose: () => void;
    openResetPasswordModal: () => void;
    setUserEmail: (email: string) => void;
};

function ForgotPasswordModal({ onClose, openResetPasswordModal, setUserEmail }: ForgotPasswordModalProps) {
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState(["", "", "", ""]);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [otpError, setOtpError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState(false);
    const [timer, setTimer] = useState(60);
    const [timerActive, setTimerActive] = useState(false);

    const handleChangeOtp = (index: number, value: string) => {
        if (/[^0-9]/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < otp.length - 1) {
            const nextInput = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
            nextInput?.focus();
        }
    };

    const handleBackspace = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Backspace" && !otp[index]) {
            const prevInput = document.getElementById(`otp-${index - 1}`) as HTMLInputElement;
            prevInput?.focus();
        }
    };

    const validateEmail = (email: string) => {
        const regex = /\S+@\S+\.\S+/;
        if (!email) return "Email is required.";
        if (!regex.test(email)) return "Please enter a valid email address.";
        return null;
    };

    const handleSendOtp = async () => {
        const emailError = validateEmail(email);
        if (emailError) {
            setEmailError(emailError);
            return;
        }

        setEmailError(null);
        setLoading(true);

        const res = await fetch("/api/auth/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });

        if (!res.ok) {
            const errorData = await res.json();
            const errorMessage = errorData?.message || "Failed to send OTP!";
            setEmailError(errorMessage);
            setLoading(false);
        } else {
            setUserEmail(email);
            setEmailError(null);
            setLoading(false);
            setSuccessMessage("OTP sent to your email!");
            setTimeout(() => setSuccessMessage(null), 10000); 
            startTimer();
        }
    };

    const startTimer = () => {
        setTimerActive(true);
        let countdown = 60;
        setTimer(countdown);

        const interval = setInterval(() => {
            if (countdown === 0) {
                clearInterval(interval);
                setTimerActive(false);
                setTimer(0);
            } else {
                setTimer(countdown);
                countdown -= 1;
            }
        }, 1000);
    };

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    };

    const validateOtp = (otp: string[]) => {
        if (otp.join("").length !== 4) return "OTP must be 4 digits.";
        return null;
    };

    const handleVerifyOtp = async () => {
        const otpError = validateOtp(otp);
        if (otpError) {
            setOtpError(otpError);
            return;
        }
        setLoadingText(true);

        setOtpError(null);

        const res = await fetch("/api/auth/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp: otp.join("") }),
        });

        if (!res.ok) {
            setOtpError("OTP verification failed!");
            setLoadingText(false);
        } else {
            setOtpError(null);
            setUserEmail(email);
            setLoadingText(false);
            setSuccessMessage("OTP verified successfully!");
            setTimeout(() => setSuccessMessage(null), 20000);
            openResetPasswordModal();
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
                <h1 className="text-2xl font-bold text-center mb-3 text-black">Forgot Password</h1>
                <p className="text-sm text-gray-500 text-center mb-6">
                    Please enter your email address to verify your account
                </p>
                <form>
                    <label className="block text-black font-semibold">Email Address</label>
                    <input
                        type="email"
                        placeholder="Enter your Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 mt-1 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                        required
                    />
                    {emailError && <p className="text-red-500 text-sm mt-1">{emailError}</p>}
                    {successMessage && (
                        <p className="text-green-500 text-sm mt-1">{successMessage}</p>
                    )}
                    <div className="flex justify-end items-center mb-16 mt-2">
                        <button
                            type="button"
                            onClick={handleSendOtp}
                            className="text-[#005B97] underline"
                            disabled={loading || timerActive}
                        >
                            {loading || timerActive ? (
                                <span>{formatTime(timer)}</span>
                            ) : (
                                "Send OTP"
                            )}
                        </button>
                    </div>
                    <div className="flex justify-evenly mb-6">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                id={`otp-${index}`}
                                type="text"
                                maxLength={1}
                                className="text-xl font-medium w-12 h-12 text-center border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                                value={digit}
                                onChange={(e) => handleChangeOtp(index, e.target.value)}
                                onKeyDown={(e) => handleBackspace(index, e)}
                            />
                        ))}
                    </div>
                    {otpError && <p className="text-red-500 text-sm my-1">{otpError}</p>}
                    <button
                        type="button"
                        onClick={handleVerifyOtp}
                        className="w-full bg-[#005B97] text-white py-2 rounded-md" disabled={loadingText}
                    >
                        {loadingText ? "Verifying..." : "Verify"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ForgotPasswordModal;
