"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import { useSidebar } from "../context/SidebarContext";
import Header from "../components/Header";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Swal from "sweetalert2";
import { IoIosArrowForward } from "react-icons/io";
import { MdDelete } from "react-icons/md";
import { FiSearch } from "react-icons/fi";
import { FaChevronDown } from "react-icons/fa";
import { IoCalendar } from "react-icons/io5";
import TableSpinner from "../components/TableSpinner";

export interface Log {
  _id: string;
  message: string;
  fileName: string;
  status: string;
  timestamp: string;
  connectionResult: string;
}

interface LiveLogEntry {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  endpoint: string;
  method: string;
  statusCode: number;
  timestamp: string;
  metadata?: {
    duration?: string;
    dataKeys?: string[];
    recordCount?: number;
  };
}

interface CVLogEntry {
  id: string;
  source: 'app' | 'pixtral' | 'lmdeploy_exec' | 'lmdeploy_serve';
  message: string;
  timestamp: string;
  type: 'info' | 'error' | 'warning' | 'success';
}

type CombinedLogEntry = (LiveLogEntry | CVLogEntry) & { logSource: 'api' | 'cv' };

interface FormattedLog {
  request_id: string;
  method: string;
  path: string;
  status_code: number;
  event: 'request_completed' | 'request_started';
  logger: string;
  level: LiveLogEntry['type'];
  timestamp: string;
  duration_ms?: number;
}

export default function Page() {
  const [isFilterDropDownOpen, setIsFilterDropDownOpen] = useState(true);
  const [fileNameFilter, setFileNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
    const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [oracleFilter, setOracleFilter] = useState("");
  const [submittedFilter, setSubmittedFilter] = useState("");
  const [showButton, setShowButton] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [limit, setLimit] = useState<number | "">(100);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loadingTable, setLoadingTable] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [allowPageOneFetch, setAllowPageOneFetch] = useState(false);
  const [applyFilters, setApplyFilters] = useState(false);
  const [apiLogs, setApiLogs] = useState<LiveLogEntry[]>([]);
  const [cvLogs, setCVLogs] = useState<CVLogEntry[]>([]);
  const [combinedLogs, setCombinedLogs] = useState<CombinedLogEntry[]>([]);
  const [apiConnected, setApiConnected] = useState(false);
  const [cvConnected, setCVConnected] = useState(false);
  const [cvConnectionError, setCVConnectionError] = useState<string>('');
  const [missingFiles, setMissingFiles] = useState<string[]>([]);
  const [cvBasePath, setCVBasePath] = useState('/home/arham-hamid/Documents/POD_OCR_DEPLOY/logs');
  const [cvSources, setCVSources] = useState<string[]>(['all']);
  const [availableCVSources] = useState(['app', 'pixtral', 'lmdeploy_exec', 'lmdeploy_serve']);
  const [levelFilter, setLevelFilter] = useState<'all' | 'success' | 'error' | 'warning' | 'info'>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [maxLiveLogs, setMaxLiveLogs] = useState<number>(500);
  const [liveSearchTerm, setLiveSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const apiEventSourceRef = useRef<EventSource | null>(null);
  const cvEventSourceRef = useRef<EventSource | null>(null);
  const pendingLogsRef = useRef<CombinedLogEntry[]>([]);
  const cvReconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  const router = useRouter();

  const { isExpanded } = useSidebar();

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
    setLoadingTable(false);
  }, [router]);

  const connectAPILogs = useCallback(() => {
    if (apiEventSourceRef.current) {
      apiEventSourceRef.current.close();
    }

    console.log('Connecting to API logs SSE...');
    setApiConnected(false);

    const eventSource = new EventSource('/api/logs-stream');
    apiEventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('Connected to API log stream');
      setApiConnected(true);
    };

    eventSource.onerror = () => {
      console.error('API logs SSE error');
      setApiConnected(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'history') {
          setApiLogs(data.logs.slice(-maxLiveLogs));
        } else if (data.type === 'log') {
          if (!isPaused) {
            setApiLogs(prev => {
              const updated = [...prev, data.log];
              return updated.slice(-maxLiveLogs);
            });
          }
        }
      } catch (error) {
        console.error('Failed to parse API log:', error);
      }
    };
  }, [isPaused, maxLiveLogs]);

const connectCVLogs = useCallback(() => {
  if (!cvBasePath) {
    console.warn('No base path set for CV logs');
    setCVConnectionError('Please provide a base path');
    Swal.fire({
      title: 'CV Logs Error',
      text: 'Please provide a base path for CV logs',
      icon: 'error',
      confirmButtonColor: '#005B97',
    });
    return;
  }

  if (cvEventSourceRef.current) {
    cvEventSourceRef.current.close();
  }

  const sourcesQuery = cvSources.includes('all') ? 'all' : cvSources.join(',');
  const url = `/api/cv-logs-stream?basePath=${encodeURIComponent(cvBasePath)}&sources=${sourcesQuery}`;

  console.log(' Connecting to CV logs:', url);
  setCVConnected(false);
  setCVConnectionError('');
  setMissingFiles([]);

  const eventSource = new EventSource(url);
  cvEventSourceRef.current = eventSource;

  let hasReceivedData = false;
  let hasShownError = false;

  eventSource.onopen = () => {
    console.log(' Connected to CV log stream');
    setCVConnected(true);
    setCVConnectionError('');
    setMissingFiles([]);
    cvReconnectAttempts.current = 0;
  };

  eventSource.onerror = (error) => {
    console.error('CV logs SSE error:', error);
    setCVConnected(false);
    
    if (!hasReceivedData && !hasShownError) {
      hasShownError = true;
      
      const errorMsg = `Unable to connect to CV logs at: ${cvBasePath}. Please check if the path exists and is accessible.`;
      setCVConnectionError(errorMsg);
      
      Swal.fire({
        title: 'CV Logs Connection Error',
        html: `
          <p class="text-sm text-gray-700 mb-2">${errorMsg}</p>
          <p class="text-sm text-gray-600 mt-2">Please verify:</p>
          <ul class="text-sm text-left text-gray-600 list-disc list-inside mt-2">
            <li>The directory path exists</li>
            <li>You have read permissions</li>
            <li>Log files are present in the directory</li>
            <li>The path is spelled correctly</li>
          </ul>
          <div class="mt-3 p-2 bg-gray-100 rounded">
            <p class="text-xs font-mono text-gray-700">${cvBasePath}</p>
          </div>
        `,
        icon: 'error',
        confirmButtonColor: '#005B97',
      });
      
      eventSource.close();
    }
  };

  eventSource.onmessage = (event) => {
    if (event.data.startsWith(':')) return;

    hasReceivedData = true;
    setCVConnectionError('');

    try {
      const data = JSON.parse(event.data);
      
      console.log('Received CV log data:', data);
      
      if (data.type === 'error' || data.error) {
        setCVConnectionError(data.error);
        setCVConnected(false);
        
        if (!hasShownError) {
          hasShownError = true;
          
          let errorTitle = 'CV Logs Error';
          let errorMessage = data.error;
          let errorDetails = '';
          
          if (data.errorType === 'directory_not_found' || data.error.includes('does not exist')) {
            errorTitle = 'Directory Not Found';
            errorDetails = `
              <p class="text-sm text-gray-600 mt-2">The specified directory does not exist:</p>
              <div class="mt-2 p-2 bg-gray-100 rounded">
                <p class="text-xs font-mono text-gray-700">${cvBasePath}</p>
              </div>
              <p class="text-sm text-gray-600 mt-2">Please check the path and try again.</p>
            `;
          } else if (data.errorType === 'permission_denied' || data.error.includes('permission')) {
            errorTitle = 'Permission Denied';
            errorDetails = `
              <p class="text-sm text-gray-600 mt-2">You don't have permission to access:</p>
              <div class="mt-2 p-2 bg-gray-100 rounded">
                <p class="text-xs font-mono text-gray-700">${cvBasePath}</p>
              </div>
            `;
          } else if (data.errorType === 'no_files_found' || data.error.includes('No log files')) {
            errorTitle = 'No Log Files Found';
            errorDetails = `
              <p class="text-sm text-gray-600 mt-2">No log files were found in:</p>
              <div class="mt-2 p-2 bg-gray-100 rounded">
                <p class="text-xs font-mono text-gray-700">${cvBasePath}</p>
              </div>
              ${data.missingFiles ? `
                <p class="text-sm text-gray-600 mt-2">Expected files:</p>
                <ul class="text-sm text-left text-gray-600 list-disc list-inside mt-1">
                  ${data.missingFiles.map((f: string) => `<li>${f}</li>`).join('')}
                </ul>
              ` : ''}
            `;
          }
          
          Swal.fire({
            title: errorTitle,
            html: `
              <p class="text-sm text-gray-700 mb-2">${errorMessage}</p>
              ${errorDetails}
            `,
            icon: 'error',
            confirmButtonColor: '#005B97',
            width: '600px',
          });
        }
        
        eventSource.close();
        return;
      }
      
      if (data.type === 'warning' && data.missingFiles && data.missingFiles.length > 0) {
        setMissingFiles(data.missingFiles);
        
        if (!hasShownError) {
          hasShownError = true;
          
          const fileNames = data.missingFiles.map((f: string) => {
            const name = f.replace('.log', '');
            return name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
          }).join(', ');
          
          Swal.fire({
            title: 'Missing Log Files',
            html: `
              <p class="text-sm text-gray-700 mb-2">The following log files were not found:</p>
              <p class="text-sm font-semibold text-red-600 mb-2">${fileNames}</p>
              <p class="text-sm text-gray-600">in directory:</p>
              <div class="mt-2 p-2 bg-gray-100 rounded">
                <p class="text-xs font-mono text-gray-700">${cvBasePath}</p>
              </div>
              <p class="text-sm text-gray-600 mt-3">Available logs will still be displayed.</p>
            `,
            icon: 'warning',
            confirmButtonColor: '#005B97',
            width: '600px',
          });
        }
      }
      
      if (data.type === 'history') {
        setCVLogs(data.logs.slice(-maxLiveLogs));
      } else if (data.type === 'log') {
        if (!isPaused) {
          setCVLogs(prev => {
            const updated = [...prev, data.log];
            return updated.slice(-maxLiveLogs);
          });
        }
      }
    } catch (error) {
      console.error('Failed to parse CV log:', error);
    }
  };
}, [cvBasePath, cvSources, isPaused, maxLiveLogs]);

  useEffect(() => {
    const combined: CombinedLogEntry[] = [];
    
    apiLogs.forEach(log => {
      combined.push({ ...log, logSource: 'api' as const });
    });
    
    cvLogs.forEach(log => {
      combined.push({ ...log, logSource: 'cv' as const });
    });
    
    combined.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    setCombinedLogs(combined.slice(-maxLiveLogs));
  }, [apiLogs, cvLogs, maxLiveLogs]);


  
useEffect(() => {
  if (!isAuthenticated) return;
  
  connectAPILogs();

  return () => {
    if (apiEventSourceRef.current) apiEventSourceRef.current.close();
    if (cvEventSourceRef.current) cvEventSourceRef.current.close();
  };
}, [isAuthenticated, connectAPILogs]); 

  useEffect(() => {
    if (autoScroll && !isPaused) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [combinedLogs, autoScroll, isPaused]);

const applyBasePath = async () => {
  if (!cvBasePath.trim()) {
    setCVConnectionError('Base path cannot be empty');
    Swal.fire({
      title: 'Invalid Path',
      text: 'Base path cannot be empty',
      icon: 'error',
      confirmButtonColor: '#005B97',
    });
    return;
  }

  try {
    const response = await fetch('/api/cv-logs-path', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        basePath: cvBasePath,
        sources: cvSources,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to save path');
    }

    console.log(' Path saved to DB:', result);
  } catch (error) {
    console.error('Error saving path:', error);
  }

  cvReconnectAttempts.current = 0;
  setCVConnectionError('');
  setMissingFiles([]);
  
  if (cvEventSourceRef.current) {
    cvEventSourceRef.current.close();
  }
  
  setCVLogs([]);
  connectCVLogs();
};


  useEffect(() => {
    const loadSavedPath = async () => {
      try {
        const response = await fetch('/api/cv-logs-path');
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.data) {
            console.log(' Loaded saved CV logs path:', result.data);
            setCVBasePath(result.data.basePath);
            setCVSources(result.data.sources || ['all']);
            
            if (isFirstLoad && result.data.basePath) {
              console.log('Auto-connecting CV logs on first load...');
              
              setTimeout(() => {
                const sourcesQuery = (result.data.sources || ['all']).includes('all') 
                  ? 'all' 
                  : (result.data.sources || ['all']).join(',');
                
                const url = `/api/cv-logs-stream?basePath=${encodeURIComponent(result.data.basePath)}&sources=${sourcesQuery}`;

                console.log(' Connecting to CV logs (first load):', url);
                
                const eventSource = new EventSource(url);
                cvEventSourceRef.current = eventSource;

                let hasReceivedData = false;
                let hasShownError = false;

                eventSource.onopen = () => {
                  console.log(' Connected to CV log stream (first load)');
                  setCVConnected(true);
                  setCVConnectionError('');
                  setMissingFiles([]);
                  cvReconnectAttempts.current = 0;
                  setIsFirstLoad(false); 
                };

                eventSource.onerror = (error) => {
                  console.error('CV logs SSE error (first load):', error);
                  setCVConnected(false);
                  setIsFirstLoad(false); 
                  
                  if (!hasReceivedData && !hasShownError) {
                    hasShownError = true;
                    const errorMsg = `Unable to connect to CV logs at: ${result.data.basePath}`;
                    setCVConnectionError(errorMsg);
                    
                    Swal.fire({
                      title: 'CV Logs Connection Error',
                      html: `
                        <p class="text-sm text-gray-700 mb-2">${errorMsg}</p>
                        <p class="text-sm text-gray-600 mt-2">Please verify the path and click "Apply Path" to reconnect.</p>
                        <div class="mt-3 p-2 bg-gray-100 rounded">
                          <p class="text-xs font-mono text-gray-700">${result.data.basePath}</p>
                        </div>
                      `,
                      icon: 'error',
                      confirmButtonColor: '#005B97',
                    });
                    
                    eventSource.close();
                  }
                };

                eventSource.onmessage = (event) => {
                  if (event.data.startsWith(':')) return;

                  hasReceivedData = true;
                  setCVConnectionError('');

                  try {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'error' || data.error) {
                      setCVConnectionError(data.error);
                      setCVConnected(false);
                      setIsFirstLoad(false);
                      
                      if (!hasShownError) {
                        hasShownError = true;
                        
                        let errorTitle = 'CV Logs Error';
                        let errorMessage = data.error;
                        let errorDetails = '';
                        
                        if (data.errorType === 'directory_not_found' || data.error.includes('does not exist')) {
                          errorTitle = 'Directory Not Found';
                          errorDetails = `
                            <p class="text-sm text-gray-600 mt-2">The specified directory does not exist:</p>
                            <div class="mt-2 p-2 bg-gray-100 rounded">
                              <p class="text-xs font-mono text-gray-700">${result.data.basePath}</p>
                            </div>
                            <p class="text-sm text-gray-600 mt-2">Please update the path and click "Apply Path".</p>
                          `;
                        } else if (data.errorType === 'no_files_found') {
                          errorTitle = 'No Log Files Found';
                          errorDetails = `
                            <p class="text-sm text-gray-600 mt-2">No log files were found in:</p>
                            <div class="mt-2 p-2 bg-gray-100 rounded">
                              <p class="text-xs font-mono text-gray-700">${result.data.basePath}</p>
                            </div>
                          `;
                        }
                        
                        Swal.fire({
                          title: errorTitle,
                          html: `
                            <p class="text-sm text-gray-700 mb-2">${errorMessage}</p>
                            ${errorDetails}
                          `,
                          icon: 'error',
                          confirmButtonColor: '#005B97',
                          width: '600px',
                        });
                      }
                      
                      eventSource.close();
                      return;
                    }
                    
                    // Handle missing files warning
                    if (data.type === 'warning' && data.missingFiles && data.missingFiles.length > 0) {
                      setMissingFiles(data.missingFiles);
                      
                      if (!hasShownError) {
                        hasShownError = true;
                        
                        const fileNames = data.missingFiles.map((f: string) => {
                          const name = f.replace('.log', '');
                          return name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
                        }).join(', ');
                        
                        Swal.fire({
                          title: 'Missing Log Files',
                          html: `
                            <p class="text-sm text-gray-700 mb-2">The following log files were not found:</p>
                            <p class="text-sm font-semibold text-red-600 mb-2">${fileNames}</p>
                            <p class="text-sm text-gray-600">in directory:</p>
                            <div class="mt-2 p-2 bg-gray-100 rounded">
                              <p class="text-xs font-mono text-gray-700">${result.data.basePath}</p>
                            </div>
                            <p class="text-sm text-gray-600 mt-3">Available logs will still be displayed.</p>
                          `,
                          icon: 'warning',
                          confirmButtonColor: '#005B97',
                          width: '600px',
                        });
                      }
                    }
                    
                    if (data.type === 'history') {
                      setCVLogs(data.logs.slice(-maxLiveLogs));
                      setIsFirstLoad(false);
                    } else if (data.type === 'log') {
                      if (!isPaused) {
                        setCVLogs(prev => {
                          const updated = [...prev, data.log];
                          return updated.slice(-maxLiveLogs);
                        });
                      }
                    }
                  } catch (error) {
                    console.error('Failed to parse CV log:', error);
                    setIsFirstLoad(false);
                  }
                };
              }, 500); 
            } else {
              setIsFirstLoad(false); 
            }
          } else {
            setIsFirstLoad(false); 
          }
        } else {
          setIsFirstLoad(false);
        }
      } catch (error) {
        console.error('Error loading saved path:', error);
        setIsFirstLoad(false); 
      }
    };

    if (isAuthenticated) {
      loadSavedPath();
    }
  }, [isAuthenticated, isPaused, maxLiveLogs]);
  const allServices = [
    { value: 'all', label: 'All Services' },
    { value: 'backend', label: 'Backend (API)' },
    { value: 'app', label: 'App' },
    { value: 'pixtral', label: 'Pixtral' },
    { value: 'lmdeploy_exec', label: 'LMDeploy Exec' },
    { value: 'lmdeploy_serve', label: 'LMDeploy Serve' },
  ];


  useEffect(() => {
    let shouldReconnect = false;
    let newSources: string[] = [];
    const previousSources = cvSources.join(',');

    if (serviceFilter === 'all') {
      newSources = ['all'];
      shouldReconnect = previousSources !== 'all';
    } else if (serviceFilter === 'backend') {
      newSources = [];
      shouldReconnect = cvSources.length > 0;
    } else if (['app', 'pixtral', 'lmdeploy_exec', 'lmdeploy_serve'].includes(serviceFilter)) {
      newSources = [serviceFilter];
      shouldReconnect = previousSources !== serviceFilter;
    }

    if (JSON.stringify(cvSources) !== JSON.stringify(newSources)) {
      setCVSources(newSources);
    }

    if (shouldReconnect && isAuthenticated && !isFirstLoad && cvBasePath && cvConnected) {
      console.log(`Service filter changed: ${previousSources} → ${newSources.join(',')}, reconnecting CV logs...`);
      
      if (cvEventSourceRef.current) {
        cvEventSourceRef.current.close();
      }
      
      setCVLogs([]);
      
      setTimeout(() => {
        const sourcesQuery = newSources.includes('all') ? 'all' : newSources.join(',');
        const url = `/api/cv-logs-stream?basePath=${encodeURIComponent(cvBasePath)}&sources=${sourcesQuery}`;

        console.log('Reconnecting to CV logs:', url);
        
        const eventSource = new EventSource(url);
        cvEventSourceRef.current = eventSource;

        let hasReceivedData = false;

        eventSource.onopen = () => {
          console.log('Reconnected to CV log stream');
          setCVConnected(true);
          setCVConnectionError('');
          setMissingFiles([]);
        };

        eventSource.onerror = (error) => {
          console.error(' CV logs SSE error on reconnect:', error);
          setCVConnected(false);
        };

        eventSource.onmessage = (event) => {
          if (event.data.startsWith(':')) return;

          hasReceivedData = true;
          setCVConnectionError('');

          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'error' || data.error) {
              setCVConnectionError(data.error);
              setCVConnected(false);
              console.error(' CV logs error:', data.error);
              return;
            }
            
            if (data.type === 'warning' && data.missingFiles && data.missingFiles.length > 0) {
              setMissingFiles(data.missingFiles);
            }
            
            if (data.type === 'history') {
              setCVLogs(data.logs.slice(-maxLiveLogs));
            } else if (data.type === 'log') {
              if (!isPaused) {
                setCVLogs(prev => {
                  const updated = [...prev, data.log];
                  return updated.slice(-maxLiveLogs);
                });
              }
            }
          } catch (error) {
            console.error('Failed to parse CV log:', error);
          }
        };
      }, 100);
    }
  }, [serviceFilter, isAuthenticated, isFirstLoad, cvBasePath, cvConnected, cvSources, isPaused, maxLiveLogs]);

  const filteredLogs = combinedLogs.filter(log => {
    const matchesLevel = levelFilter === 'all' || log.type === levelFilter;
    
    let matchesService = true;
    if (serviceFilter !== 'all') {
      if (log.logSource === 'api' && 'endpoint' in log) {
        matchesService = serviceFilter === 'backend';
      } else if (log.logSource === 'cv' && 'source' in log) {
        matchesService = log.source === serviceFilter;
      }
    }
    
    const searchLower = liveSearchTerm.toLowerCase();
    const matchesSearch = liveSearchTerm === '' ||
      log.message.toLowerCase().includes(searchLower) ||
      (log.logSource === 'api' && 'endpoint' in log && log.endpoint.toLowerCase().includes(searchLower)) ||
      (log.logSource === 'cv' && 'source' in log && log.source.toLowerCase().includes(searchLower));
    
    return matchesLevel && matchesService && matchesSearch;
  });

  const liveStats = {
    total: combinedLogs.length,
    errors: combinedLogs.filter(l => l.type === 'error').length,
    warnings: combinedLogs.filter(l => l.type === 'warning').length,
    info: combinedLogs.filter(l => l.type === 'info' || l.type === 'success').length,
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const getLogBadgeColor = (type: string) => {
    const colors = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-500';
  };

  const getSourceBadgeColor = (source: string) => {
    const colors: Record<string, string> = {
      backend: 'bg-indigo-100 text-indigo-800',
      app: 'bg-blue-100 text-blue-800',
      pixtral: 'bg-green-100 text-green-800',
      lmdeploy_exec: 'bg-yellow-100 text-yellow-800',
      lmdeploy_serve: 'bg-purple-100 text-purple-800',
    };
    return colors[source] || 'bg-gray-100 text-gray-800';
  };

  const formatLogData = (log: LiveLogEntry) => {
    const data: FormattedLog = {
      request_id: log.id.split('-')[0],
      method: log.method,
      path: log.endpoint,
      status_code: log.statusCode,
      event: log.type === 'success' ? 'request_completed' : 'request_started',
      logger: 'app',
      level: log.type,
      timestamp: log.timestamp,
    };

    if (log.metadata?.duration) {
      data.duration_ms = parseFloat(log.metadata.duration);
    }

    return JSON.stringify(data, null, 2);
  };

  const clearLiveLogs = async () => {
    try {
      await fetch('/api/logs-clear', { method: 'POST' });
      setApiLogs([]);
      setCVLogs([]);
      setCombinedLogs([]);
      pendingLogsRef.current = [];
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const togglePause = () => {
    setIsPaused(prev => {
      if (prev) {
        setCombinedLogs(current => {
          const combined = [...current, ...pendingLogsRef.current];
          return combined.slice(-maxLiveLogs);
        });
        pendingLogsRef.current = [];
      }
      return !prev;
    });
  };

  const handleSidebarStateChange = (newState: boolean) => {
    return newState;
  };

  const handlePageChange = (newPage: number) => {
    if (newPage !== currentPage) {
      if (newPage > 1) {
        setAllowPageOneFetch(true);
      }
      setCurrentPage(newPage);
    }
  };

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingTable(true);

      const filters = {
        fileName: sessionStorage.getItem("fileName") || "",
        timestamp: sessionStorage.getItem("submittedFilter") || "",
        status: sessionStorage.getItem("statusFilter") || "",
        connectionResult: sessionStorage.getItem("oracleFilter") || "",
      };

      const queryParams = new URLSearchParams();

      if (filters.fileName) queryParams.set("fileName", filters.fileName);
      if (filters.timestamp) queryParams.set("submittedFilter", filters.timestamp);
      if (filters.status) queryParams.set("statusFilter", filters.status);
      if (filters.connectionResult) queryParams.set("oracleFilter", filters.connectionResult);

      const response = await fetch(
        `/api/get-logs?page=${currentPage}&${queryParams.toString()}&limit=${limit}`
      );

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setTotalPages(data.totalPages);
        setTotalLogs(data.totalLogs);
      }
    } catch (error) {
      console.log("Error fetching logs:", error);
    } finally {
      setLoadingTable(false);
    }
  }, [currentPage, limit]);

  useEffect(() => {
    if (applyFilters || currentPage > 1 || (currentPage === 1 && allowPageOneFetch)) {
      fetchUsers();
      setApplyFilters(false);
      if (currentPage === 1 && allowPageOneFetch) {
        setAllowPageOneFetch(false);
      }
    }
  }, [applyFilters, currentPage, allowPageOneFetch, fetchUsers]);

  useEffect(() => {
    setShowButton(selectedRows.length > 0);
  }, [selectedRows]);

  if (!isAuthenticated) return <p>Access Denied. Redirecting...</p>;

  const isAnyFilterApplied = () => {
    return (
      sessionStorage.getItem("fileName") ||
      sessionStorage.getItem("statusFilter") ||
      sessionStorage.getItem("submittedFilter") ||
      sessionStorage.getItem("oracleFilter")
    );
  };

  const handleFilterApply = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sessionStorage.setItem("fileName", fileNameFilter);
    sessionStorage.setItem("statusFilter", statusFilter);
    sessionStorage.setItem("submittedFilter", submittedFilter);
    sessionStorage.setItem("oracleFilter", oracleFilter);
    setCurrentPage(1);
    setApplyFilters(true);
  };

  const resetFiltersAndFetch = async () => {
    sessionStorage.setItem("fileName", "");
    sessionStorage.setItem("statusFilter", "");
    sessionStorage.setItem("submittedFilter", "");
    sessionStorage.setItem("oracleFilter", "");
    setFileNameFilter("");
    setStatusFilter("");
    setSubmittedFilter("");
    setOracleFilter("");
    await fetchUsers();
  };

  const handleRouteChange = () => {
    if (typeof window !== "undefined") {
      const filters = { fileNameFilter, statusFilter, submittedFilter, oracleFilter };
      Object.entries(filters).forEach(([key, value]) => {
        sessionStorage.setItem(key, value);
      });
    }
  };

  const handleRowSelection = (id: string) => {
    setSelectedRows((prevSelectedRows) =>
      prevSelectedRows.includes(id)
        ? prevSelectedRows.filter((rowId) => rowId !== id)
        : [...prevSelectedRows, id]
    );
  };

  const isAllSelected = selectedRows.length === logs.length && logs.length > 0;
  const handleSelectAll = () => {
    if (selectedRows.length === logs.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(logs.map((log) => log._id));
    }
  };

  const handleDelete = async () => {
    Swal.fire({
      title: "Delete Files",
      text: "Are you sure you want to delete these files?",
      icon: "warning",
      iconColor: "#005B97",
      showCancelButton: true,
      confirmButtonColor: "#005B97",
      cancelButtonColor: "#E0E0E0",
      confirmButtonText: "Delete",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch("/api/delete-logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: selectedRows }),
          });

          const result = await response.json();

          if (response.ok) {
            const isLastPage = logs.length === selectedRows.length && currentPage > 1;
            if (isLastPage) {
              setCurrentPage((prevPage) => prevPage - 1);
            }
            await fetchUsers();
            setTotalLogs(totalLogs - selectedRows.length);
            setSelectedRows([]);
            Swal.fire({
              title: "Deleted!",
              text: "Your files have been deleted.",
              icon: "success",
              timer: 2000,
              showConfirmButton: false,
            });
          }
        } catch (error) {
          console.log("Error deleting files:", error);
        }
      }
    });
  };

  return (
    <div className="flex flex-row h-screen bg-white">
      <Sidebar onStateChange={handleSidebarStateChange} />
      <div className={`flex-1 flex flex-col transition-all bg-white duration-300 ${!isExpanded ? "ml-24" : "ml-64"}`}>
        <Header
          leftContent="Total Logs"
          totalContent={totalLogs}
          rightContent={
            <>
              <div className="flex gap-4 mr-3">
                {showButton && (
                  <div className="flex gap-2 group cursor-pointer transition-all duration-300" onClick={handleDelete}>
                    <span>
                      <MdDelete className="fill-[red] text-2xl transition-transform transform group-hover:scale-110" />
                    </span>
                    <span className="text-[red] transition-all duration-300 group-hover:text-red-600">Delete</span>
                  </div>
                )}
              </div>
            </>
          }
          buttonContent={""}
        />
        
        <div className="flex-1 p-4 bg-white overflow-y-auto">
          <div className={`bg-gray-200 p-3 mb-0 transition-all duration-500 ease-in w-full sm:w-auto ${isFilterDropDownOpen ? "rounded-t-lg" : "rounded-lg"}`}>
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setIsFilterDropDownOpen(!isFilterDropDownOpen)}>
              <span className="text-gray-800 text-sm sm:text-base md:text-lg">File Logs Filters</span>
              <span>
                <IoIosArrowForward className={`text-xl p-0 text-[#005B97] transition-all duration-500 ease-in ${isFilterDropDownOpen ? "rotate-90" : ""}`} />
              </span>
            </div>
          </div>

          <div className={`overflow-hidden transition-all duration-500 ease-in w-auto ${isFilterDropDownOpen ? "max-h-[1000px] p-3" : "max-h-0"} flex flex-wrap gap-4 mt-0 bg-gray-200 rounded-b-lg`}>
            <form onSubmit={handleFilterApply} className="w-full grid grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label htmlFor="search" className="text-sm font-semibold text-gray-800">File Name</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter File Name"
                    value={fileNameFilter}
                    onChange={(e) => setFileNameFilter(e.target.value)}
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                  />
                  <button type="button" className="absolute inset-y-0 right-3 top-1/2 transform -translate-y-1/2 text-gray-500 cursor-default">
                    <FiSearch size={20} className="text-[#005B97]" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label htmlFor="search" className="text-sm font-semibold text-gray-800">Submitted At</label>
                <div className="relative">
                  <input
                    id="dateInput"
                    type="date"
                    placeholder="YYYY-MM-DD"
                    value={submittedFilter}
                    onChange={(e) => setSubmittedFilter(e.target.value)}
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] custom-date-input"
                    max="9999-12-31"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                    onClick={() => {
                      const dateInput = document.getElementById("dateInput") as HTMLInputElement;
                      if (dateInput) dateInput.showPicker();
                    }}
                  >
                    <IoCalendar size={20} className="text-[#005B97]" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label htmlFor="search" className="text-sm font-semibold text-gray-800">Oracle Connection</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Oracle Connection"
                    value={oracleFilter}
                    onChange={(e) => setOracleFilter(e.target.value)}
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label htmlFor="finalStatusFilter" className="text-sm font-semibold text-gray-800">Status</label>
                <div className="relative">
                  <select
                    id="finalStatusFilter"
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] appearance-none cursor-pointer"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="added">Added</option>
                    <option value="updated">Updated</option>
                    <option value="not_found">Not Found</option>
                  </select>
                  <button type="button" className="absolute inset-y-0 right-3 top-[25px] transform -translate-y-1/2 text-gray-500 cursor-default">
                    <FaChevronDown size={16} className="text-[#005B97]" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label htmlFor="search" className="text-sm font-semibold text-gray-800">Maximum No. of Hits</label>
                <div>
                  <input
                    type="text"
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] appearance-none"
                    value={limit}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "") {
                        setLimit("");
                      } else {
                        const parsed = parseInt(e.target.value, 10);
                        if (!isNaN(parsed)) setLimit(parsed);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-end items-center gap-2 col-span-3">
                <button
                  className={`text-[#005B97] underline ${!isAnyFilterApplied() ? "text-gray-400 cursor-not-allowed" : "cursor-pointer"}`}
                  onClick={resetFiltersAndFetch}
                  disabled={!isAnyFilterApplied()}
                  type="button"
                >
                  Reset Filters
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#005B97] text-white hover:bg-[#2270a3]">
                  Apply Filters
                </button>
              </div>
            </form>
          </div>

          {loadingTable ? (
            <div className="flex justify-center items-center">
              <TableSpinner />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center mt-20">
              <Image src="/images/no_request.svg" alt="No jobs found" width={200} height={200} priority style={{ width: "auto", height: "auto" }} />
            </div>
          ) : (
            <table className="min-w-full bg-white border-gray-300">
              <thead>
                <tr className="text-xl text-gray-800">
                  <th className="py-2 px-4 border-b text-start font-medium">
                    <span className="mr-3">
                      <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} />
                    </span>
                    File Name
                  </th>
                  <th className="py-2 px-4 border-b text-center font-medium">Message</th>
                  <th className="py-2 px-4 border-b text-center font-medium">Submitted At</th>
                  <th className="py-2 px-4 border-b text-center font-medium">Oracle Connection</th>
                  <th className="py-2 px-4 border-b text-center font-medium">Status</th>
                  <th className="py-2 px-4 border-b text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: Log) => (
                  <tr key={log._id} className="text-gray-600">
                    <td className="py-2 px-4 border-b text-start m-0 sticky left-0 bg-white z-10">
                      <span className="mr-3">
                        <input type="checkbox" checked={selectedRows.includes(log._id)} onChange={() => handleRowSelection(log._id)} />
                      </span>
                      <Link
                        href={`/extracted-data-monitoring/${log._id}`}
                        onClick={() => {
                          handleRouteChange();
                          localStorage.setItem("prev", "");
                        }}
                        className="group"
                      >
                        <span className="text-[#005B97] underline group-hover:text-blue-500 transition-all duration-500 transform group-hover:scale-110">
                          {log.fileName}
                        </span>
                      </Link>
                    </td>
                    <td className="py-1 px-4 border-b text-center">{log.message}</td>
                    <td className="py-1 px-4 border-b text-center text-gray-500">
                      {new Date(log.timestamp).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-1 px-4 border-b text-center">{log.connectionResult}</td>
                    <td className="py-1 px-4 border-b text-center">{log.status}</td>
                    <td className="py-1 px-4 border-b text-center">
                      <Link href={`/logs/${log?._id}`} className="text-[#005B97] hover:underline">
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {loadingTable || totalPages === 0 || logs.length === 0 ? null : (
            <div className="mt-4 flex justify-end items-center gap-4 text-gray-800">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-md ${currentPage === 1 ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"}`}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-md ${currentPage === totalPages ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"}`}
              >
                Next
              </button>
            </div>
          )}

          <div className="my-8 border-t-2 border-gray-300"></div>

         <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3"> Computer Vision Logs Configuration</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={cvBasePath}
                onChange={(e) => setCVBasePath(e.target.value)}
                placeholder="/path/to/POD_OCR_DEPLOY/logs"
                className="flex-1 px-4 py-2 border text-gray-700 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005B97]"
              />
              <button
                onClick={applyBasePath}
                className="px-6 py-2 bg-[#005B97] hover:bg-[#004577] text-white rounded-lg font-medium transition"
              >
                Apply Path
              </button>
            </div>
            
            {missingFiles.length > 0 && (
              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800">Missing Log Files</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    The following files were not found: {missingFiles.map(f => f.replace('.log', '')).join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Live System Logs (API + CV)</h2>
            
            <div className="bg-gray-200 p-4 rounded-lg mb-4">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${apiConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <span className="text-sm text-gray-600">API: {apiConnected ? 'Connected' : 'Disconnected'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${cvConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <span className="text-sm text-gray-600">CV: {cvConnected ? 'Connected' : 'Disconnected'}</span>
                  </div>
                </div>

                <div className="relative flex-1 max-w-xs">
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={liveSearchTerm}
                    onChange={(e) => setLiveSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border text-gray-700 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005B97] text-sm"
                  />
                  <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005B97] text-sm bg-white"
                >
                  <option value="all">All Levels</option>
                  <option value="error">Error</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                  <option value="info">Info</option>
                </select>

                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005B97] text-sm bg-white"
                >
                  {allServices.map(service => (
                    <option key={service.value} value={service.value}>{service.label}</option>
                  ))}
                </select>

                <select
                  value={maxLiveLogs}
                  onChange={(e) => setMaxLiveLogs(Number(e.target.value))}
                  className="px-4 py-2 border text-gray-700 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005B97] text-sm bg-white"
                >
                  <option value={100}>100 logs</option>
                  <option value={200}>200 logs</option>
                  <option value={500}>500 logs</option>
                  <option value={1000}>1000 logs</option>
                </select>

                <button
                  onClick={togglePause}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition ${
                    isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                </button>

                <button
                  onClick={clearLiveLogs}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-1"
                >
                  <MdDelete className="text-lg" />
                  Clear
                </button>
              </div>

              <div className="flex items-center justify-between gap-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800">{liveStats.total}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{liveStats.errors}</div>
                  <div className="text-xs text-gray-500">Errors</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{liveStats.warnings}</div>
                  <div className="text-xs text-gray-500">Warnings</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{liveStats.info}</div>
                  <div className="text-xs text-gray-500">Info/Success</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-[600px] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-gray-50 pb-2 z-10">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${apiConnected || cvConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-sm font-semibold text-gray-700">Live Logs ({filteredLogs.length})</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="w-4 h-4 text-[#005B97] border-gray-300 rounded focus:ring-[#005B97] cursor-pointer"
                  />
                  <span className="text-sm text-gray-600">Auto-scroll</span>
                </label>
              </div>

              {filteredLogs.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <p className="text-lg">No logs to display</p>
                  <p className="text-sm mt-2">Make API calls or ensure CV services are running</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLogs.map((log) => {
                    const isAPILog = log.logSource === 'api' && 'endpoint' in log;
                    const source = isAPILog ? 'backend' : (log.logSource === 'cv' && 'source' in log ? log.source : 'unknown');
                    
                    return (
                      <div key={log.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition">
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                          <span className="text-xs text-gray-500">{formatTimestamp(log.timestamp)}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getSourceBadgeColor(source)}`}>
                            {isAPILog ? 'backend' : source}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getLogBadgeColor(log.type)}`}>
                            {log.type.toUpperCase()}
                          </span>
                        </div>

                        <div className="px-4 py-3">
                          <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap break-words">
                            {isAPILog ? formatLogData(log as LiveLogEntry) : log.message}
                          </pre>
                        </div>

                        <details className="px-4 pb-3 overflow-auto max-w-7xl">
                          <summary className="text-xs text-[#005B97] cursor-pointer hover:text-blue-700 select-none">
                            View Details
                          </summary>
                          <pre className="mt-2 text-xs text-gray-600 bg-gray-50 p-3 rounded">
                            {JSON.stringify(isAPILog ? {
                              message: log.message,
                              endpoint: (log as LiveLogEntry).endpoint,
                              method: (log as LiveLogEntry).method,
                              statusCode: (log as LiveLogEntry).statusCode,
                              metadata: (log as LiveLogEntry).metadata,
                            } : {
                              message: log.message,
                              source: (log as CVLogEntry).source,
                              type: log.type,
                            }, null, 2)}
                          </pre>
                        </details>
                      </div>
                    );
                  })}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}