import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from './SafeIcon';

const { FiCheckCircle, FiX } = FiIcons;

/**
 * The application's one shared success notification - a non-blocking, auto-dismissing toast
 * meant to replace `alert('... successfully!')` everywhere it's used for a genuinely successful
 * action. Renders fixed/top-right so it floats above whatever modal or page triggered it,
 * without stealing focus or requiring an OK click the way a browser alert does.
 */
const SuccessToast = ({ show, title, message, onClose, duration = 4000 }) => {
    useEffect(() => {
        if (!show) return undefined;
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [show, duration, onClose]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: -16, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -16, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className="fixed top-6 right-6 z-[200] w-[calc(100%-3rem)] max-w-sm"
                >
                    <div className="flex items-start gap-3 bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800/60 rounded-2xl shadow-2xl p-4 pr-3">
                        <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                            <SafeIcon icon={FiCheckCircle} className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                            <p className="font-bold text-sm text-gray-900 dark:text-white">{title}</p>
                            {message && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{message}</p>}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
                        >
                            <SafeIcon icon={FiX} className="w-4 h-4" />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SuccessToast;
