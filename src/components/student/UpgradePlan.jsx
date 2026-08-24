import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import BrandName from '../../common/BrandName';
import { useAuth } from '../../contexts/AuthContext';
import { planService } from '../../services/api';

const { FiCheck, FiZap, FiStar, FiShield, FiCpu, FiBarChart2, FiBookOpen, FiClock, FiLoader, FiLock, FiHeadphones, FiAward } = FiIcons;

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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 p-8 text-center"
        >
          <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <SafeIcon icon={FiCheck} className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-4">Request Submitted!</h2>
          <p className="text-slate-400 mb-8 font-medium">
            Your payment alert has been sent to the Admin. Your plan will be upgraded to <span className="text-blue-400 font-black">PREMIUM</span> within 1 hour.
          </p>
          <button
            onClick={() => window.location.href = '/student'}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold hover:brightness-110 transition-all shadow-lg"
          >
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl -z-10" />

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-black uppercase tracking-widest mb-6 border border-blue-500/20"
          >
            <SafeIcon icon={FiClock} className="w-3.5 h-3.5" />
            Limited Time Offer
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight"
          >
            Elevate Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">SAT Journey</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto font-medium"
          >
            Unlock the full power of <BrandName />'s AI-driven platform and secure your spot in your dream college.
          </motion.p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free Plan */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-900/60 rounded-3xl p-8 border border-slate-800"
          >
            <h3 className="text-xl font-bold text-white mb-1">Free Plan</h3>
            <p className="text-slate-500 mb-8 text-sm font-medium">Basic starters content</p>

            <ul className="space-y-4 mb-10">
              <li className="flex items-center gap-3 text-sm text-slate-400 font-medium">
                <SafeIcon icon={FiCheck} className="text-slate-500 w-4 h-4 flex-shrink-0" />
                Limited Course Access
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-400 font-medium">
                <SafeIcon icon={FiCheck} className="text-slate-500 w-4 h-4 flex-shrink-0" />
                Top 5 Topics Only
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-400 font-medium">
                <SafeIcon icon={FiCheck} className="text-slate-500 w-4 h-4 flex-shrink-0" />
                2 Full-Length Tests
              </li>
            </ul>

            <button disabled className="w-full py-3.5 bg-slate-800 text-slate-500 rounded-2xl font-bold cursor-not-allowed text-sm">
              Current Plan
            </button>
          </motion.div>

          {/* Premium Plan */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-b from-slate-900 to-slate-900/80 rounded-3xl p-8 border-2 border-blue-500/60 shadow-[0_20px_60px_-15px_rgba(59,130,246,0.35)] relative"
          >
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                <SafeIcon icon={FiAward} className="w-3 h-3" />
                Most Popular
              </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-1 mt-2">Premium</h3>
            <p className="text-slate-400 mb-8 text-sm font-medium">Full AI-Powered experience</p>

            <ul className="space-y-3.5 mb-10">
              <li className="flex items-center gap-3 text-white font-semibold text-sm">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <SafeIcon icon={FiCheck} className="w-3 h-3 text-white" />
                </div>
                Everything in Free
              </li>
              {premiumFeatures.map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-300 font-medium text-sm">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <SafeIcon icon={FiCheck} className="w-3 h-3 text-blue-400" />
                  </div>
                  {f.title}
                </li>
              ))}
            </ul>

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white rounded-2xl font-black text-base transition-all shadow-lg flex items-center justify-center gap-2 group transform active:scale-95"
            >
              {loading ? <SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin" /> : <>Upgrade Now <SafeIcon icon={FiIcons.FiChevronRight} className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
            </button>
          </motion.div>
        </div>

        {/* Everything You Get With Premium */}
        <div className="mt-24">
          <h2 className="text-2xl sm:text-3xl font-black text-white text-center mb-12 tracking-tight">Everything You Get with Premium</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {premiumFeatures.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i }}
                className="flex flex-col items-start gap-3 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/40 transition-colors"
              >
                <div className="w-11 h-11 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <SafeIcon icon={feature.icon} className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{feature.title}</h4>
                  <p className="text-xs text-slate-400 mt-1">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mt-24">
          <h2 className="text-2xl sm:text-3xl font-black text-white text-center mb-10 tracking-tight">Compare <span className="text-blue-400">Plans</span></h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="py-5 px-5 text-xs font-black uppercase tracking-widest text-slate-500">Features</th>
                  <th className="py-5 px-5 text-center text-xs font-black uppercase tracking-widest text-slate-500 w-28">Free</th>
                  <th className="py-5 px-5 text-center text-xs font-black uppercase tracking-widest text-blue-400 w-28">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                <tr>
                  <td className="py-5 px-5 font-bold text-white text-sm">Full-Length Practice Tests</td>
                  <td className="py-5 px-5 text-center text-slate-400 font-medium text-sm">Max 2</td>
                  <td className="py-5 px-5 text-center text-blue-400 font-black text-sm">Up to 10</td>
                </tr>
                <tr>
                  <td className="py-5 px-5 font-bold text-white text-sm">Question Access</td>
                  <td className="py-5 px-5 text-center text-slate-400 font-medium text-sm">500 total</td>
                  <td className="py-5 px-5 text-center text-blue-400 font-black text-sm">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-5 px-5 font-bold text-white text-sm">AI Personal Tutor</td>
                  <td className="py-5 px-5 text-center"><SafeIcon icon={FiIcons.FiX} className="w-4 h-4 text-slate-600 mx-auto" /></td>
                  <td className="py-5 px-5 text-center"><SafeIcon icon={FiCheck} className="w-5 h-5 text-blue-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-5 px-5 font-bold text-white text-sm">Score Predictor</td>
                  <td className="py-5 px-5 text-center"><SafeIcon icon={FiIcons.FiX} className="w-4 h-4 text-slate-600 mx-auto" /></td>
                  <td className="py-5 px-5 text-center"><SafeIcon icon={FiCheck} className="w-5 h-5 text-blue-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-5 px-5 font-bold text-white text-sm">Advanced Analytics</td>
                  <td className="py-5 px-5 text-center"><SafeIcon icon={FiIcons.FiX} className="w-4 h-4 text-slate-600 mx-auto" /></td>
                  <td className="py-5 px-5 text-center"><SafeIcon icon={FiCheck} className="w-5 h-5 text-blue-400 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom CTA Banner */}
        <div className="mt-20 rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-6 justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0">
              <SafeIcon icon={FiBookOpen} className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-black text-lg sm:text-xl">Ready to take your SAT preparation further?</h3>
              <p className="text-blue-100 text-sm font-medium">Join thousands of students who are already improving their scores with Premium.</p>
            </div>
          </div>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="flex-shrink-0 bg-white text-blue-700 px-6 py-3.5 rounded-2xl font-black text-sm hover:bg-blue-50 transition-all shadow-lg flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? <SafeIcon icon={FiLoader} className="w-4 h-4 animate-spin" /> : <>Upgrade Now <SafeIcon icon={FiIcons.FiChevronRight} className="w-4 h-4" /></>}
          </button>
        </div>

        {/* Trust Footer */}
        <div className="mt-16 pt-8 border-t border-slate-800 text-center">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mb-6">
            <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
              <SafeIcon icon={FiShield} className="w-4 h-4 text-blue-400" />
              100% Satisfaction Guarantee
            </p>
            <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
              <SafeIcon icon={FiLock} className="w-4 h-4 text-blue-400" />
              Privacy Protected
            </p>
            <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
              <SafeIcon icon={FiHeadphones} className="w-4 h-4 text-blue-400" />
              Consult Anytime
            </p>
          </div>
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
