"use client";

import { useState, useEffect } from "react";
import { Job } from "../../types";
import { FaClock } from "react-icons/fa";
import { DatePicker } from "rsuite";
import "rsuite/DatePicker/styles/index.css";
// import DatePicker1 from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

interface AddJobModalProps {
  onClose: () => void;
  onSubmit: (data: Job) => void;
}

const AddJobModal: React.FC<AddJobModalProps> = ({ onClose, onSubmit }) => {
  // const [availableDurations, setAvailableDurations] = useState<number[]>([]);
  // const [fromTime, setFromTime] = useState<string | null>("");
  // const [toTime, setToTime] = useState<string | null>("");
  // const [time, setTime] = useState<Date | null>(new Date());

  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [everyTime, setEveryTime] = useState("");
  const [dayOffset, setDayOffset] = useState<string>("");
  const [fetchLimit, setFetchLimit] = useState<number>(5000);
  const [time, setTime] = useState<Date | null>(null);
  const [fromTime, setFromTime] = useState<string | null>("");
  const [toTime, setToTime] = useState<string | null>("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [error, setError] = useState<string>("");

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
      .toString()
      .padStart(2, "0");
    const mins = (minutes % 60).toString().padStart(2, "0");
    return `${hours}:${mins}`;
  };

  const generateDurations = (startTime: string, endTime: string): string[] => {
    const startTimeInMinutes = timeToMinutes(startTime);
    const endTimeInMinutes = timeToMinutes(endTime);
    const durations: string[] = [];

    for (let i = 0; i <= endTimeInMinutes - startTimeInMinutes; i++) {
      durations.push(minutesToTime(i));
    }

    return durations;
  };

  useEffect(() => {
    if (fromTime && toTime) {
      const startTimeInMinutes = timeToMinutes(fromTime);
      const endTimeInMinutes = timeToMinutes(toTime);

      if (endTimeInMinutes <= startTimeInMinutes) {
        setError("The 'To' time must be after the 'From' time.");
        setAvailableTimes([]);
      } else {
        const durations = generateDurations(fromTime, toTime);
        setAvailableTimes(durations);
        setError("");

        if (durations.length > 0) {
          setTime(new Date(`2024-01-01T${durations[0]}`));
        }
      }
    }
  }, [fromTime, toTime]);

  useEffect(() => {
    const timeHeader = document.querySelector(".react-datepicker-time__header");
    if (timeHeader) {
      timeHeader.textContent = "Every";
    }
  }, [time]);

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setFromTime(formatTime(date));
    } else {
      setFromTime(null);
    }
  };

  const handleToDateChange = (date: Date | null) => {
    if (date) {
      setToTime(formatTime(date));
    } else {
      setToTime(null);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedDays.length === 0) {
      setErrorMessage("Please select at least one day.");
      return;
    }

    if (fromTime === toTime) {
      setErrorMessage('"From" time and "To" time cannot be the same.');
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    const jobData: Job = {
      _id: "",
      dayOffset: parseInt(dayOffset || "0", 10),
      selectedDays,
      fetchLimit,
      fromTime,
      toTime,
      everyTime,
      active: false,
    };

    try {
      const response = await fetch("/api/jobs/add-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setErrorMessage(errorData.error || "Failed to add job.");
        return;
      }

      onSubmit(jobData);
      onClose();
    } catch (error) {
      console.log("Error adding job:", error);
      setErrorMessage("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDayChange = (day: string) => {
    setSelectedDays((prevSelectedDays) =>
      prevSelectedDays.includes(day)
        ? prevSelectedDays.filter((selectedDay) => selectedDay !== day)
        : [...prevSelectedDays, day]
    );
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
        <h2 className="text-2xl text-center text-gray-800 font-bold mb-4">
          Add Job
        </h2>
        <form onSubmit={handleFormSubmit}>
          {errorMessage && (
            <div className="mb-4 text-red-600 font-medium text-center">
              {errorMessage}
            </div>
          )}

          <div className="mb-4">
            <label className="block font-semibold text-gray-800 mb-3">
              Select Days
            </label>
            <div className="grid grid-cols-3 gap-4">
              {[
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ].map((day) => (
                <div key={day} className="flex items-center">
                  <input
                    type="checkbox"
                    id={day}
                    checked={selectedDays.includes(day)}
                    onChange={() => handleDayChange(day)}
                    className="mr-2"
                  />
                  <label htmlFor={day} className="text-gray-800">
                    {day}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col mb-5">
            <label
              htmlFor="fromTime"
              className="text-sm font-semibold text-gray-800"
            >
              AT/From
            </label>
            <div>
              <div className="w-full">
                <DatePicker
                  value={fromTime ? new Date(`2024-01-01T${fromTime}`) : null}
                  format="HH:mm"
                  onChange={handleDateChange}
                  className="w-full outline-none text-gray-800 focus:outline-none"
                  caretAs={() => (
                    <FaClock size={16} className="text-[#005B97]" />
                  )}
                  placeholder="Select Time"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col mb-5">
            <label
              htmlFor="toTime"
              className="text-sm font-semibold text-gray-800"
            >
              To
            </label>
            <div>
              <div className="w-full">
                <DatePicker
                  value={toTime ? new Date(`2024-01-01T${toTime}`) : null}
                  format="HH:mm"
                  onChange={handleToDateChange}
                  className="w-full outline-none text-gray-800 focus:outline-none"
                  caretAs={() => (
                    <FaClock size={16} className="text-[#005B97]" />
                  )}
                  placeholder="Select Time"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col mb-5">
            <label
              htmlFor="everyTime"
              className="text-sm font-semibold text-gray-800"
            >
              Every (HH:MM)
            </label>
            <div className="w-full">
              <input
                type="text"
                id="everyTime"
                placeholder="HH:MM"
                value={everyTime}
                onChange={(e) => setEveryTime(e.target.value)}
                onBlur={() => {
                  const isValidFormat = /^\d{2}:\d{2}$/.test(everyTime);
                  if (!isValidFormat) {
                    setError("Please enter time in HH:MM format.");
                  } else if (!availableTimes.includes(everyTime)) {
                    setError(
                      `Every time must be within the range ${
                        availableTimes[0]
                      } to ${availableTimes[availableTimes.length - 1]}`
                    );
                  } else {
                    setError("");
                  }
                }}
                disabled={!fromTime || !toTime || availableTimes.length === 0}
                className={`w-full px-4 py-[6px] mt-1 border rounded-md text-gray-800 focus:outline-none focus:ring-2 ${
                  !fromTime || !toTime || availableTimes.length === 0
                    ? "bg-gray-100 cursor-not-allowed"
                    : "focus:ring-[#005B97]"
                }`}
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="everyTime"
              className="text-sm font-semibold text-gray-800"
            >
              Day Offset
            </label>
            <div>
              <input
                className="w-full px-4 py-[6px] mt-1 border rounded-md text-gray-800 focus:outline-none focus:ring-2 mb-5"
                type="number"
                placeholder="Enter Day Offset"
                value={dayOffset}
                onChange={(e) => setDayOffset(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="fetchLimit"
              className="text-sm font-semibold text-gray-800"
            >
              Fetch Limit
            </label>
            <div>
              <input
                className="w-full px-4 py-[6px] mt-1 border rounded-md text-gray-800 focus:outline-none focus:ring-2 mb-5"
                type="number"
                placeholder="Enter Fetch Limit"
                value={fetchLimit === 0 ? "" : fetchLimit}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    setFetchLimit(0); // Or set to undefined if preferred
                  } else {
                    const parsed = parseInt(value, 10);
                    if (!isNaN(parsed)) {
                      setFetchLimit(parsed);
                    }
                  }
                }}
              />
            </div>
          </div>
          {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

          <div className="flex">
            <button
              type="submit"
              className={`w-full px-6 py-2 rounded-md ${
                isSubmitting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[#005B97] text-white"
              }`}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddJobModal;
