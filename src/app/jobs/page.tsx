"use client";

import { useState, useEffect, useCallback } from "react";
import { useSidebar } from "../context/SidebarContext";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import Sidebar from "../components/Sidebar";
import Spinner from "../components/Spinner";
import Header from "../components/Header";
import AddJobModal from "../components/AddJobModal";
import EditJobModal from "../components/EditJobModal";
import { BiSolidEditAlt } from "react-icons/bi";
import { MdDelete } from "react-icons/md";
import { RiArrowDropDownLine } from "react-icons/ri";
import Image from "next/image";
import { Job } from "../../types";

const JobPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingTable, setLoadingTable] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const jobsPerPage = 10;
  const [totalPages, setTotalPages] = useState(1);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const [dropdownStates, setDropdownStates] = useState<string | null>(null);

  const { isExpanded } = useSidebar();

  const handleSidebarStateChange = (newState: boolean) => {
    // setIsSidebarExpanded(newState);
    return newState;
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/admin-login");
      return;
    }
    const decodeJwt = (token: string) => {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    };
    const decodedToken = decodeJwt(token);
    const currentTime = Date.now() / 1000;
    if (decodedToken.exp < currentTime) {
      localStorage.removeItem("token");
      router.push("/admin-login");
      return;
    }
    if (decodedToken.role !== "admin") {
      router.push("/extracted-data-monitoring");
      return;
    }
    setIsAuthenticated(true);
    setLoading(false);
  }, [router]);

  const toggleDropdown = (id: string) => {
    setDropdownStates((prevState) => (prevState === id ? null : id));
  };

  const toggleStatus = async (_id: string, active: boolean) => {
    try {
      const res = await fetch(`/api/jobs/add-job`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: _id, active }),
      });

      if (res.ok) {
        setJobs((prevJobs) =>
          prevJobs.map((job) => (job._id === _id ? { ...job, active } : job))
        );

        Swal.fire({
          icon: "success",
          title: "Status Updated",
          text: `The job status has been ${
            active ? "activated" : "deactivated"
          }.`,
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        const errorData = await res.json();
        console.log("Error updating status:", errorData.error);

        Swal.fire({
          icon: "error",
          title: "Update Failed",
          text: errorData.error || "Something went wrong.",
        });
      }
    } catch (error) {
      console.log("Error updating status:", error);

      Swal.fire({
        icon: "error",
        title: "Unexpected Error",
        text: "An error occurred while updating the status. Please try again.",
      });
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleEditJob = async (_id: string) => {
    try {
      const response = await fetch(`/api/jobs/edit/${_id}`);
      const jobData = await response.json();
      setEditingJob(jobData);
      setIsEditModalOpen(true);
    } catch (error) {
      console.log("Error fetching job data:", error);
    }
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setEditingJob(null);
  };

  const handleJobUpdate = (updatedJob: Job) => {
    setJobs((prevJobs) =>
      prevJobs.map((job) => (job._id === updatedJob._id ? updatedJob : job))
    );

    Swal.fire({
      icon: "success",
      title: "Job Updated",
      text: `The job data has been updated successfully.`,
      timer: 2000,
      showConfirmButton: false,
    });
  };

  const handleDeleteJob = async (_id: string) => {
    const result = await Swal.fire({
      title: "Delete Job",
      text: "Are you sure you want to delete this job?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#005B97",
      cancelButtonColor: "#F0F1F3",
      cancelButtonText: "Cancel",
      confirmButtonText: "Delete",
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(`/api/jobs/delete-job/${_id}`, {
          method: "DELETE",
        });

        if (response.ok) {
          const updatedJobs = await fetchJobs();
          if (updatedJobs.length === 0 && currentPage > 1) {
            setCurrentPage((prevPage) => prevPage - 1);
            await fetchJobs();
          }

          Swal.fire({
            icon: "success",
            title: "Job Deleted",
            text: "The job has been deleted successfully.",
            timer: 2000,
            showConfirmButton: false,
          });
        } else {
          const errorData = await response.json();
          console.log(
            "Failed to delete job:",
            errorData.error || "Unknown error"
          );
          Swal.fire({
            icon: "error",
            title: "Delete Failed",
            text:
              errorData.error || "Something went wrong while deleting the job.",
          });
        }
      } catch (error) {
        console.log("Error deleting job:", error);
        Swal.fire({
          icon: "error",
          title: "Unexpected Error",
          text: "An error occurred while deleting the job. Please try again.",
        });
      }
    }
  };

  const fetchJobs = useCallback(async (): Promise<Job[]> => {
    try {
      setLoadingTable(true);

      const searchParam = searchQuery
        ? `&search=${encodeURIComponent(searchQuery.trim())}`
        : "";
      const response = await fetch(
        `/api/jobs/add-job/?page=${currentPage}${searchParam}`
      );

      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs);
        setTotalPages(data.totalPages);
        setTotalJobs(data.totalJobs);
        return data.jobs;
      } else {
        return [];
      }
    } catch (error) {
      console.log("Error fetching jobs:", error);
      return [];
    } finally {
      setLoadingTable(false);
    }
  }, [currentPage, searchQuery]);

  useEffect(() => {
    fetchJobs();
  }, [currentPage, fetchJobs, searchQuery]);

  if (loading) return <Spinner />;
  if (!isAuthenticated) return <p>Access Denied. Redirecting...</p>;

  return (
    <div className="flex flex-row h-screen bg-white">
      <Sidebar onStateChange={handleSidebarStateChange} />
      <div
        className={`flex-1 flex flex-col transition-all bg-white duration-300 ${
          isExpanded ? "ml-64" : "ml-24"
        }`}
      >
        <Header
          leftContent="Jobs"
          totalContent={totalJobs}
          rightContent={
            <input
              type="text"
              placeholder="Search status..."
              className="px-4 py-2 rounded-lg border border-gray-300"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          }
          buttonContent={
            <button
              className="bg-[#005B97] rounded-lg py-2 px-6 text-white md:mt-0 w-60 md:w-auto"
              onClick={() => setIsModalOpen(true)}
            >
              Add New
            </button>
          }
        />
        <div className="flex-1 p-4 bg-white">
          {loadingTable ? (
            <div className="flex justify-center items-center">
              <Spinner />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center mt-20">
              <Image
                src="/images/no_jobs.svg"
                alt="No jobs found"
                width={200}
                height={200}
                priority
                style={{ width: "auto", height: "auto" }}
              />
            </div>
          ) : (
            <table className="min-w-full bg-white">
              <thead>
                <tr className="text-xl text-gray-800">
                  <th className="py-2 px-4 border-b text-start">Job Name</th>
                  <th className="py-2 px-4 border-b text-center">Mo</th>
                  <th className="py-2 px-4 border-b text-center">Tu</th>
                  <th className="py-2 px-4 border-b text-center">We</th>
                  <th className="py-2 px-4 border-b text-center">Th</th>
                  <th className="py-2 px-4 border-b text-center">Fr</th>
                  <th className="py-2 px-4 border-b text-center">Sa</th>
                  <th className="py-2 px-4 border-b text-center">Su</th>
                  <th className="py-2 px-4 border-b text-center">At/From</th>
                  <th className="py-2 px-4 border-b text-center">To</th>
                  <th className="py-2 px-4 border-b text-center">Every</th>
                  <th className="py-2 px-4 border-b text-center">Day Offset</th>
                  <th className="py-2 px-4 border-b text-center">
                    Fetch Limit
                  </th>
                  <th className="py-2 px-4 border-b text-center">Status</th>
                  <th className="py-2 px-4 border-b text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job: Job, index: number) => {
                  const jobNumber =
                    (currentPage - 1) * jobsPerPage + (index + 1);

                  return (
                    <tr key={job._id} className="text-gray-600">
                      <td className="py-2 px-4 border-b text-start text-xl font-medium">
                        {`Job #${jobNumber}`}
                      </td>

                      {[
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                        "Sunday",
                      ].map((day) => (
                        <td
                          key={day}
                          className="py-2 px-4 border-b text-center"
                        >
                          <input
                            type="checkbox"
                            checked={job.selectedDays.includes(day)}
                            className="w-4 h-4"
                            readOnly
                          />
                        </td>
                      ))}
                      <td className="py-2 px-4 border-b text-center">
                        {job.fromTime}
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        {job.toTime}
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        {job.everyTime}
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        {job.dayOffset}
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        {job.fetchLimit ? job.fetchLimit : "-"}
                      </td>

                      <td className="py-2 px-4 border-b text-center">
                        <div
                          className={`inline-flex items-center justify-center gap-0 px-2 py-1 rounded-full text-sm font-medium transition-all duration-500 ease-in-out cursor-pointer ${
                            job.active
                              ? "bg-blue-100 text-blue-600"
                              : "bg-red-100 text-red-600"
                          }`}
                          onClick={() => toggleDropdown(job._id)}
                        >
                          <div>{job.active ? "Active" : "Inactive"}</div>
                          <div className="relative">
                            <RiArrowDropDownLine
                              className={`text-2xl p-0 transform transition-transform duration-300 ${
                                dropdownStates === job._id ? "rotate-180" : ""
                              }`}
                            />
                            <ul
                              className={`absolute mt-2 right-1 z-50 bg-white border rounded-md shadow-lg w-24 transform origin-top transition-all duration-300 ease-in-out ${
                                dropdownStates === job._id
                                  ? "scale-100 opacity-100 pointer-events-auto"
                                  : "scale-95 opacity-0 pointer-events-none"
                              }`}
                            >
                              <li
                                onClick={() => toggleStatus(job._id, true)}
                                className="cursor-pointer px-3 py-1 hover:bg-blue-100 text-blue-600"
                              >
                                Active
                              </li>
                              <li
                                onClick={() => toggleStatus(job._id, false)}
                                className="cursor-pointer px-3 py-1 hover:bg-red-100 text-red-600"
                              >
                                Inactive
                              </li>
                            </ul>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        <button
                          onClick={() => handleEditJob(job._id)}
                          className="mr-5"
                        >
                          <BiSolidEditAlt className="fill-[#005B97] text-2xl" />
                        </button>
                        <button
                          onClick={() => handleDeleteJob(job._id)}
                          className=""
                        >
                          <MdDelete className="fill-[red] text-2xl" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {loadingTable || totalPages === 0 ? (
            ""
          ) : (
            <div className="mt-4 flex justify-end gap-5 items-center text-gray-800">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-md ${
                  currentPage === 1
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-md ${
                  currentPage === totalPages
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
      {isModalOpen && (
        <AddJobModal
          onClose={() => setIsModalOpen(false)}
          onSubmit={() => fetchJobs()}
        />
      )}
      {isEditModalOpen && editingJob && (
        <EditJobModal
          job={editingJob}
          onClose={handleCloseModal}
          onSubmit={handleJobUpdate}
        />
      )}
    </div>
  );
};

export default JobPage;



