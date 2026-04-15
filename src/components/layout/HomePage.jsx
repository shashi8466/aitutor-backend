import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

import BrandName from '../../common/BrandName';


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
                <div className="h-10 md:h-12 w-auto max-w-[120px] md:max-w-[150px] flex items-center justify-center">
                  <img src={settings.logo_url || settings.logoUrl} alt="Logo" className="h-full w-auto object-contain rounded-[6px]" />
                </div>
              ) : (
                <div className="h-8 md:h-10 w-8 md:w-10 rounded-lg md:rounded-xl bg-black border border-white/20 flex items-center justify-center shadow-xl">
                   <span className="text-white font-black italic text-[10px] md:text-xs tracking-tighter">AI</span>
                </div>
              )}
              <div className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center">
                {settings.appName === 'Aiprep365' || settings.appName === 'AIPrep365' || !settings.appName ? <BrandName /> : settings.appName}
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
              {settings.hero_subtitle || <span><BrandName className="text-lg" /> helps students practice anytime, get instant feedback, target weak areas, and build confidence faster with AI-powered SAT prep.</span>}
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
              ["02", "Get a custom plan", <span key="step2"><BrandName className="text-base" /> builds a practice path based on your level, pace, and target score.</span>],
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

      <section id="pricing" className="scroll-mt-32 py-20 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="mx-auto max-w-[1500px] px-6 md:px-10 relative z-10">
          <div className="text-center mb-16">
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-xs md:text-sm font-black uppercase tracking-[0.4em] text-sky-500 mb-4"
            >
              Support Plans
            </motion.p>
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-5xl font-black text-white tracking-tight uppercase"
            >
              Choose your prep path
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-[40px] p-8 md:p-12 border border-white/5 bg-slate-900/20 backdrop-blur-xl hover:border-white/10 transition-all flex flex-col group"
            >
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🆓</span>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Free Plan</h3>
                </div>
                <p className="text-slate-400 font-bold text-sm tracking-wide">💡 Get Started – Best for beginners</p>
              </div>

              <ul className="space-y-5 mb-12 flex-1">
                {[
                  { icon: "📘", text: "250+ SAT Math questions" },
                  { icon: "📖", text: "250+ SAT Reading & Writing questions" },
                  { icon: "📝", text: "2 Full-Length Practice Tests" },
                  { icon: "⚡", text: "Basic practice access" },
                  { icon: "🔒", text: "Limited feature access" }
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-4 text-slate-300 font-semibold group-hover:text-white transition-colors">
                    <span className="text-lg opacity-80">{item.icon}</span>
                    <span className="text-sm md:text-base">{item.text}</span>
                  </li>
                ))}
              </ul>

              <button onClick={handleSignupClick} className="w-full py-5 rounded-2xl bg-white/5 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all border border-white/10 active:scale-[0.98]">
                Start Free
              </button>
            </motion.div>

            {/* Premium Plan */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-[40px] p-8 md:p-12 border border-orange-500/30 bg-orange-500/5 backdrop-blur-xl shadow-[0_30px_60px_-15px_rgba(249,115,22,0.15)] relative overflow-hidden flex flex-col group"
            >
              <div className="absolute top-0 right-0 p-3">
                <span className="bg-orange-500 text-slate-950 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-tighter">Most Popular</span>
              </div>
              
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">💎</span>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Premium Plan</h3>
                </div>
                <p className="text-orange-400 font-bold text-sm tracking-wide">🚀 Unlock Full Access – Best for serious students</p>
              </div>

              <ul className="space-y-5 mb-12 flex-1">
                {[
                  { icon: "🎯", text: "Full access to SAT, ACT & AP courses" },
                  { icon: "📚", text: "All subcourses and topics unlocked" },
                  { icon: "🔥", text: "Unlimited practice questions" },
                  { icon: "📝", text: "10 Full-Length Tests" },
                  { icon: "📊", text: "Advanced performance & analytics" },
                  { icon: "🤖", text: "AI Tutor & study resources" }
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-4 text-slate-200 font-semibold group-hover:text-white transition-colors">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm md:text-base">{item.text}</span>
                  </li>
                ))}
              </ul>

              <button onClick={handleSignupClick} className="w-full py-5 rounded-2xl bg-orange-500 text-slate-950 font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all shadow-xl shadow-orange-500/20 active:scale-[0.98]">
                Upgrade to Premium
              </button>
            </motion.div>
          </div>

          {/* Referral Section */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 max-w-5xl mx-auto"
          >
            <div className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-sky-500/5 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 group">
              <div className="absolute inset-0 bg-gradient-to-r from-sky-500/0 via-sky-500/5 to-sky-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-sky-500/20 flex items-center justify-center text-3xl shadow-lg ring-1 ring-sky-500/30">
                  🎁
                </div>
                <div>
                  <h4 className="text-xl font-black text-white uppercase tracking-tight mb-1">Invite & Earn Premium for Free!</h4>
                  <p className="text-sky-400 font-bold text-sm tracking-wide flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    Refer 3 friends and get a Premium subscription absolutely FREE
                  </p>
                </div>
              </div>

              <button onClick={handleSignupClick} className="relative z-10 px-8 py-3 rounded-xl bg-sky-500 text-slate-950 font-black text-[11px] uppercase tracking-widest hover:bg-sky-400 transition-all shadow-xl shadow-sky-500/20 active:scale-95">
                Share Referral
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-[40px] border border-white/5 bg-[#0f172a]/50 p-8 md:p-14 text-center shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
             {/* Subtle gradient glows */}
             <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[350px] h-[350px] bg-sky-500/5 rounded-full blur-[100px] pointer-events-none" />
             <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-orange-500/5 rounded-full blur-[100px] pointer-events-none" />

             <div className="relative z-10">
               <h2 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tight leading-[1.1]">
                 Ready to prep smarter with <br/>
                 <span className="text-sky-400">AIPrep365?</span>
               </h2>
               <p className="text-sm md:text-base text-slate-400 mb-8 max-w-xl mx-auto leading-relaxed font-semibold">
                 Join students and families looking for a faster, more personalized way to improve SAT performance.
               </p>
               <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                 <button 
                  onClick={handleStartPracticeClick}
                  className="w-full sm:w-auto px-10 py-4 rounded-2xl bg-orange-500 text-slate-950 font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all shadow-xl shadow-orange-500/10 active:scale-[0.98]"
                 >
                   Start Free Practice
                 </button>
                 <button 
                  onClick={handleBookDemoClick}
                  className="w-full sm:w-auto px-10 py-4 rounded-2xl border border-white/10 bg-slate-900/40 text-white font-black text-xs uppercase tracking-widest hover:bg-white/5 transition-all active:scale-[0.98] backdrop-blur-xl"
                 >
                   Schedule a Demo
                 </button>
               </div>
             </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 bg-[#020617] py-8 md:py-12">
        <div className="mx-auto max-w-[1500px] px-6 md:px-10 text-center">
          <p className="text-slate-500 text-xs md:text-sm font-medium leading-relaxed">
            © 2026 <BrandName className="text-xs" /> Powered by TestPrep Pundit. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AIPrep365LandingPage;