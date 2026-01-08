import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiX, FiAlertTriangle, FiCheck } = FiIcons;

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", isDestructive = false }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 dark:border-gray-700"
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className={`p-3 rounded-full flex-shrink-0 ${isDestructive ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
              <SafeIcon icon={FiAlertTriangle} className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{title}</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                {message}
              </p>
            </div>
          </div>
          
          <div className="flex gap-3 justify-end mt-6 bg-gray-50 dark:bg-gray-700/30 -mx-6 -mb-6 p-4">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors text-sm"
            >
              {cancelText}
            </button>
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className={`px-6 py-2.5 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 text-sm ${isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-black hover:bg-gray-900 dark:bg-white dark:text-black'}`}
            >
              <SafeIcon icon={FiCheck} className="w-4 h-4" />
              {confirmText}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ConfirmModal;