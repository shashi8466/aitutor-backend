import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

const { FiCheck, FiMenu, FiX } = FiIcons;

const AIPrep365LandingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleLoginClick = () => { navigate('/login'); };
  const handleSignupClick = () => { navigate('/signup'); };
  const handleStartPracticeClick = () => {
    if (user) navigate('/student');
    else navigate('/signup');
  };
  const handleBookDemoClick = () => { navigate('/contact'); };

  const handleScroll = (id) => {
    const element = document.getElementById(id);
    if (element) {
      setIsMobileMenuOpen(false);
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 25 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white transition-colors duration-300 overflow-x-hidden font-jakarta">
      
      {/* 🚀 FIXED HEADER */}
      <header className="fixed top-0 left-0 right-0 z-[100] p-3 md:p-4 lg:p-5 transition-all duration-300">
        <nav className="mx-auto flex max-w-[1500px] items-center justify-between rounded-[20px] md:rounded-[24px] border border-white/5 bg-slate-900/40 px-5 md:px-10 py-3 md:py-4 backdrop-blur-2xl shadow-2xl w-full">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 md:gap-4 group">
              {(settings.logo_url || settings.logoUrl) ? (
                <div className="h-7 md:h-8 w-auto max-w-[100px] md:max-w-[120px] flex items-center justify-center">
                  <img src={settings.logo_url || settings.logoUrl} alt="Logo" className="h-full w-auto object-contain" />
                </div>
              ) : (
                <div className="h-8 md:h-10 w-8 md:w-10 rounded-lg md:rounded-xl bg-black border border-white/20 flex items-center justify-center shadow-xl">
                   <span className="text-white font-black italic text-[10px] md:text-xs tracking-tighter">AI</span>
                </div>
              )}
              <div className="text-xl md:text-2xl font-black tracking-tight text-white">
                {settings.appName || 'Aiprep365'}
              </div>
            </Link>
          </div>

          <div className="hidden lg:flex items-center gap-10 text-sm font-semibold tracking-wide text-slate-400">
            {['FEATURES', 'RESULTS', 'HOW IT WORKS', 'PRICING'].map((item) => (
              <button key={item} onClick={() => handleScroll(item.toLowerCase().replace(' ', '-'))} className="hover:text-white transition-all uppercase">{item}</button>
            ))}
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden sm:flex items-center gap-3 md:gap-6">
              <button onClick={handleLoginClick} className="px-4 md:px-8 py-2 md:py-2.5 rounded-full border border-sky-500 text-sky-500 text-xs md:text-sm font-semibold tracking-wide hover:bg-sky-500/10 transition-all">LOGIN</button>
              <button onClick={handleSignupClick} className="px-4 md:px-8 py-2 md:py-2.5 rounded-full bg-orange-500 text-slate-950 text-xs md:text-sm font-bold tracking-wide hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-95">SIGN UP</button>
            </div>
            
            {/* Mobile Menu Button */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors"
            >
              {isMobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu Overlay */}
        <motion.div
          initial={false}
          animate={isMobileMenuOpen ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
          className="lg:hidden mt-3 overflow-hidden"
        >
          <div className="mx-auto max-w-[1500px] rounded-[24px] border border-white/5 bg-slate-900/90 p-6 backdrop-blur-2xl shadow-2xl space-y-6">
            <div className="flex flex-col gap-4">
              {['FEATURES', 'RESULTS', 'HOW IT WORKS', 'PRICING'].map((item) => (
                <button 
                  key={item} 
                  onClick={() => handleScroll(item.toLowerCase().replace(' ', '-'))}
                  className="text-left text-sm font-bold tracking-widest text-slate-400 hover:text-white uppercase py-2 border-b border-white/5"
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <button onClick={handleLoginClick} className="w-full py-4 rounded-2xl border border-sky-500 text-sky-500 text-xs font-black uppercase tracking-widest">Login</button>
              <button onClick={handleSignupClick} className="w-full py-4 rounded-2xl bg-orange-500 text-slate-950 text-xs font-black uppercase tracking-widest">Sign Up</button>
            </div>
          </div>
        </motion.div>
      </header>

      {/* ⚡ HERO SECTION */}
      <section id="hero" className="relative min-h-screen pt-32 md:pt-40 pb-16 md:pb-20 overflow-hidden flex items-center px-6 md:px-12 lg:px-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_40%),radial-gradient(circle_at_left,rgba(251,146,60,0.08),transparent_35%)]" />
        
        <div className="relative mx-auto max-w-[1500px] w-full grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          
          {/* Left Text Block */}
          <motion.div initial="hidden" animate="visible" variants={containerVariants} className="text-center lg:text-left">
            <motion.div variants={itemVariants} className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/5 px-4 py-1.5 text-[10px] font-bold tracking-widest text-sky-400 shadow-xl backdrop-blur-sm">
              <span className="text-orange-400">✨</span> Your AI Tutor. 365 Days.
            </motion.div>
            
            <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-8 font-sans">
              Smarter SAT prep with an <span className="text-sky-400">AI tutor</span> that never stops <span className="text-orange-500">teaching.</span>
            </motion.h1>
            
            <motion.p variants={itemVariants} className="mb-10 max-w-2xl text-lg leading-8 text-slate-300 mx-auto lg:mx-0">
              {settings.hero_subtitle || "AIPrep365 helps students practice anytime, get instant feedback, target weak areas, and build confidence faster with AI-powered SAT prep."}
            </motion.p>
            
            <motion.div variants={itemVariants} className="flex flex-wrap gap-5 justify-center lg:justify-start">
              <button onClick={handleStartPracticeClick} className="rounded-xl bg-orange-500 px-10 py-4 text-[12px] font-black uppercase tracking-widest text-slate-950 shadow-2xl shadow-orange-600/30 transition hover:bg-orange-600 hover:-translate-y-1 active:scale-95">Start Free Practice</button>
              <button onClick={handleBookDemoClick} className="rounded-xl border border-white/10 bg-white/5 px-10 py-4 text-[12px] font-black uppercase tracking-widest text-white backdrop-blur-xl transition-all hover:bg-white/10 hover:-translate-y-1 active:scale-95">Book a Demo</button>
            </motion.div>
            
            <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center lg:justify-start gap-8 text-[11px] font-black text-slate-500 uppercase mt-10">
              <div className="flex items-center gap-2">✅ INSTANT FEEDBACK</div>
              <div className="flex items-center gap-2">✅ PERSONALIZED LEARNING</div>
              <div className="flex items-center gap-2">✅ BUILT FOR SAT SUCCESS</div>
            </motion.div>
          </motion.div>

          {/* Right Dashboard Card */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.3 }} className="hidden lg:flex justify-end mt-0">
            <div className="bg-[#0f172a]/80 border border-white/5 rounded-[40px] p-8 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] relative overflow-hidden w-full max-w-[520px] backdrop-blur-3xl">
               <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-transparent to-orange-500/5 pointer-events-none" />
               
               <div className="relative z-10">
                 <div className="flex justify-between items-start mb-10">
                   <div>
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Student Dashboard</p>
                     <p className="text-xl font-black text-white leading-tight">Welcome back, future top scorer</p>
                   </div>
                   <div className="h-12 w-12 rounded-2xl bg-sky-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
                     <span className="text-2xl">🤖</span>
                   </div>
                 </div>

                 <div className="mb-6 grid grid-cols-2 gap-4">
                   <div className="rounded-2xl border border-white/5 bg-white/5 p-3">
                     <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Today's Goal</p>
                     <p className="text-2xl font-black text-sky-400">45 min</p>
                     <p className="text-[9px] text-slate-500">Adaptive SAT practice</p>
                   </div>
                   <div className="rounded-2xl border border-white/5 bg-white/5 p-3">
                     <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Projected Boost</p>
                     <p className="text-2xl font-black text-orange-500">+150</p>
                     <p className="text-[9px] text-slate-500">with consistent prep</p>
                   </div>
                 </div>

                 <div className="rounded-2xl border border-white/5 bg-white/5 p-5">
                   <div className="mb-4 flex items-center justify-between">
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Weak Areas Targeted</p>
                     <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[8px] font-bold text-sky-400 uppercase tracking-widest">AI Updated</span>
                   </div>
                   
                   <div className="space-y-4">
                     {[
                       { label: 'Heart of Algebra', val: 82, color: 'from-orange-400 to-orange-600' },
                       { label: 'Problem Solving & Data Analysis', val: 68, color: 'from-sky-400 to-sky-600' },
                       { label: 'Reading: Inference Questions', val: 74, color: 'from-blue-400 to-blue-600' }
                     ].map((skill, idx) => (
                       <div key={idx}>
                         <div className="mb-1.5 flex items-center justify-between">
                           <p className="text-[11px] font-bold text-slate-200">{skill.label}</p>
                           <p className="text-[11px] font-bold text-slate-500">{skill.val}%</p>
                         </div>
                         <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                           <motion.div initial={{ width: 0 }} whileInView={{ width: `${skill.val}%` }} className={`h-full bg-gradient-to-r ${skill.color}`} />
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>

                 <div className="mt-8 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
                   <p className="text-[11px] leading-relaxed font-bold text-white">
                     <span className="text-sky-400">AI Coach Tip:</span> Focus on multi-step algebra questions today to gain the fastest score improvement.
                   </p>
                 </div>
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="results" className="scroll-mt-32 border-y border-white/5 bg-slate-900/10 py-8 md:py-12">
        <div className="mx-auto grid max-w-[1500px] gap-4 md:gap-8 px-6 md:px-10 text-center sm:grid-cols-3">
          {[
            ["24/7", "AI tutoring support"],
            ["100–150+", "point improvement potential"],
            ["Personalized", "practice for every student"],
          ].map(([value, label]) => (
            <div key={value} className="rounded-3xl border border-white/5 bg-slate-900/40 p-6 md:p-8 hover:border-sky-500/20 transition-all">
              <div className="text-2xl md:text-3xl font-black text-orange-400">{value}</div>
              <div className="mt-2 text-slate-400 font-bold uppercase text-[9px] md:text-[10px] tracking-widest">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="scroll-mt-32 py-12 md:py-16">
        <div className="mx-auto max-w-[1500px] px-6 md:px-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants} className="mb-10 md:mb-12">
            <p className="text-[10px] md:text-sm font-black uppercase tracking-[0.4em] text-sky-500 mb-4">Features</p>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight uppercase">Everything students need to prep smarter</h2>
          </motion.div>
          
          <div className="grid gap-6 md:gap-8 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["🎯", "Adaptive Practice", "Questions and practice plans adjust to the student's performance in real time."],
              ["⚡", "Instant Feedback", "Students get explanations and corrections right away instead of waiting."],
              ["📊", "Performance Tracking", "Clear progress reports show what is improving and what needs more work."],
              ["🧠", "Weak Area Focus", "AI spots patterns and targets the exact skills hurting the score."],
            ].map(([icon, title, desc]) => (
              <motion.div 
                key={title} 
                initial={{ opacity: 0, y: 20 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true }} 
                className="rounded-[28px] md:rounded-[32px] border border-white/5 bg-slate-900/20 p-6 md:p-8 hover:bg-slate-900/40 transition-all hover:border-sky-500/20 group"
              >
                <div className="mb-4 md:mb-6 text-3xl md:text-4xl group-hover:scale-110 transition-transform">{icon}</div>
                <h3 className="text-xl font-black text-white mb-3 md:mb-4">{title}</h3>
                <p className="text-base md:text-lg leading-relaxed md:leading-8 text-slate-300">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-32 py-12 md:py-16 bg-slate-900/10">
        <div className="mx-auto max-w-[1500px] px-6 md:px-10">
          <div className="mb-10 md:mb-12 max-w-2xl text-center md:text-left">
            <p className="text-[10px] md:text-sm font-black uppercase tracking-[0.4em] text-orange-500 mb-4">How it works</p>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight uppercase">A simple path to higher scores</h2>
          </div>
          <div className="grid gap-6 md:gap-8 md:grid-cols-3">
            {[
              ["01", "Take a diagnostic", "Start with a quick assessment so the AI tutor understands current strengths and gaps."],
              ["02", "Get a custom plan", `${settings.appName || 'AIPrep365'} builds a practice path based on your level, pace, and target score.`],
              ["03", "Improve every week", "Practice daily, review feedback, and watch your confidence and score trend upward."],
            ].map(([num, title, desc]) => (
              <div key={num} className="rounded-[28px] md:rounded-[32px] border border-white/5 bg-slate-900/20 p-6 md:p-8 hover:bg-slate-900/40 transition-all">
                <div className="text-xs md:text-sm font-black tracking-[0.4em] text-sky-500 mb-4 md:mb-6">{num}</div>
                <h3 className="text-xl md:text-2xl font-black text-white mb-3 md:mb-4">{title}</h3>
                <p className="text-base md:text-lg leading-relaxed md:leading-8 text-slate-300">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-32 py-12 md:py-16">
        <div className="mx-auto max-w-[1500px] px-6 md:px-10">
          <div className="text-center mb-10 md:mb-12">
            <p className="text-[10px] md:text-sm font-black uppercase tracking-[0.4em] text-sky-500 mb-4">Plans</p>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase">Choose your prep path</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Starter', price: '49', features: ["AI practice access", "Daily study plan", "Basic progress tracking"] },
              { name: 'Pro', price: '99', features: ["Everything in Starter", "Advanced analytics", "Targeted weak-area drills"], popular: true },
              { name: 'Elite', price: '199', features: ["Everything in Pro", "Priority support", "Parent progress summaries"] }
            ].map((plan) => (
              <div key={plan.name} className={`rounded-[32px] md:rounded-[40px] p-8 md:p-10 border ${plan.popular ? 'border-orange-500/50 bg-slate-900/40 md:scale-105' : 'border-white/5 bg-slate-900/20'} relative`}>
                {plan.popular && <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-orange-500 text-slate-950 text-[9px] md:text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">Most Popular</span>}
                <h3 className="text-xl font-black text-white mb-4">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6 md:mb-8">
                  <span className="text-3xl font-black text-white">${plan.price}</span>
                  <span className="text-slate-500 font-bold uppercase tracking-widest text-[9px] md:text-[10px]">/mo</span>
                </div>
                <ul className="space-y-3 md:space-y-4 mb-8 md:mb-10">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-3 text-sm text-slate-400 font-medium">
                      <FiCheck className="text-sky-500" /> {f}
                    </li>
                  ))}
                </ul>
                <button onClick={handleSignupClick} className={`w-full py-4 rounded-2xl font-black text-[10px] md:text-[11px] uppercase tracking-widest transition-all ${plan.popular ? 'bg-orange-500 text-slate-950 hover:bg-orange-600' : 'bg-white/5 text-white hover:bg-white/10'}`}>Get Started</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 to-orange-500/10" />
        <div className="relative mx-auto max-w-[1500px] px-6 md:px-10 text-center">
          <h2 className="text-3xl md:text-5xl lg:text-7xl font-black text-white tracking-tight mb-6 uppercase">Ready to start?</h2>
          <p className="text-lg md:text-xl text-slate-400 mb-8 max-w-2xl mx-auto">Join thousands of students and baseline your SAT score today.</p>
          <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center">
             <button onClick={handleSignupClick} className="px-8 md:px-12 py-4 md:py-5 rounded-2xl bg-orange-500 text-slate-950 font-black uppercase text-[10px] md:text-[12px] tracking-widest hover:scale-105 transition-all">Start Free Practice</button>
             <button onClick={handleBookDemoClick} className="px-8 md:px-12 py-4 md:py-5 rounded-2xl bg-white/5 text-white font-black uppercase text-[10px] md:text-[12px] tracking-widest border border-white/10 hover:bg-white/10 transition-all">Book a Demo</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 bg-[#020617] py-8 md:py-12">
        <div className="mx-auto max-w-[1500px] px-6 md:px-10 text-center">
          <p className="text-slate-500 text-xs md:text-sm font-medium leading-relaxed">
            © 2026 Aiprep365 Powered by TestPrep Pundit. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AIPrep365LandingPage;