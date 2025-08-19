import { useEffect, useState } from "react";
import axios from "axios";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  fetchJobs: () => void;
}

const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  fetchJobs,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState<boolean>(false);

  // Reset files when modal opens
  useEffect(() => {
    if (isOpen) {
      clearAll();
    }
  }, [isOpen]);

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(Array.from(event.target.files));
      setProgress({});
    }
  };

  // await axios.post("https://hanneskonzept.ml-bench.com/api/upload-pdf", formData, {
  // Upload files
  // const uploadFiles = async () => {
  //     if (files.length === 0) return;
  //     setUploading(true);

  //     for (const file of files) {
  //         const formData = new FormData();
  //         formData.append("pdf_file", file);

  //         try {
  //             await axios.post("/api/file/upload-pdf", formData, {
  //                 headers: {
  //                     "Content-Type": "multipart/form-data",
  //                 },
  //                 onUploadProgress: (progressEvent) => {
  //                     const percentCompleted = Math.round(
  //                         (progressEvent.loaded * 100) / (progressEvent.total || 1)
  //                     );
  //                     setProgress((prev) => ({
  //                         ...prev,
  //                         [file.name]: percentCompleted,
  //                     }));
  //                 },
  //             });
  //         } catch (error) {
  //             console.error(`Error uploading ${file.name}:`, error);
  //         }
  //     }

  //     fetchJobs();
  //     setUploading(false);
  //     clearAll();
  //     onClose();
  // };

  const uploadFiles = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setProgress({});

    for (const file of files) {
      const formData = new FormData();
      formData.append("pdf_file", file);

      setProgress((prev) => ({
        ...prev,
        [file.name]: 0,
      }));

      try {
        await axios.post("/api/file/upload-pdf", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1)
            );

            setProgress((prev) => ({
              ...prev,
              [file.name]: Math.min(percentCompleted, 100),
            }));
          },
        });

        setProgress((prev) => ({
          ...prev,
          [file.name]: 100,
        }));
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        setProgress((prev) => ({
          ...prev,
          [file.name]: -1,
        }));
      }
    }

    fetchJobs();
    setUploading(false);
    clearAll();
    onClose();
  };

  const clearAll = () => {
    setFiles([]);
    setProgress({});
  };

  return isOpen ? (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h2 className="text-xl font-semibold mb-5 text-black text-center">
          Upload Files
        </h2>
        <p className="mb-2 text-black">Select multiple Files</p>
        {/* <input type="file" multiple onChange={handleFileChange} accept="application/pdf" className="mb-4 text-black" disabled={uploading} /> */}

        <input
          type="file"
          multiple
          onChange={handleFileChange}
          className="mb-4 text-black"
          disabled={uploading}
          accept=".jpg, .jpeg, .pdf, .bmp, .png"
        />

        {files.length > 0 && (
          <div className=" h-80 overflow-y-scroll">
            {files.map((file) => (
              <div key={file.name} className="mb-2">
                <p className="text-gray-500">{file.name}</p>
                <div className="flex justify-between items-center gap-3">
                  <div className="w-72">
                    <progress
                      value={progress[file.name] || 0}
                      max="100"
                      className="w-full h-3 rounded-full bg-red-500 dark:bg-green-400"
                    ></progress>
                  </div>
                  <div className="text-[#005B97] w-10 text-center">
                    {progress[file.name] || 0}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-between mb-2">
          {/* {files.length > 0 && (
                        <button
                            onClick={clearAll}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg"
                        >
                            Clear All
                        </button>
                    )} */}
          <div className="flex justify-center items-center w-full">
            <button
              onClick={uploadFiles}
              className="px-4 py-2 bg-[#005B97] text-white rounded-lg disabled:opacity-50 cursor-pointer w-full"
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
        <div className="flex justify-center items-center w-full">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-400 text-white rounded-lg w-full"
            disabled={uploading}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  ) : null;
};

export default UploadModal;
