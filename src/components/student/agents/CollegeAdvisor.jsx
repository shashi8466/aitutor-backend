import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';

const { FiMapPin, FiAward, FiBookOpen, FiSearch, FiArrowRight, FiCheckCircle } = FiIcons;

const CollegeAdvisor = () => {
  const [score, setScore] = useState('1350');
  const [major, setMajor] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const handleSearch = () => {
    const numericScore = parseInt(score, 10);
    if (isNaN(numericScore) || numericScore < 400 || numericScore > 1600) {
      setError('Please enter a valid SAT score between 400 and 1600.');
      setResults(null);
      return;
    }
    setError('');

    const categories = {
      dream: {
        title: 'Dream / Top-Tier Universities',
        range: 'SAT 1450–1600',
        typical: 'Typical Range: 1480–1580+',
        colleges: [
          'Harvard University',
          'Stanford University',
          'Massachusetts Institute of Technology (MIT)',
          'Princeton University',
          'Yale University',
          'Columbia University',
          'University of Pennsylvania',
          'Cornell University',
          'Duke University',
          'Brown University',
          'Dartmouth College',
          'California Institute of Technology (Caltech)',
          'University of Chicago',
          'Johns Hopkins University',
          'Northwestern University'
        ],
        theme: {
          bg: 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/20 dark:border-rose-500/30',
          text: 'text-rose-600 dark:text-rose-400',
          badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
        }
      },
      strong_match: {
        title: 'Strong Match Universities',
        range: 'SAT 1300–1500',
        typical: 'Typical Range: 1320–1520',
        colleges: [
          'New York University (NYU)',
          'Boston University',
          'University of Michigan',
          'Georgia Institute of Technology',
          'Purdue University',
          'University of Illinois Urbana–Champaign',
          'University of Wisconsin–Madison',
          'Pennsylvania State University',
          'University of Texas at Austin',
          'University of Maryland',
          'University of Florida',
          'University of Washington',
          'Northeastern University',
          'Rice University',
          'Carnegie Mellon University'
        ],
        theme: {
          bg: 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500/20 dark:border-indigo-500/30',
          text: 'text-indigo-600 dark:text-indigo-400',
          badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300'
        }
      },
      good_scholarship: {
        title: 'Good Universities with Scholarships',
        range: 'SAT 1150–1400',
        typical: 'Typical Range: 1100–1400',
        colleges: [
          'Arizona State University',
          'Michigan State University',
          'University of South Florida',
          'University of Arizona',
          'Texas A&M University',
          'Indiana University Bloomington',
          'University of Cincinnati',
          'Florida State University',
          'University of Colorado Boulder',
          'Rutgers University',
          'Stony Brook University',
          'University of Minnesota',
          'George Mason University',
          'Oregon State University',
          'University of Alabama'
        ],
        theme: {
          bg: 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 dark:border-emerald-500/30',
          text: 'text-emerald-600 dark:text-emerald-400',
          badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
        }
      },
      safe: {
        title: 'Safe Universities / Easier Admission',
        range: 'SAT 950–1250',
        typical: 'Typical Range: 950–1250',
        colleges: [
          'University of North Texas',
          'Texas State University',
          'Wichita State University',
          'Kent State University',
          'University of Toledo',
          'Cleveland State University',
          'Middle Tennessee State University',
          'New Mexico State University',
          'University of Texas at El Paso'
        ],
        theme: {
          bg: 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20 dark:border-amber-500/30',
          text: 'text-amber-600 dark:text-amber-400',
          badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
        }
      },
      below_900: {
        title: 'USA Colleges for SAT Below 900',
        range: 'SAT Below 900',
        typical: 'Typical Range: Below 900',
        colleges: [
          'University of Texas at El Paso',
          'Texas A&M University–Kingsville',
          'Chicago State University',
          'University of Arkansas at Pine Bluff',
          'University of Central Missouri',
          'Kentucky State University',
          'Mississippi Valley State University',
          'Southern University and A&M College',
          'University of Maine at Presque Isle',
          'Wichita State University'
        ],
        theme: {
          bg: 'bg-teal-500/5 dark:bg-teal-500/10 border-teal-500/20 dark:border-teal-500/30',
          text: 'text-teal-600 dark:text-teal-400',
          badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300'
        }
      }
    };

    let selected = [];
    if (numericScore >= 1450) {
      selected = [
        { ...categories.dream, label: 'Dream / Reach' },
        { ...categories.strong_match, label: 'Target / Match' },
        { ...categories.good_scholarship, label: 'Safety / Scholarship' }
      ];
    } else if (numericScore >= 1300) {
      selected = [
        { ...categories.dream, label: 'Dream / Reach' },
        { ...categories.strong_match, label: 'Target / Match' },
        { ...categories.good_scholarship, label: 'Safety / Scholarship' }
      ];
    } else if (numericScore >= 1150) {
      selected = [
        { ...categories.strong_match, label: 'Dream / Reach' },
        { ...categories.good_scholarship, label: 'Target / Match' },
        { ...categories.safe, label: 'Safety' }
      ];
    } else if (numericScore >= 950) {
      selected = [
        { ...categories.good_scholarship, label: 'Dream / Reach' },
        { ...categories.safe, label: 'Target / Match' },
        { ...categories.below_900, label: 'Safety' }
      ];
    } else {
      selected = [
        { ...categories.safe, label: 'Dream / Reach' },
        { ...categories.below_900, label: 'Target / Safety' }
      ];
    }

    setResults(selected);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start mb-16">
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
                min="400"
                max="1600"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none font-bold text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {error && <p className="text-[#E53935] text-xs mt-1 font-semibold">{error}</p>}
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

        <div className="relative w-full">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-2xl border border-gray-100 dark:border-gray-700/80">
            <h3 className="font-bold text-xl mb-6 flex items-center gap-2 text-gray-900 dark:text-white">
              <SafeIcon icon={FiMapPin} className="text-[#E53935] w-5 h-5 animate-pulse" /> Your Roadmap
            </h3>

            <AnimatePresence mode="wait">
              {results ? (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6 max-h-[520px] overflow-y-auto pr-2 custom-scrollbar"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {major && (
                    <div className="p-3 bg-red-500/5 dark:bg-red-500/10 border border-red-500/10 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                      <SafeIcon icon={FiCheckCircle} className="text-[#E53935]" />
                      Tailoring recommendations for <span className="text-[#E53935] font-bold">{major}</span>
                    </div>
                  )}
                  {results.map((category, idx) => (
                    <CategoryBox
                      key={idx}
                      title={category.title}
                      range={category.range}
                      typical={category.typical}
                      label={category.label}
                      schools={category.colleges}
                      theme={category.theme}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-16 text-gray-400 dark:text-gray-500"
                >
                  <SafeIcon icon={FiBookOpen} className="w-16 h-16 mx-auto mb-4 opacity-30 text-[#E53935]" />
                  <p className="font-medium text-gray-600 dark:text-gray-400">Enter your details to generate report.</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Get target, reach, and safety recommendations based on your score</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

const CategoryBox = ({ title, range, typical, label, schools, theme }) => (
  <div className={`p-4 rounded-2xl border ${theme.bg} transition-all duration-300 hover:shadow-md`}>
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <div>
        <h4 className={`font-extrabold text-base text-gray-900 dark:text-white`}>
          {title}
        </h4>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300">
            {range}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#E53935]/10 text-[#E53935]">
            {typical}
          </span>
        </div>
      </div>
      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wider uppercase ${theme.badge}`}>
        {label}
      </span>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
      {schools.map((school, i) => (
        <motion.div
          key={i}
          whileHover={{ scale: 1.02, x: 2 }}
          className="flex items-center justify-between p-2.5 bg-white/70 dark:bg-gray-900/60 rounded-xl border border-gray-100 dark:border-gray-800/80 hover:border-gray-200 dark:hover:border-gray-700/80 transition-all shadow-sm"
        >
          <div className="flex items-center gap-2 truncate">
            <SafeIcon icon={FiAward} className={`w-3.5 h-3.5 flex-shrink-0 ${theme.text}`} />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">{school}</span>
          </div>
          <SafeIcon icon={FiArrowRight} className="text-gray-400 dark:text-gray-600 w-3 h-3 flex-shrink-0" />
        </motion.div>
      ))}
    </div>
  </div>
);

export default CollegeAdvisor;