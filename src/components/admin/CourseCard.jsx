import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiBook, FiTrash2, FiUsers, FiTarget, FiDollarSign, FiSettings, FiArrowRight, FiExternalLink, FiCopy, FiCheck, FiActivity } = FiIcons;

const CourseCard = ({ course, index, onDelete, manageLink }) => {
  const [copied, setCopied] = React.useState(false);
  const getStatusColor = (status) => status === 'active' ? 'text-emerald-500' : 'text-red-500';

  const copyDemoLink = () => {
    const link = `${window.location.origin}/test/${course.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const iconStyles = [
    { bg: 'bg-blue-900/30', text: 'text-blue-500', icon: FiIcons.FiPlusSquare },
    { bg: 'bg-emerald-900/30', text: 'text-emerald-500', icon: FiIcons.FiFunction },
    { bg: 'bg-purple-900/30', text: 'text-purple-500', icon: FiIcons.FiMenu },
    { bg: 'bg-yellow-900/30', text: 'text-yellow-500', icon: FiIcons.FiEdit3 },
    { bg: 'bg-orange-900/30', text: 'text-orange-500', icon: FiIcons.FiAlignLeft },
    { bg: 'bg-teal-900/30', text: 'text-teal-500', icon: FiIcons.FiActivity },
    { bg: 'bg-pink-900/30', text: 'text-pink-500', icon: FiIcons.FiGrid },
  ];
  const style = iconStyles[index % iconStyles.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-[#1b2028] rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors flex flex-col h-full shadow-sm"
    >
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className={`${style.bg} p-3 rounded-2xl`}>
            <SafeIcon icon={course.is_adaptive ? FiActivity : style.icon} className={`w-5 h-5 ${style.text}`} />
          </div>
          <div className="flex flex-col">
            <h3 className="font-bold text-white text-sm line-clamp-1" title={course.name}>{course.name}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {course.main_category ? `${course.main_category} - ` : ''}{course.tutor_type || 'General'}
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-bold flex items-center gap-1.5 ${getStatusColor(course.status)} capitalize`}>
          <div className={`w-1.5 h-1.5 rounded-full ${course.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
          {course.status}
        </span>
      </div>

      <div className="mt-auto space-y-4">
        {course.is_demo && (
          <button
            onClick={copyDemoLink}
            className={`w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              copied ? 'bg-green-900/30 text-green-500' : 'bg-[#1e293b]/50 text-blue-400 hover:bg-[#1e293b]'
            }`}
          >
            <SafeIcon icon={copied ? FiCheck : FiCopy} className="w-3 h-3" />
            {copied ? 'Copied!' : 'Copy Demo Link'}
          </button>
        )}
        <div className="flex items-center text-xs text-gray-500 gap-6">
          <div className="flex items-center">
            <span>{course.questions_count || 0} Questions</span>
          </div>
          <div className="flex items-center">
            <SafeIcon icon={FiDollarSign} className="w-3 h-3 text-gray-500 mr-1" />
            <span>{course.price_full || '0'}</span>
          </div>
        </div>
        <div className="pt-4 border-t border-gray-800 flex items-center justify-between">
          <button
            onClick={() => onDelete(course.id)}
            className="text-red-500 hover:text-red-400 text-xs font-semibold flex items-center"
          >
            <SafeIcon icon={FiTrash2} className="w-3.5 h-3.5 mr-1.5" /> Delete
          </button>
          <Link
            to={manageLink || '#'}
            className="bg-transparent text-blue-500 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-900/10 transition-colors flex items-center border border-blue-900/30"
          >
            Manage <SafeIcon icon={FiArrowRight} className="w-3.5 h-3.5 ml-1.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default CourseCard;