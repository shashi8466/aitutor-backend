import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

const { FiArrowRight, FiCpu, FiBarChart2, FiBookOpen, FiTarget, FiCheck, FiZap, FiStar, FiMail, FiUsers } = FiIcons;

const HomePage = () => {
  const { user } = useAuth();
  const { settings } = useSettings();

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.3 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="bg-white dark:bg-gray-900 overflow-x-hidden selection:bg-[#E53935] selection:text-white font-sans transition-colors duration-200">
      
      {/* 1. HERO SECTION */}
      <section className="relative min-h-screen flex items-center pt-10 pb-20 lg:pt-0 overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute -top-1/2 -right-1/2 w-[1000px] h-[1000px] bg-gradient-to-b from-red-50/50 to-transparent dark:from-red-900/20 dark:to-transparent rounded-full blur-3xl mix-blend-multiply dark:mix-blend-normal"
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            
            {/* LEFT: Text Content */}
            <motion.div initial="hidden" animate="visible" variants={containerVariants} className="text-center lg:text-left order-2 lg:order-1">
              <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 dark:bg-black border border-gray-800 dark:border-gray-700 text-white text-sm font-bold mb-6 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E53935] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E53935]"></span>
                </span>
                {settings.appName} v2.0
              </motion.div>

              <motion.h1 variants={itemVariants} className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-[#000000] dark:text-white tracking-tight leading-[1.1] mb-6">
                Master Any Subject with <br className="hidden lg:block"/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E53935] to-[#FF5722]">AI Personalized Tutoring</span>
              </motion.h1>

              <motion.p variants={itemVariants} className="text-lg text-[#333333] dark:text-gray-300 mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
                Experience the future of education with <strong>{settings.appName}</strong>. Our adaptive AI identifies your weak spots, explains complex concepts instantly, and helps you improve 3x faster than traditional methods.
              </motion.p>

              <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start w-full">
                {user ? (
                  <Link to={user.role === 'admin' ? '/admin' : '/student'} className="w-full sm:w-auto">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full px-8 py-4 bg-[#E53935] text-white rounded-2xl font-bold text-lg shadow-xl shadow-red-200 dark:shadow-red-900/20 hover:shadow-red-300 hover:bg-[#d32f2f] transition-all flex items-center justify-center gap-2">
                      Go to Dashboard <SafeIcon icon={FiArrowRight} />
                    </motion.button>
                  </Link>
                ) : (
                  <>
                    <Link to="/signup" className="w-full sm:w-auto">
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full px-8 py-4 bg-[#E53935] text-white rounded-2xl font-bold text-lg shadow-xl shadow-red-200 dark:shadow-red-900/20 hover:shadow-red-300 hover:bg-[#d32f2f] transition-all flex items-center justify-center">
                        Start Learning Free
                      </motion.button>
                    </Link>
                    <Link to="/contact" className="w-full sm:w-auto">
                      <motion.button whileHover={{ scale: 1.02, backgroundColor: '#f9fafb' }} whileTap={{ scale: 0.98 }} className="w-full px-8 py-4 bg-white dark:bg-gray-800 text-[#000000] dark:text-white border-2 border-gray-200 dark:border-gray-700 rounded-2xl font-bold text-lg hover:border-[#000000] dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2">
                        <SafeIcon icon={FiMail} className="w-5 h-5" /> Contact Us
                      </motion.button>
                    </Link>
                  </>
                )}
              </motion.div>
              
              <motion.div variants={itemVariants} className="mt-8 flex items-center justify-center lg:justify-start gap-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-900 bg-gray-200 flex items-center justify-center overflow-hidden">
                      <SafeIcon icon={FiUsers} className="w-4 h-4 text-gray-500" />
                    </div>
                  ))}
                </div>
                <p>Trusted by 10,000+ students</p>
              </motion.div>
            </motion.div>

            {/* RIGHT: Hero Image (Clean State) */}
            <div className="relative order-1 lg:order-2">
              <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white dark:border-gray-800">
                <img 
                  src="https://images.unsplash.com/photo-1531545514256-b1400bc00f31?auto=format&fit=crop&w=800&q=80" 
                  alt="Premium Student Learning" 
                  className="w-full h-[500px] object-cover" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>

              {/* Static Decorative Elements */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-400/20 rounded-full blur-2xl"></div>
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl"></div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. FEATURES GRID */}
      <section className="py-24 bg-[#FAFAFA] dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* NEW SECTION: AI Analysis Overlay (UPDATED TEXT) */}
          <div className="relative w-full max-w-5xl mx-auto mb-24 rounded-3xl overflow-hidden shadow-2xl bg-black transform hover:scale-[1.01] transition-transform duration-500 group">
            <img 
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80" 
              alt="AI Analysis Context" 
              className="w-full h-96 md:h-[450px] object-cover opacity-30 group-hover:opacity-20 transition-opacity duration-500" 
            />
            {/* Dark Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent"></div>

            <div className="absolute inset-0 flex flex-col justify-center p-8 md:p-12">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="max-w-2xl"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E53935]/20 text-[#E53935] border border-[#E53935]/30 text-xs font-bold uppercase tracking-wider mb-4 backdrop-blur-sm">
                  <SafeIcon icon={FiCpu} className="w-4 h-4" /> AI Powered
                </div>
                
                <h3 className="text-4xl md:text-5xl font-extrabold text-white mb-8 tracking-tight">
                  Adaptive Tutor
                </h3>
                
                <div className="space-y-5">
                  {[
                    "Analyzing learning patterns in real time",
                    "Personalized concept explanations for better understanding",
                    "Smart practice questions generated automatically",
                    "Learning gaps and weaknesses identified with precision"
                  ].map((text, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + (i * 0.1) }}
                      className="flex items-start gap-4 group/item"
                    >
                      <div className="mt-1 w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 border border-green-500/30 group-hover/item:bg-green-500/40 transition-colors">
                        <SafeIcon icon={FiCheck} className="w-3.5 h-3.5 text-green-400" />
                      </div>
                      <span className="text-lg font-medium text-gray-200 group-hover/item:text-white transition-colors">
                        {text}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.span initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-[#E53935] font-bold tracking-wider uppercase text-sm bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full">
              Why Choose Us
            </motion.span>
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="mt-6 text-3xl md:text-4xl font-extrabold text-[#000000] dark:text-white">
              Everything you need to excel in your career
            </motion.h2>
          </div>

          <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[ 
              { icon: FiCpu, title: "AI Personal Tutor", desc: "Get instant, step-by-step explanations for any question. It's like having a senior developer in your pocket 24/7." },
              { icon: FiTarget, title: "Adaptive Quizzes", desc: "Our system learns your weak spots and generates questions specifically designed to improve them." },
              { icon: FiBarChart2, title: "Smart Analytics", desc: "Visualise your learning journey. Track improvement, study time, and mastery of specific topics." }
            ].map((feature, idx) => (
              <motion.div key={idx} variants={itemVariants} whileHover={{ y: -10 }} className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 dark:bg-gray-700 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 group-hover:bg-[#E53935]/10"></div>
                <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-6 relative z-10 group-hover:bg-[#E53935] transition-colors duration-300 shadow-sm">
                  <SafeIcon icon={feature.icon} className="w-7 h-7 text-[#E53935] group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-xl font-bold text-[#000000] dark:text-white mb-3 relative z-10">{feature.title}</h3>
                <p className="text-[#333333] dark:text-gray-300 leading-relaxed relative z-10">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 3. CTA SECTION */}
      <section className="py-24 relative overflow-hidden bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-[#E53935] rounded-3xl p-12 md:p-16 shadow-2xl shadow-red-900/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-20">
              <div className="absolute right-0 top-0 w-64 h-64 bg-black rounded-full mix-blend-overlay filter blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute left-0 bottom-0 w-64 h-64 bg-black rounded-full mix-blend-overlay filter blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 relative z-10">Ready to boost your career?</h2>
            <p className="text-white/90 text-lg md:text-xl max-w-2xl mx-auto mb-10 relative z-10 font-medium">
              Join thousands of students who are already mastering their subjects with <strong>{settings.appName}</strong>.
            </p>
            
            <div className="relative z-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-8 py-4 bg-black text-white rounded-xl font-bold text-lg shadow-lg hover:bg-gray-900 transition-colors w-full sm:w-auto border border-gray-800">
                  Get Started for Free
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-6 w-6 object-contain" />
            ) : (
              <div className="bg-[#E53935] p-2 rounded-lg">
                <SafeIcon icon={FiBookOpen} className="w-5 h-5 text-white" />
              </div>
            )}
            <span className="text-xl font-bold text-[#000000] dark:text-white">{settings.appName}</span>
          </div>
          <div className="text-[#333333] dark:text-gray-400 text-sm">
            Copyright &copy; {new Date().getFullYear()} | Gigatech Global Services Private Limited
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-gray-400 hover:text-[#E53935] transition-colors"><SafeIcon icon={FiZap} /></a>
            <a href="#" className="text-gray-400 hover:text-[#E53935] transition-colors"><SafeIcon icon={FiStar} /></a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;