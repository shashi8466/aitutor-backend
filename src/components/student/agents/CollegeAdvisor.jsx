import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';

const { FiMapPin, FiAward, FiBookOpen, FiSearch, FiArrowRight } = FiIcons;

const CollegeAdvisor = () => {
  const [score, setScore] = useState('1350');
  const [major, setMajor] = useState('');
  const [results, setResults] = useState(null);

  const handleSearch = () => {
    // Mock AI Logic
    setResults({
      reach: ["NYU", "Boston University", "USC"],
      target: ["Penn State", "Ohio State", "Rutgers"],
      safety: ["Temple University", "Arizona State"]
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-16">
        <div>
          <span className="text-[#E53935] font-bold uppercase tracking-wider text-xs mb-2 block">Feature 10: Expansion</span>
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight">
            From SAT Score to <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E53935] to-orange-500">Dream College</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-8">
            Don't just prep for the test. Prep for your future. Our AI analyzes your score potential and matches you with the best fit universities and majors.
          </p>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Projected SAT Score</label>
              <input
                type="number"
                value={score}
                onChange={e => setScore(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none font-bold text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Intended Major</label>
              <input
                type="text"
                value={major}
                onChange={e => setMajor(e.target.value)}
                placeholder="e.g. Computer Science, Pre-Med..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
            <button
              onClick={handleSearch}
              className="w-full py-3 bg-[#E53935] text-white rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <SafeIcon icon={FiSearch} /> Find My Colleges
            </button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 rounded-full blur-3xl"></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-xl mb-6 flex items-center gap-2">
              <SafeIcon icon={FiMapPin} className="text-blue-500" /> Your Roadmap
            </h3>

            {results ? (
              <div className="space-y-6 animate-fade-in">
                <CategoryBox title="Reach Schools" schools={results.reach} color="bg-red-100 text-red-800" />
                <CategoryBox title="Target Schools" schools={results.target} color="bg-blue-100 text-blue-800" />
                <CategoryBox title="Safety Schools" schools={results.safety} color="bg-green-100 text-green-800" />
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <SafeIcon icon={FiBookOpen} className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Enter your details to generate report.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CategoryBox = ({ title, schools, color }) => (
  <div>
    <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-3 ${color}`}>{title}</div>
    <div className="space-y-2">
      {schools.map((s, i) => (
        <div key={i} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700">
          <span className="font-medium text-gray-800 dark:text-gray-200">{s}</span>
          <SafeIcon icon={FiArrowRight} className="text-gray-400 w-4 h-4" />
        </div>
      ))}
    </div>
  </div>
);

export default CollegeAdvisor;