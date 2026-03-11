import React from 'react';
import { motion } from 'framer-motion';

const LoadingSpinner = ({ fullPage = true }) => {
    return (
        <div className={`flex flex-col items-center justify-center ${fullPage ? 'min-h-[60vh] w-full' : 'p-8'}`}>
            <motion.div
                animate={{
                    rotate: 360
                }}
                transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full shadow-lg shadow-blue-200"
            />
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-4 text-gray-500 font-medium tracking-wide animate-pulse"
            >
                Optimizing experience...
            </motion.p>
        </div>
    );
};

export default LoadingSpinner;
