import React from "react";

interface LoadingSpinnerProps {
    percentage: number;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ percentage }) => {
    return (
        <div className="flex flex-col items-center justify-center p-5">
            <div className="flex justify-center items-center mb-4">
                <div className="w-28 h-28 border-8 border-t-[#005B97] border-gray-200 rounded-full animate-spin"></div>
            </div>
            <p className="text-center text-xl text-black">Please wait, we are accessing your DB it will take just few moments</p>
            <div className="mt-4">
                <p className="text-center font-semibold text-2xl text-[#005B97]">{percentage}%</p>
            </div>
        </div>
    );
};

export default LoadingSpinner;
