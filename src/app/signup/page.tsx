"use client";

import { useState, useEffect } from "react";
import { FaEye, FaEyeSlash, FaChevronDown } from "react-icons/fa";
import Link from "next/link";
import Image from "next/image";


export default function SignupPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [role, setRole] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);


    const handleSelect = (value: string) => {
        setRole(value);
        setIsOpen(false);
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        if (password !== confirmPassword) {
            setError("Passwords do not match!");
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, role }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message);
            }

            setName('');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setShowPassword(false);
            setRole(role);
            setShowConfirmPassword(false);
            setShowModal(true);

        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("An unexpected error occurred");
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                setShowModal(false);
                setRole("");
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-[url('/images/bg.jpg')] bg-cover bg-center">
            <div className="w-full max-w-md bg-white rounded-sm shadow-lg p-6 mx-5 my-5">
                <h1 className="text-2xl font-bold text-center mb-4 text-black">Register</h1>
                <p className="text-center text-gray-500 mb-6">
                    Add your account basic details to create an Account on MPG OCR
                </p>
                {error && <p className="text-red-500 text-center mb-4">{error}</p>}
                {isLoading && (
                    <p className="text-blue-500 text-center mb-4">Processing your request...</p>
                )}
                <form onSubmit={handleSignup}>
                    <div className="mb-4">
                        <label className="block text-black font-semibold">Name</label>
                        <input
                            type="text"
                            placeholder="Enter your Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 mt-1 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                            required
                        />
                    </div>
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

                    <div className="mb-4 relative">
                        <label className="block text-black font-semibold">Role</label>
                        <div
                            className="w-full px-4 py-2 mt-1 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] pr-10 cursor-pointer"
                            onClick={() => setIsOpen(!isOpen)}
                        >
                            {role || "Select Your Role"}
                            <span className="absolute inset-y-0 right-3 top-3/4 transform -translate-y-1/2 text-[#005B97]">
                                <FaChevronDown size={20} />
                            </span>
                        </div>

                        {isOpen && (
                            <div className="absolute left-0 right-0 mt-1 bg-white shadow-lg rounded-md z-10">
                                <div
                                    onClick={() => handleSelect("Reviewer")}
                                    className="px-4 py-2 cursor-pointer  text-gray-800  hover:bg-[#005B97] hover:text-white"
                                >
                                    Reviewer
                                </div>
                                <div
                                    onClick={() => handleSelect("Standard User")}
                                    className="px-4 py-2 cursor-pointer text-gray-800 hover:bg-[#005B97] hover:text-white"
                                >
                                    Standard User
                                </div>
                            </div>
                        )}
                    </div>


                    <div className="mb-4 relative">
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
                                {showPassword ? <FaEye size={20} className="text-[#005B97]" /> : <FaEyeSlash size={20} className="text-[#005B97]" />}
                            </button>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-black font-semibold">Confirm Password</label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Re-enter Password"
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
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-[#005B97] text-white py-2 px-4 font-bold rounded-md hover:bg-[#005b97f0] transition duration-300"
                        disabled={isLoading}
                    >
                        {isLoading ? "Registering..." : "Register"}
                    </button>
                </form>
                <p className="mt-4 text-center text-sm text-black font-medium">
                    Already have an account?{" "}
                    <Link href="/login" className="text-[#005B97] hover:underline">
                        Sign In
                    </Link>
                </p>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
                        <div className="flex justify-end mb-5">
                            <button
                                onClick={() => { setShowModal(false); setRole(""); }}
                                className="font-bold text-white bg-[#005B97] rounded-full px-[7px] py-0"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="flex justify-center mb-4">
                            <Image
                                src="/images/request_send.svg"
                                alt="logo"
                                width={200}
                                height={200}
                                priority
                            />
                        </div>
                        <h3 className="text-xl text-center mb-4 text-gray-800 font-bold">Request Sent For Approval</h3>
                        <p className="text-center mb-4 text-gray-400">Your request to access MPG OCR as a {role} has been sent to the admin. He will update you on your given email once he will review that.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
