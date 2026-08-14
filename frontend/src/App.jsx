import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Copy, 
  History, 
  FileImage, 
  ShieldAlert, 
  Gauge,
  Compass,
  Sun,
  Moon,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

import ErrorBoundary from './ErrorBoundary';

export default function App() {
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('gogig_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeId, setActiveId] = useState(null);
  const [activeResult, setActiveResult] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);
  // Theme toggle (light/dark) -- persisted to localStorage
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('gogig_theme') || 'light' } catch { return 'light' }
  });

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('gogig_theme', theme);
    } catch (e) {
      // ignore in non-browser environments
    }
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  // Global error overlay to catch runtime errors not captured by ErrorBoundary
  const [globalError, setGlobalError] = useState(null);
  useEffect(() => {
    const onError = (ev) => {
      try {
        const err = ev.error || (ev.message ? new Error(ev.message) : new Error('Unknown error'));
        console.error('Window error captured', err, ev);
        setGlobalError({ message: err.message || 'Error', stack: err.stack || String(ev) });
      } catch (e) {
        console.error('Error handling window error', e);
      }
    };
    const onRejection = (ev) => {
      try {
        const reason = ev.reason || (typeof ev === 'string' ? ev : JSON.stringify(ev));
        console.error('Unhandled rejection', reason);
        const message = (reason && reason.message) || String(reason);
        const stack = (reason && reason.stack) || '';
        setGlobalError({ message, stack });
      } catch (e) {
        console.error('Error handling rejection', e);
      }
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  
  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const healthIntervalRef = useRef(null);
  const pollErrorsRef = useRef({}); // track consecutive poll errors per processingId
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    'https://backend-ai-engineering-take-home-a4k7.onrender.com';

  // Stale processing threshold in seconds (frontend will treat jobs older than this as timed out)
  const STALE_THRESHOLD = parseInt(import.meta.env.VITE_STALE_THRESHOLD) || 600; // 10 minutes default

  // Load history from state to localStorage
  useEffect(() => {
    localStorage.setItem('gogig_history', JSON.stringify(history));
  }, [history]);

  // Check connection to backend
  const checkConnection = async () => {
    try {
      // Fetch status of a dummy ID to see if server responds
      const res = await fetch(`${API_BASE_URL}/health`);
      if (res.status === 404 || res.ok) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    } catch {
      setIsConnected(false);
    }
  };

  useEffect(() => {
    checkConnection();
    healthIntervalRef.current = setInterval(checkConnection, 5000);
    return () => {
      clearInterval(healthIntervalRef.current);
    };
  }, []);

  // Poll status of active or pending items
  useEffect(() => {
    const pendingItems = history.filter(item => item.status === 'pending' || item.status === 'processing');
    
    if (pendingItems.length > 0 || (activeId && getActiveItem()?.status === 'pending' || getActiveItem()?.status === 'processing')) {
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(pollPendingItems, 1500);
      }
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [history, activeId]);

  // Fetch full results when active item changes and it is completed
  useEffect(() => {
    if (activeId) {
      const activeItem = getActiveItem();
      if (activeItem && activeItem.status === 'completed') {
        fetchResults(activeId);
      } else {
        setActiveResult(null);
      }
    } else {
      setActiveResult(null);
    }
  }, [activeId]);

  const getActiveItem = () => history.find(item => item.processingId === activeId);

  const pollPendingItems = async () => {
    const itemsToPoll = history.filter(item => item.status === 'pending' || item.status === 'processing');
    
    // Also poll active if it is pending/processing and not in history list somehow
    const activeItem = getActiveItem();
    if (activeItem && (activeItem.status === 'pending' || activeItem.status === 'processing') && !itemsToPoll.find(i => i.processingId === activeId)) {
      itemsToPoll.push(activeItem);
    }

    if (itemsToPoll.length === 0) return;

    const updatedHistory = [...history];
    let changed = false;

    for (const item of itemsToPoll) {
     try {
       const res = await fetch(`${API_BASE_URL}/api/images/${item.processingId}/status`);

       // Treat non-OK responses as transient server errors; track them.
       if (!res.ok) {
         // increment error counter
         pollErrorsRef.current[item.processingId] = (pollErrorsRef.current[item.processingId] || 0) + 1;
         console.warn(`Status fetch returned ${res.status} for ${item.processingId} (error count=${pollErrorsRef.current[item.processingId]})`);

         // If we've seen 3 consecutive errors for this item, mark it timed_out/failed locally
         if (pollErrorsRef.current[item.processingId] >= 3) {
           const index = updatedHistory.findIndex(h => h.processingId === item.processingId);
           if (index !== -1 && updatedHistory[index].status !== 'timed_out') {
             updatedHistory[index] = {
               ...updatedHistory[index],
               status: 'timed_out',
               error: `Processing failed: server returned ${res.status}. This may indicate the server instance restarted or exceeded memory (OOM). Please try again.`
             };
             changed = true;
             if (item.processingId === activeId) setActiveResult(null);
           }
         }

         continue;
       }

       // Success — reset error counter for this item
       pollErrorsRef.current[item.processingId] = 0;

       const statusData = await res.json(); // { processingId, status, error, processingStartedAt, ... }
       const index = updatedHistory.findIndex(h => h.processingId === item.processingId);

       // If status is processing, check for staleness
       if (statusData.status === 'processing' && statusData.processingStartedAt) {
         const started = Date.parse(statusData.processingStartedAt);
         const ageSec = (Date.now() - started) / 1000;
         if (ageSec > STALE_THRESHOLD) {
            // mark timed out with a server-instance explanatory message
            if (index !== -1 && updatedHistory[index].status !== 'timed_out') {
              updatedHistory[index] = {
                ...updatedHistory[index],
                status: 'timed_out',
                error: `Processing timed out after ${Math.round(ageSec)}s — the server instance may have restarted or exceeded available memory (OOM). Please retry.`
              };
              changed = true;
              // If this was the active item, clear active result
              if (item.processingId === activeId) {
                setActiveResult(null);
              }
            }
            continue; // skip further processing for this item
          }
       }

       if (index !== -1 && updatedHistory[index].status !== statusData.status) {
         updatedHistory[index] = {
           ...updatedHistory[index],
           status: statusData.status,
           error: statusData.error || null
         };
         changed = true;

         // If active item finished, pull results
         if (item.processingId === activeId && statusData.status === 'completed') {
           fetchResults(activeId);
         }
       }
     } catch (err) {
       console.error("Polling error for", item.processingId, err);
       // Network error — increment retry count and if too many, mark timed_out
       pollErrorsRef.current[item.processingId] = (pollErrorsRef.current[item.processingId] || 0) + 1;
       if (pollErrorsRef.current[item.processingId] >= 3) {
         const index = updatedHistory.findIndex(h => h.processingId === item.processingId);
         if (index !== -1 && updatedHistory[index].status !== 'timed_out') {
           updatedHistory[index] = {
             ...updatedHistory[index],
             status: 'timed_out',
             error: 'Processing failed: server unreachable. The server instance may have restarted or run out of memory (OOM). Please retry.'
           };
           changed = true;
           if (item.processingId === activeId) setActiveResult(null);
         }
       }
     }
    }

    if (changed) {
      setHistory(updatedHistory);
    }

    // If active item exists but is now marked timed_out, set activeId to keep UI consistent
    const activeIdx = updatedHistory.findIndex(h => h.processingId === activeId);
    if (activeIdx !== -1 && updatedHistory[activeIdx].status === 'timed_out') {
      // Clear active result to avoid showing stale/partial data
      setActiveResult(null);
    }
  };

  const fetchResults = async (processingId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/images/${processingId}/results`);
      if (res.ok) {
        const data = await res.json();
        setActiveResult(data);
        
        // Update history with details if missing
        setHistory(prev => prev.map(item => {
          if (item.processingId === processingId) {
            return {
              ...item,
              plateNumber: data.analysis?.plate?.ocr?.plateNumber || 'No Plate',
              status: data.status
            };
          }
          return item;
        }));
      }
    } catch (err) {
      console.error("Error fetching results", err);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file) => {
    if (!file.type.startsWith('image/')) {
      alert('Only image files are supported');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/images`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Upload failed');
      }

      const data = await res.json(); // { processingId, status, message }
      
      const newHistoryItem = {
        processingId: data.processingId,
        originalFilename: file.name,
        createdAt: new Date().toISOString(),
        status: 'pending',
        plateNumber: 'Analyzing...'
      };

      setHistory(prev => [newHistoryItem, ...prev]);
      setActiveId(data.processingId);
    } catch (err) {
      alert(`Error uploading file: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeItem = getActiveItem();

  // Helper to format path into a static URL mapping to the sirv uploads route
  const getStaticUrl = (filePath) => {
  if (!filePath) return '';

  const normalized = filePath.replace(/\\/g, '/');

  const uploadsIndex = normalized.indexOf('uploads/');

  if (uploadsIndex !== -1) {
    return `${API_BASE_URL}/${normalized.substring(uploadsIndex)}`;
  }

  return '';
};

  // Convert absolute path of crops to the served upload url
  const getCropUrl = (ocrCropPath, procId) => {
    if (!ocrCropPath) return '';
    // Standard crop location: /uploads/crops/[processingId]-plate-ocr.png on the backend
    return `${API_BASE_URL}/uploads/crops/${procId}-plate-ocr.png`;
  };

  return (
    <ErrorBoundary>
      {globalError && (
        <div style={{position:'fixed',inset:16,zIndex:9999,background:'rgba(0,0,0,0.8)',color:'#fff',padding:16,borderRadius:8,maxWidth:'min(900px,calc(100% - 32px))',overflow:'auto'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
            <strong>Runtime Error</strong>
            <div>
              <button onClick={()=>setGlobalError(null)} style={{marginRight:8}}>Dismiss</button>
              <button onClick={()=>window.location.reload()}>Reload</button>
            </div>
          </div>
          <pre style={{whiteSpace:'pre-wrap',marginTop:8,color:'#ffdcdc'}}>{globalError.message}\n{globalError.stack}</pre>
        </div>
      )}
      <div className="app-container">
      <aside className="sidebar">
        <div className="logo-container" style={{ marginBottom: '24px' }}>
          <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--brand-primary)', letterSpacing: '-0.03em' }}>
            gig<span style={{ color: 'var(--brand-dark)' }}>Vision</span>
          </span>
        </div>
        <h2 className="sidebar-title">Pipeline Scans</h2>
        <div className="history-list">
          {history.map((item) => (
            <button 
              key={item.processingId}
              onClick={() => setActiveId(item.processingId)}
              className={`history-item ${activeId === item.processingId ? 'active' : ''}`}
            >
              <div className="history-meta">
                <span className="history-filename" title={item.originalFilename}>
                  {item.originalFilename}
                </span>
                <span className="history-date">
                  {new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span className="history-plate">{item.plateNumber || 'Pending'}</span>
                <span className={`badge badge-${item.status}`}>
                  {item.status}
                </span>
              </div>
            </button>
          ))}
          {history.length === 0 && (
            <p className="empty-history">No uploads yet</p>
          )}
        </div>

        {history.length > 0 && (
          <button 
            onClick={() => {
              if (window.confirm("Clear all history from browser?")) {
                setHistory([]);
                setActiveId(null);
              }
            }}
            className="btn-upload"
            style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
          >
            Clear History
          </button>
        )}
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        <header className="header-row">
          <div className="header-title">
            <h1>Intelligent Media Processing Pipeline</h1>
            <p>Analyze OOH campaigns, license plates, image quality, and duplicates in real-time</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Theme toggle placed to the left of connection status */}
            <button
              type="button"
              onClick={toggleTheme}
              title="Toggle theme"
              className="theme-toggle-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 8px',
                borderRadius: 8,
                background: 'transparent',
                cursor: 'pointer'
              }}
            >
              {theme === 'light' ? <Sun size={16} /> : <Moon size={16} /> }
            </button>

            <div className="connection-status">
              <span className={`status-dot ${isConnected ? 'connected' : ''}`}></span>
              {isConnected ? 'Backend Connected' : 'Connecting to Backend...'}
            </div>
          </div>
        </header>

        {/* Drag and Drop Zone */}
        <section 
          className={`upload-container ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*"
            style={{ display: 'none' }}
          />
          <div className="upload-icon-wrapper">
            {isUploading ? (
              <Loader2 className="animate-spin" size={24} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <UploadCloud size={24} />
            )}
          </div>
          <div className="upload-text">
            <strong>Click to upload</strong> or drag and drop vehicle images
          </div>
          <div className="upload-subtext">
            Supports JPEG, PNG up to 10MB
          </div>
        </section>

        {activeItem ? (
          <div className="dashboard-grid">
            {/* Left Column: Image view + Pipeline visualization */}
            <div>
              {/* Pipeline progress bar */}
              <div className="card">
                <div className="card-title">
                  <Compass size={18} style={{ color: 'var(--brand-primary)' }} />
                  Processing Steps
                </div>
                <div className="pipeline-steps">
                  <div 
                    className="pipeline-progress-bar"
                    style={{ 
                      width: 
                        activeItem.status === 'pending' ? '12.5%' :
                        activeItem.status === 'processing' ? '50%' :
                        activeItem.status === 'completed' ? '100%' : '0%'
                    }}
                  ></div>

                  <div className={`pipeline-step ${activeItem.status === 'pending' || activeItem.status === 'processing' || activeItem.status === 'completed' ? 'active' : ''} ${activeItem.status === 'completed' || activeItem.status === 'processing' ? 'completed' : ''}`}>
                    <div className="step-node">1</div>
                    <span className="step-label">Upload</span>
                  </div>

                  <div className={`pipeline-step ${activeItem.status === 'processing' || activeItem.status === 'completed' ? 'active' : ''} ${activeItem.status === 'completed' ? 'completed' : ''}`}>
                    <div className="step-node">2</div>
                    <span className="step-label">Quality Check</span>
                  </div>

                  <div className={`pipeline-step ${activeItem.status === 'processing' || activeItem.status === 'completed' ? 'active' : ''} ${activeItem.status === 'completed' ? 'completed' : ''}`}>
                    <div className="step-node">3</div>
                    <span className="step-label">Plate Detection</span>
                  </div>

                  <div className={`pipeline-step ${activeItem.status === 'completed' ? 'completed' : activeItem.status === 'failed' ? 'failed' : ''}`}>
                    <div className="step-node">4</div>
                    <span className="step-label">OCR & Done</span>
                  </div>
                </div>
              </div>

              {/* Main Image Frame with bounding box mapping */}
              <div className="card" style={{ padding: '16px' }}>
                <div className="card-title" style={{ marginBottom: '12px' }}>
                  <FileImage size={18} style={{ color: 'var(--brand-primary)' }} />
                  Image Inspection View
                </div>
                
                {activeItem.status === 'failed' ? (
                  <div className="empty-state" style={{ color: 'var(--danger)' }}>
                    <AlertCircle size={48} />
                    <h3>Processing Failed</h3>
                    <p>{activeItem.error || 'An error occurred during asynchronous pipeline execution.'}</p>
                    <div style={{ marginTop: 12 }}>
                      <button className="btn-upload" onClick={() => { setActiveId(null); }}>OK</button>
                    </div>
                  </div>
                ) : activeItem.status === 'timed_out' ? (
                  <div className="empty-state" style={{ color: 'var(--danger)' }}>
                    <AlertCircle size={48} />
                    <h3>Processing timed out</h3>
                    <p>{activeItem.error || 'Processing did not complete in time. Please try again.'}</p>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <button className="btn-upload" onClick={() => { /* prompt re-upload */ setActiveId(null); fileInputRef.current && fileInputRef.current.click(); }}>Upload again</button>
                      <button className="btn-upload" onClick={() => { setHistory(prev => prev.filter(h => h.processingId !== activeItem.processingId)); setActiveId(null); }}>Remove</button>
                    </div>
                  </div>
                ) : activeItem.status !== 'completed' ? (
                  <div className="empty-state">
                    <Loader2 className="animate-spin" size={48} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--brand-primary)' }} />
                    <h3>Processing media asset...</h3>
                    <p>Executing model inference on Roboflow & RapidOCR. Results will load automatically.</p>
                  </div>
                ) : activeResult ? (
                  <div className="image-viewer">
                    {/* Display original image. Set up dynamic overlay using image dimensions. */}
                    <img 
                      src={getStaticUrl(activeResult.filePath)} 
                      alt="Analyzed vehicle" 
                      className="display-image"
                    />
                    
                    {/* Responsive SVG Bounding Box overlay */}
                    {activeResult.analysis?.plate?.primaryPlate?.bbox && (
                      <svg 
                        className="overlay-svg"
                        viewBox={`0 0 ${activeResult.analysis.width || 100} ${activeResult.analysis.height || 100}`}
                      >
                        {(() => {
                          const [x1, y1, x2, y2] = activeResult.analysis.plate.primaryPlate.bbox;
                          const width = x2 - x1;
                          const height = y2 - y1;
                          const confidence = (activeResult.analysis.plate.primaryPlate.confidence * 100).toFixed(0);
                          
                          return (
                            <g>
                              {/* Bounding box rect */}
                              <rect 
                                x={x1} 
                                y={y1} 
                                width={width} 
                                height={height} 
                                className="bbox-rect"
                              />
                              {/* Label BG */}
                              <rect 
                                x={x1} 
                                y={y1 - 20 > 0 ? y1 - 20 : y1} 
                                width={120} 
                                height={20} 
                                className="bbox-label-bg" 
                              />
                              {/* Label Text */}
                              <text 
                                x={x1 + 6} 
                                y={y1 - 20 > 0 ? y1 - 6 : y1 + 14} 
                                className="bbox-label"
                              >
                                License Plate: {confidence}%
                              </text>
                            </g>
                          );
                        })()}
                      </svg>
                    )}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Loader2 className="animate-spin" size={24} />
                    <p>Loading result data...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: OCR Results, Duplicate warnings, Quality Analytics */}
            <div>
              {/* Duplicate banner */}
              {activeResult?.analysis?.duplicate && (
                <div className="duplicate-banner">
                  <ShieldAlert size={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                  <div>
                    <h4 className="duplicate-title">Duplicate Asset Flagged</h4>
                    <p className="duplicate-desc">
                      This file matches a previously uploaded image. 
                      Type: <strong>{activeResult.analysis.duplicate.type.toUpperCase()}</strong> similarity matches. 
                      Processing ID: <code>{activeResult.analysis.duplicate.matchProcessingId.substring(0, 8)}...</code>
                    </p>
                  </div>
                </div>
              )}

              {/* License Plate Text Output */}
              <div className="card">
                <div className="card-title">
                  <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                  License Plate Recognition
                </div>
                
                {activeResult?.analysis?.plate ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="ocr-display">
                      {activeResult.analysis.plate.ocrCrop?.path && (
                        <img 
                          src={getCropUrl(activeResult.analysis.plate.ocrCrop.path, activeResult.processingId)} 
                          alt="License Plate Crop" 
                          className="ocr-crop-img"
                          onError={(e) => {
                            // fallback just in case path parsing is offset
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                      
                      <div className="ocr-details">
                        <span className="detected-registration">
                          Detected Registration
                        </span>
                        <div className="plate-result-value">
                          {activeResult.analysis.plate.ocr?.plateNumber || 'UNDETECTED'}
                          <button 
                            className="copy-btn"
                            onClick={() => copyToClipboard(activeResult.analysis.plate.ocr?.plateNumber || '')}
                            title="Copy plate number"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                        {copied && <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '600' }}>Copied to clipboard!</span>}
                      </div>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      <p style={{ marginBottom: '6px' }}>
                        <strong>Detections Count:</strong> {activeResult.analysis.plate.plateCount || 0} number plates
                      </p>
                      {activeResult.analysis.plate.primaryPlate && (
                        <p>
                          <strong>Detection Confidence:</strong> {(activeResult.analysis.plate.primaryPlate.confidence * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>
                ) : activeItem.status !== 'completed' ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Awaiting pipeline completion...</p>
                ) : (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No license plate metadata captured for this image.</p>
                )}
              </div>

              {/* Quality & Metadata Dashboard */}
              <div className="card">
                <div className="card-title">
                  <Gauge size={18} style={{ color: 'var(--brand-primary)' }} />
                  Media Quality & Metadata
                </div>
                
                {activeResult?.analysis ? (
                  <div className="metrics-grid">
                    {/* Brightness */}
                    <div className="metric-card">
                      <div className="metric-header">
                        <span>Brightness Mean</span>
                      </div>
                      <div className="metric-val">
                        {activeResult.analysis.brightness?.mean?.toFixed(1) || '0.0'}
                      </div>
                      <div className="metric-indicator">
                        {activeResult.analysis.brightness?.flagged ? (
                          <span className="indicator-flagged" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={12} /> Low Light Alert
                          </span>
                        ) : (
                          <span className="indicator-ok">Optimal Lighting</span>
                        )}
                      </div>
                    </div>

                    {/* Sharpness / Blur */}
                    <div className="metric-card">
                      <div className="metric-header">
                        <span>Sharpness Score</span>
                      </div>
                      <div className="metric-val">
                        {activeResult.analysis.blur?.score?.toFixed(0) || '0'}
                      </div>
                      <div className="metric-indicator">
                        {activeResult.analysis.blur?.flagged ? (
                          <span className="indicator-flagged" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={12} /> Blurry Image
                          </span>
                        ) : (
                          <span className="indicator-ok">Sharp Image</span>
                        )}
                      </div>
                    </div>

                    {/* Width / Height */}
                    <div className="metric-card" style={{ gridColumn: 'span 2' }}>
                      <div className="metric-header">
                        <span>Resolution & Hash</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '13px' }}>
                        <div>
                          <strong>Dimensions:</strong> {activeResult.analysis.width} x {activeResult.analysis.height} px
                        </div>
                        <div>
                          <strong>Format:</strong> {activeResult.analysis.mime?.toUpperCase()}
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '6px' }}>
                        MD5: {activeResult.analysis.md5}
                      </div>
                    </div>
                  </div>
                ) : activeItem.status !== 'completed' ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Awaiting pipeline checks...</p>
                ) : (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No media metadata recorded.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '80px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <FileImage size={48} style={{ color: 'var(--text-light)' }} />
            <h2 style={{ fontSize: '20px', fontWeight: '800' }}>No scan selected</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '380px', margin: '0 auto' }}>
              Upload an image above, or select a previously run pipeline analysis from the scan history on the left sidebar.
            </p>
          </div>
        )}
      </main>

      {/* Embedded CSS animations for Loader spinner spin effect */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
    </ErrorBoundary>
  );
}
