"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ObjectId } from "mongodb";
import { IoCalendar } from "react-icons/io5";
import Swal from 'sweetalert2';


interface Job {
    _id: ObjectId;
    blNumber: string;
    jobName: string;
    podDate: string;
    deliveryDate: Date;
    podSignature: string;
    totalQty: number;
    received: number;
    damaged: number;
    short: number;
    over: number;
    refused: number;
    noOfPages: number;
    stampExists: string;
    finalStatus: string;
    reviewStatus: string;
    recognitionStatus: string;
    breakdownReason: string;
    reviewedBy: string;
    cargoDescription: string;
    createdAt: string;
    updatedAt?: string;
}

interface EditModalProps {
    job: Job;
    onClose: () => void;
    onUpdate: (updatedJob: Job) => void;
}

const EditModal: React.FC<EditModalProps> = ({ job, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({
        createdAt: format(new Date(job.createdAt), "yyyy-MM-dd"),
        deliveryDate: format(new Date(job.deliveryDate), "yyyy-MM-dd"),
        cargoDescription: job.cargoDescription,
    });
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.cargoDescription.trim()) {
            setErrorMessage("Description is required.");
            return;
        }

        setErrorMessage("");
        setIsSubmitting(true);

        const formatToYYYYMMDD = (dateString: string) => {
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };

        try {
            const updatedJob = {
                ...job,
                createdAt: new Date(formData.createdAt).toISOString(),
                deliveryDate: formatToYYYYMMDD(formData.deliveryDate),
                cargoDescription: formData.cargoDescription,
            };

            const response = await fetch(`/api/process-data/update-data`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(updatedJob),
            });

            if (response.ok) {
                const result = await response.json();
                onUpdate(result.updatedData);
                onClose();
                Swal.fire({
                    title: "Updated!",
                    text: "The job has been updated successfully.",
                    icon: "success",
                    timer: 2000,
                    showConfirmButton: false,
                });
            } else {
                const error = await response.json();
                setErrorMessage(error.error || "Failed to update job.");
            }
        } catch (error) {
            console.log("Error updating job:", error);
            setErrorMessage("An unexpected error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96 relative">
                <button
                    onClick={onClose}
                    className="absolute top-7 right-2 font-bold text-white bg-[#005B97] rounded-full px-[7px] py-0"
                >
                    &times;
                </button>
                <h2 className="text-2xl text-center text-gray-800 font-bold mb-4">Edit Shipment</h2>

                <form onSubmit={handleFormSubmit}>
                    {errorMessage && (
                        <div className="mb-4 text-red-600 font-medium text-center">
                            {errorMessage}
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block font-semibold text-gray-800 mb-3">Created On</label>
                        <div className="relative">
                            <input
                                id="createdAt"
                                type="date"
                                name="createdAt"
                                value={formData.createdAt}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 mt-1 pr-10 border text-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005B97] custom-date-input"
                                required
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                                onClick={() => {
                                    const createdAtInput = document.getElementById('createdAt') as HTMLInputElement;
                                    if (createdAtInput) {
                                        createdAtInput.showPicker();
                                    }
                                }}
                            >
                                <IoCalendar size={20} className="text-[#005B97]" />
                            </button>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block font-semibold text-gray-800 mb-3">Delivery Date</label>
                        <div className="relative">
                            <input
                                id="deliveryDate"
                                type="date"
                                name="deliveryDate"
                                value={formData.deliveryDate}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 mt-1 pr-10 border text-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005B97] custom-date-input"
                                required
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                                onClick={() => {
                                    const podDateInput = document.getElementById('deliveryDate') as HTMLInputElement;
                                    if (podDateInput) {
                                        podDateInput.showPicker();
                                    }
                                }}
                            >
                                <IoCalendar size={20} className="text-[#005B97]" />
                            </button>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block font-semibold text-gray-800 mb-3">Description</label>
                        <textarea
                            name="cargoDescription"
                            value={formData.cargoDescription}
                            onChange={handleInputChange}
                            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md w-full"
                            rows={5}
                            required
                        ></textarea>
                    </div>

                    <div className="flex gap-3 mt-10">
                        <button
                            type="submit"
                            className={`w-full px-6 py-2 rounded-md ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#005B97] text-white'
                                }`}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Updating...' : 'Update'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
};

export default EditModal;
