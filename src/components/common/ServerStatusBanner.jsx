import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

// FIXED: Added FiLoader to imports to prevent build error
const { FiWifi, FiWifiOff, FiRefreshCw, FiServer, FiLoader } = FiIcons;

const ServerStatusBanner = ({ onStatusChange }) => {
  const [status, setStatus] = useState('checking'); // checking, online, offline
  const [lastChecked, setLastChecked] = useState(null);

  const checkServer = async () => {
    setStatus('checking');
    try {
      // Use a timeout to fail fast if server is down
      // Uses relative path /api/health which goes through Vite proxy
      await axios.get('/api/health', { timeout: 3000 });
      setStatus('online');
      setLastChecked(new Date());
      if (onStatusChange) onStatusChange(true);
    } catch (error) {
      console.error('Server Check Failed:', error.message);
      setStatus('offline');
      if (onStatusChange) onStatusChange(false);
    }
  };

  useEffect(() => {
    checkServer();
    // Poll every 10 seconds
    const interval = setInterval(checkServer, 10000);
    return () => clearInterval(interval);
  }, []);

  if (status === 'online') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-full">
            <SafeIcon icon={FiWifi} className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-green-800">Backend Server Online</p>
            <p className="text-xs text-green-600">Ready to upload files (Bucket: documents)</p>
          </div>
        </div>
        <button 
          onClick={checkServer}
          className="text-green-700 hover:text-green-900 p-2 rounded-full hover:bg-green-100 transition-colors"
          title="Check Connection"
        >
          <SafeIcon icon={FiRefreshCw} className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm mb-6 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="bg-red-100 p-2 rounded-full mt-1">
            <SafeIcon icon={FiWifiOff} className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-800 uppercase tracking-wide mb-1">
              Backend Server Disconnected
            </h3>
            <p className="text-sm text-red-700 mb-3">
              The upload system cannot work because the backend is not running on port 3001.
            </p>
            <div className="bg-white/50 rounded-md p-3 border border-red-100 text-xs font-mono text-red-900">
              <p className="font-bold mb-1">🔧 HOW TO FIX:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Open your terminal</li>
                <li>Run command: <span className="bg-black text-white px-1 rounded">npm run server</span></li>
                <li>Wait for "Server running" message</li>
                <li>Click Refresh below</li>
              </ol>
            </div>
            <button 
              onClick={checkServer}
              className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <SafeIcon icon={FiRefreshCw} className="w-3 h-3" /> Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-3 mb-6">
      <SafeIcon icon={FiLoader} className="w-4 h-4 text-gray-400 animate-spin" />
      <span className="text-sm text-gray-500 font-medium">Checking server status...</span>
    </div>
  );
};

export default ServerStatusBanner;