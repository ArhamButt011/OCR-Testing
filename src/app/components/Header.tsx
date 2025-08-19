import React from "react";

interface HeaderProps {
    leftContent: string | React.ReactNode;
    totalContent: string | React.ReactNode;
    rightContent: string | React.ReactNode;
    buttonContent: string | React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ leftContent, rightContent, totalContent, buttonContent }) => {
    return (
        <header className="w-full bg-white text-gray-800 p-4 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 md:space-x-6">
            <div className="flex flex-col items-start">
                <div className="text-xl font-bold">{leftContent}</div>
                <p className="text-gray-400">{leftContent == 'Extracted Data Monitoring' ? 'Rows' : leftContent} : {totalContent}</p>
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto justify-between">
                <div className="w-full md:w-auto">{rightContent}</div>
                <div>
                    {buttonContent}
                </div>

            </div>
        </header>
    );
};

export default Header;
