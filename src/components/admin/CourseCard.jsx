import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiBook, FiTrash2, FiUsers, FiTarget, FiDollarSign, FiSettings, FiArrowRight, FiExternalLink, FiCopy, FiCheck } = FiIcons;

const CourseCard = ({ course, index, onDelete, manageLink }) => {
  const [copied, setCopied] = React.useState(false);
  const getStatusColor = (status) => status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

  const copyDemoLink = () => {
    const link = `${window.location.origin}/demo/${course.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow flex flex-col h-full"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <SafeIcon icon={FiBook} className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 line-clamp-1" title={course.name}>{course.name}</h3>
            <p className="text-sm text-gray-600">
              {course.main_category ? `${course.main_category} - ` : ''}{course.tutor_type || 'General'}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(course.status)}`}>
          {course.status}
        </span>
      </div>

      <div className="space-y-3 flex-1">
        <p className="text-sm text-gray-600 line-clamp-2 h-10">{course.description}</p>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="flex items-center text-sm text-gray-600">
            <SafeIcon icon={FiTarget} className="w-4 h-4 mr-2 text-gray-400" />
            <span>{course.questions_count || 0} Qs</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <SafeIcon icon={FiDollarSign} className="w-4 h-4 mr-2 text-gray-400" />
            <span>${course.price_full || '0'}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col gap-3">
        {course.is_demo && (
          <button
            onClick={copyDemoLink}
            className={`w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              copied ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <SafeIcon icon={copied ? FiCheck : FiCopy} className="w-4 h-4" />
            {copied ? 'Link Copied!' : 'Copy Public Demo Link'}
          </button>
        )}
        <div className="flex items-center justify-between">
          <button
            onClick={() => onDelete(course.id)}
            className="text-red-500 hover:text-red-700 text-sm flex items-center"
          >
            <SafeIcon icon={FiTrash2} className="w-4 h-4 mr-1" /> Delete
          </button>
          <Link
            to={manageLink || '#'}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center"
          >
            Manage <SafeIcon icon={FiArrowRight} className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default CourseCard;