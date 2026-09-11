import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiX, FiDownload } = FiIcons;

const OFFICE_EXTENSIONS = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];

/**
 * "View Key" must open a viewer, not trigger a download - a plain `<a href=fileUrl>` or
 * `window.open` on a .doc/.docx URL makes the browser download it instead of displaying it,
 * which is exactly the behavior this replaces. A PDF renders natively in an iframe; an Office
 * file is rendered read-only via Microsoft's public embed viewer (the file's Supabase Storage
 * URL is already public, which is what that viewer requires). The uploaded file itself is never
 * touched by any of this - Download is a separate, explicit action inside the viewer.
 */
const AnswerKeyViewerModal = ({ title, fileUrl, fileType, onClose }) => {
    if (!fileUrl) return null;

    const ext = (fileType || fileUrl.split('.').pop() || '').toLowerCase().split('?')[0];
    const isOffice = OFFICE_EXTENSIONS.includes(ext);
    const viewerSrc = isOffice
        ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`
        : fileUrl;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="font-black text-gray-900 dark:text-white truncate pr-4">{title}</h3>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 flex-shrink-0"
                        >
                            <SafeIcon icon={FiX} className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 bg-gray-100 dark:bg-gray-950 overflow-hidden">
                        <iframe
                            key={viewerSrc}
                            src={viewerSrc}
                            title={title}
                            className="w-full h-full border-0"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
                        <a
                            href={fileUrl}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            <SafeIcon icon={FiDownload} className="w-4 h-4" /> Download
                        </a>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AnswerKeyViewerModal;
