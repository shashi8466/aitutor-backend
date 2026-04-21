import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import BrandName from '../../common/BrandName';
import { useAuth } from '../../contexts/AuthContext';
import { planService } from '../../services/api';

const { FiCheck, FiZap, FiStar, FiShield, FiCpu, FiBarChart2, FiBookOpen, FiClock, FiLoader } = FiIcons;

const UpgradePlan = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      // Simulate/Implement upgrade request
      await planService.requestUpgrade(user.id);
      setSuccess(true);
    } catch (err) {
      console.error('Upgrade failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const premiumFeatures = [
    { icon: FiCpu, title: '24/7 Personal AI Tutor', desc: 'Unlimited assistance and quiz generation.' },
    { icon: FiBarChart2, title: 'Advanced Analytics', desc: 'Deep insights into your performance & trends.' },
    { icon: FiStar, title: 'Score Predictor', desc: 'Know your SAT score before the actual test.' },
    { icon: FiBookOpen, title: 'Full Content Library', desc: 'All courses and topics unlocked permanently.' },
    { icon: FiShield, title: 'Full Practice Tests', desc: 'Access to 10+ full-length computer-based tests.' },
    { icon: FiZap, title: 'Weakness Drills', desc: 'AI-powered drills targeting your weak areas.' },
  ];

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <SafeIcon icon={FiCheck} className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Request Submitted!</h2>
          <p className="text-gray-600 mb-8 font-medium">
            Your payment alert has been sent to the Admin. Your plan will be upgraded to <span className="text-[#E53935] font-black">PREMIUM</span> within 1 hour.
          </p>
          <button 
            onClick={() => window.location.href = '/student'}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-lg"
          >
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-6 md:p-12 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-100/30 dark:bg-red-900/10 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-100/30 dark:bg-blue-900/10 rounded-full blur-3xl -z-10" />

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 dark:bg-red-900/30 text-[#E53935] text-xs font-black uppercase tracking-widest mb-6 border border-red-100 dark:border-red-800"
          >
            <SafeIcon icon={FiZap} className="w-3.5 h-3.5" />
            Limited Time Offer
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white mb-6 tracking-tight"
          >
            Elevate Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E53935] to-[#D32F2F]">SAT Journey</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto font-medium"
          >
            Unlock the full power of <BrandName />'s AI-driven platform and secure your spot in your dream college.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          {/* Free Plan */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-xl opacity-60"
          >
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Free Plan</h3>
            <p className="text-gray-500 mb-6 font-medium">Basic starters content</p>
            <div className="text-4xl font-black text-gray-900 dark:text-white mb-8">₹0<span className="text-sm text-gray-400 font-bold ml-1">/forever</span></div>
            
            <ul className="space-y-4 mb-10">
              <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 font-medium">
                <SafeIcon icon={FiCheck} className="text-green-500 w-5 h-5 flex-shrink-0" />
                Limited Course Access
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 font-medium">
                <SafeIcon icon={FiCheck} className="text-green-500 w-5 h-5 flex-shrink-0" />
                Top 5 Topics Only
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 font-medium">
                <SafeIcon icon={FiCheck} className="text-green-500 w-5 h-5 flex-shrink-0" />
                2 Full-Length Tests
              </li>
            </ul>
            
            <button disabled className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-2xl font-bold cursor-not-allowed uppercase tracking-widest text-xs">
              Current Plan
            </button>
          </motion.div>

          {/* Premium Plan */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-900 dark:bg-black rounded-[40px] p-10 border-4 border-[#E53935] shadow-[0_20px_60px_-15px_rgba(229,57,53,0.3)] relative scale-110 z-10"
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#E53935] to-[#D32F2F] text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-[0.2em] shadow-xl">
              Most Popular
            </div>
            
            <h3 className="text-3xl font-black text-white mb-2">Premium</h3>
            <p className="text-gray-400 mb-6 font-medium">Full AI-Powered experience</p>
            <div className="flex items-baseline gap-1 mb-8">
              <span className="text-5xl font-black text-white">₹1999</span>
              <span className="text-lg text-gray-400 font-bold">/year</span>
            </div>
            
            <ul className="space-y-4 mb-12">
              <li className="flex items-center gap-4 text-white font-bold">
                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                  <SafeIcon icon={FiCheck} className="w-3.5 h-3.5" />
                </div>
                Everything in Free
              </li>
              {premiumFeatures.slice(0, 4).map((f, i) => (
                <li key={i} className="flex items-center gap-4 text-gray-300 font-medium">
                  <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <SafeIcon icon={FiCheck} className="w-3.5 h-3.5" />
                  </div>
                  {f.title}
                </li>
              ))}
            </ul>
            
            <button 
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-5 bg-[#E53935] hover:bg-[#D32F2F] text-white rounded-[20px] font-black text-lg transition-all shadow-2xl flex items-center justify-center gap-2 group transform active:scale-95"
            >
              {loading ? <SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin" /> : <>Upgrade Now <SafeIcon icon={FiIcons.FiChevronRight} className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
            </button>
            <p className="text-center text-[10px] text-gray-500 mt-4 font-bold uppercase tracking-widest">Secure checkout enabled</p>
          </motion.div>

          {/* Features Grid */}
          <div className="lg:col-span-1 hidden lg:block">
            <div className="space-y-6">
              {premiumFeatures.map((feature, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + (i * 0.1) }}
                  className="flex gap-4 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <SafeIcon icon={feature.icon} className="w-6 h-6 text-[#E53935]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">{feature.title}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mt-32">
          <h2 className="text-3xl font-black text-gray-900 dark:text-white text-center mb-12 tracking-tight">Compare <span className="text-[#E53935]">Plans</span></h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-100 dark:border-gray-800">
                  <th className="py-6 px-4 text-sm font-black uppercase tracking-widest text-gray-400">Features</th>
                  <th className="py-6 px-4 text-center text-sm font-black uppercase tracking-widest text-gray-400 w-32">Free</th>
                  <th className="py-6 px-4 text-center text-sm font-black uppercase tracking-widest text-[#E53935] w-32">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-900">
                <tr>
                  <td className="py-6 px-4 font-bold text-gray-900 dark:text-white">Full-Length Practice Tests</td>
                  <td className="py-6 px-4 text-center text-gray-600 dark:text-gray-400 font-medium">Max 2</td>
                  <td className="py-6 px-4 text-center text-[#E53935] font-black">Up to 10</td>
                </tr>
                <tr>
                  <td className="py-6 px-4 font-bold text-gray-900 dark:text-white">Question Access</td>
                  <td className="py-6 px-4 text-center text-gray-600 dark:text-gray-400 font-medium">500 total</td>
                  <td className="py-6 px-4 text-center text-[#E53935] font-black">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-6 px-4 font-bold text-gray-900 dark:text-white">AI Personal Tutor</td>
                  <td className="py-6 px-4 text-center"><SafeIcon icon={FiIcons.FiX} className="w-5 h-5 text-gray-300 mx-auto" /></td>
                  <td className="py-6 px-4 text-center"><SafeIcon icon={FiCheck} className="w-6 h-6 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-6 px-4 font-bold text-gray-900 dark:text-white">Score Predictor</td>
                  <td className="py-6 px-4 text-center"><SafeIcon icon={FiIcons.FiX} className="w-5 h-5 text-gray-300 mx-auto" /></td>
                  <td className="py-6 px-4 text-center"><SafeIcon icon={FiCheck} className="w-6 h-6 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-6 px-4 font-bold text-gray-900 dark:text-white">Advanced Analytics</td>
                  <td className="py-6 px-4 text-center"><SafeIcon icon={FiIcons.FiX} className="w-5 h-5 text-gray-300 mx-auto" /></td>
                  <td className="py-6 px-4 text-center"><SafeIcon icon={FiCheck} className="w-6 h-6 text-green-500 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-20 border-t border-gray-100 dark:border-gray-800 pt-10 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-4 flex items-center justify-center gap-2">
                <SafeIcon icon={FiShield} className="w-4 h-4" /> 
                100% Satisfaction Guarantee. Payment verified by Admin manually.
            </p>
            <div className="flex justify-center gap-6 opacity-40 grayscale">
                <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" className="h-6" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-4" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-6" />
            </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradePlan;
