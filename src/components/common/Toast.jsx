import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
// FIXED: Import SafeIcon from root common, going up 2 levels from src/components/common
import SafeIcon from '../../common/SafeIcon';

const { FiCheckCircle, FiAlertCircle, FiX } = FiIcons;

const Toast = ({ message, type = 'success', onClose, duration = 4000 }) => {
  useEffect(() => {
    if (message && duration) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-50 flex items-start gap-3 p-4 rounded-xl shadow-2xl min-w-[300px] max-w-md backdrop-blur-md border border-white/10"
          style={{
            backgroundColor: type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            color: 'white'
          }}
        >
          <div className="mt-0.5">
            <SafeIcon icon={type === 'error' ? FiAlertCircle : FiCheckCircle} className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-sm">{type === 'error' ? 'Error' : 'Success'}</h4>
            <p className="text-sm opacity-90 leading-relaxed">{message}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <SafeIcon icon={FiX} className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;