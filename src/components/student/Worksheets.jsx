import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiFileText, FiDownload, FiSearch, FiFilter, FiFolder } = FiIcons;

const Worksheets = () => {
  const [filter, setFilter] = useState('');

  // Mock Data
  const worksheets = [
    { id: 1, title: 'Algebra II Practice Set', topic: 'Math', level: 'Hard', size: '2.4 MB' },
    { id: 2, title: 'Grammar Rules Cheat Sheet', topic: 'Reading & Writing', level: 'Easy', size: '1.1 MB' },
    { id: 3, title: 'Geometry Formulas', topic: 'Math', level: 'Medium', size: '0.8 MB' },
    { id: 4, title: 'Reading Comprehension Drills', topic: 'Reading', level: 'Hard', size: '3.2 MB' },
    { id: 5, title: 'Full Practice Test #5', topic: 'Full Test', level: 'Mixed', size: '5.5 MB' },
  ];

  const filtered = worksheets.filter(w => w.title.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Worksheets Library</h1>
            <p className="text-gray-600 dark:text-gray-400">Extra practice materials curated for you.</p>
          </div>
          <div className="relative w-full md:w-80">
            <SafeIcon icon={FiSearch} className="absolute left-3 top-3.5 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search worksheets..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-[#E53935]">
                  <SafeIcon icon={FiFileText} className="w-6 h-6" />
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded border ${item.level === 'Hard' ? 'bg-red-50 text-red-700 border-red-100' :
                    item.level === 'Medium' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                      'bg-green-50 text-green-700 border-green-100'
                  }`}>
                  {item.level}
                </span>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">{item.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{item.topic} • {item.size}</p>

              <button className="w-full py-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-xl font-bold text-sm hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all flex items-center justify-center gap-2 group-hover:border-transparent">
                <SafeIcon icon={FiFileText} className="w-4 h-4" /> View Only
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Worksheets;