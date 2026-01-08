import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiBook, FiTrash2, FiUsers, FiTarget, FiDollarSign, FiSettings, FiArrowRight } = FiIcons;

const CourseCard = ({ course, index, onDelete, manageLink }) => {
  const getStatusColor = (status) => status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

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
            <p className="text-sm text-gray-600">{course.tutor_type || 'General'}</p>
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

      <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
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
    </motion.div>
  );
};

export default CourseCard;