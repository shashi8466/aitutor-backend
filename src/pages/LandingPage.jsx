import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSettings } from "../contexts/SettingsContext";
import * as FiIcons from "react-icons/fi";
import SafeIcon from "../common/SafeIcon";
import { motion, AnimatePresence } from "framer-motion";

import BrandName from '../common/BrandName';


const { FiSun, FiMoon, FiMenu, FiX, FiCheck, FiArrowRight, FiPlay, FiStar, FiZap, FiTarget, FiMessageSquare, FiTrendingUp, FiActivity, FiCpu, FiShield, FiGlobe, FiDatabase, FiAward, FiPieChart } = FiIcons;

export default function LandingPage() {
  const { settings } = useSettings();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const siteConfig = useMemo(() => {
    const appName = settings.appName || "Aiprep365";
    return {
      appName,
      tagline: "Smarter SAT prep with an AI tutor that never stops teaching.",
      logoUrl: settings.logoUrl || "/logo.png",
      primaryCtaLink: "/signup",
      demoLink: "/contact",
    };
  }, [settings]);

  return (
    <div className="min-h-screen bg-[#030711] text-white selection:bg-red-500/30 selection:text-red-400 font-sans overflow-x-hidden">
      
      {/* Cinematic Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-red-600/5 rounded-full blur-[150px] opacity-40 animate-pulse" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-red-600/5 rounded-full blur-[150px] opacity-30" />
      </div>

      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'py-4' : 'py-8'}`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className={`flex items-center justify-between rounded-full border border-white/5 bg-[#0a0f1d]/80 px-8 py-3 backdrop-blur-xl shadow-2xl transition-all ${scrolled ? 'scale-95' : 'scale-100'}`}>
             <Link to="/" className="flex items-center gap-4 group">
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-black shadow-2xl border border-white/5 group-hover:scale-105 transition-transform">
                   <span className="text-white font-black italic text-xs">AI</span>
                </div>
                <span className="text-xl font-black text-white tracking-tighter uppercase group-hover:text-red-500 transition-colors">{siteConfig.appName}</span>
             </Link>

             <div className="hidden md:flex items-center gap-10">
                {["Features", "Results", "How-it-works", "Pricing"].map((link) => (
                   <a key={link} href={`#${link}`} className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-all">
                      {link.replace(/-/g, ' ')}
                   </a>
                ))}
             </div>

             <div className="flex items-center gap-4">
                <Link to="/login" className="hidden md:block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-red-500 transition-colors">Login</Link>
                <Link 
                  to="/signup" 
                  className="px-6 py-2.5 bg-red-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-red-950/40 hover:bg-red-700 transition-all active:scale-95"
                >
                  Sign Up
                </Link>
             </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-60 pb-32 lg:pt-72 lg:pb-60 z-10">
         <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-12 gap-16 items-center">
               
               <motion.div 
                 initial={{ opacity: 0, x: -50 }} 
                 animate={{ opacity: 1, x: 0 }} 
                 className="lg:col-span-6"
               >
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-600/10 border border-red-600/20 text-[10px] font-black uppercase tracking-widest mb-8 text-red-500 shadow-xl">
                     <span>✨</span> Your AI Tutor. 365 Days.
                  </div>
                  <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.1] tracking-tighter uppercase mb-8">
                     Smarter SAT prep with an <br />
                     <BrandName className="text-5xl md:text-7xl italic" /> that never stops teaching.
                  </h1>
                  <p className="text-slate-400 text-lg md:text-xl font-medium leading-relaxed max-w-xl mb-12">
                     Aiprep365 helps students practice anytime, get instant feedback, target weak areas, and build confidence faster with AI-powered SAT prep.
                  </p>
                  <div className="flex flex-wrap gap-6">
                     <Link to="/signup" className="btn-primary">
                        Start Free Practice
                     </Link>
                     <Link to="/contact" className="px-10 py-4 bg-[#0a0f1d] border border-white/5 text-white rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-[#111827] transition-all">
                        Book a Demo
                     </Link>
                  </div>
                  <div className="mt-12 flex flex-wrap gap-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <div className="flex items-center gap-2"><FiCheck className="text-red-500" /> Instant feedback</div>
                    <div className="flex items-center gap-2"><FiCheck className="text-red-500" /> Personalized learning</div>
                    <div className="flex items-center gap-2"><FiCheck className="text-red-500" /> Built for SAT success</div>
                  </div>
               </motion.div>

               <motion.div 
                 initial={{ opacity: 0, scale: 0.9 }} 
                 animate={{ opacity: 1, scale: 1 }} 
                 className="lg:col-span-6"
               >
                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[40px] p-10 shadow-2xl relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-bl-[100px] pointer-events-none" />
                     
                     <div className="flex justify-between items-center mb-10">
                        <div>
                           <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Student Dashboard</p>
                           <h3 className="text-2xl font-black italic tracking-tighter text-white">Welcome back, future top scorer</h3>
                        </div>
                        <div className="h-16 w-16 rounded-2xl bg-red-600 flex items-center justify-center text-white text-3xl shadow-2xl">🤖</div>
                     </div>

                     <div className="grid grid-cols-2 gap-6 mb-8">
                        <div className="bg-[#030711] p-6 rounded-3xl border border-white/5">
                           <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Today's Goal</p>
                           <p className="text-3xl font-black text-red-600 italic tracking-tighter">45 min</p>
                        </div>
                        <div className="bg-[#030711] p-6 rounded-3xl border border-white/5">
                           <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Projected Boost</p>
                           <p className="text-3xl font-black text-red-600 italic tracking-tighter">+150</p>
                        </div>
                     </div>

                     <div className="bg-[#030711] p-8 rounded-3xl border border-white/5 space-y-6">
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-[10px] font-black text-white uppercase tracking-widest italic">Reading & Writing Progress</span>
                           <span className="text-[10px] font-black text-red-500 uppercase">78%</span>
                        </div>
                        <div className="h-2 bg-[#0a0f1d] rounded-full overflow-hidden">
                           <div className="h-full bg-red-600 rounded-full" style={{ width: '78%' }} />
                        </div>
                     </div>

                     <div className="mt-8 p-5 bg-red-600/5 border border-red-600/20 rounded-2xl text-[10px] font-bold text-slate-300 italic uppercase tracking-widest text-center">
                        <span className="text-red-500 font-black">AI Coach Tip:</span> Focus on multi-step algebra questions today.
                     </div>
                  </div>
               </motion.div>
            </div>
         </div>
      </section>

      {/* Stats Grid */}
      <section id="results" className="py-24 border-y border-white/5 bg-[#0a0f1d]/50">
         <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8 text-center">
            {[
              { val: "24/7", lbl: "AI tutoring support" },
              { val: "100-150+", lbl: "point improvement potential" },
              { val: "Personalized", lbl: "practice for every student" }
            ].map((stat, i) => (
               <div key={i} className="bg-[#030711] p-10 rounded-[32px] border border-white/5 shadow-2xl">
                  <div className="text-4xl font-black text-red-600 italic tracking-tighter mb-2 uppercase">{stat.val}</div>
                  <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{stat.lbl}</div>
               </div>
            ))}
         </div>
      </section>

      {/* Features */}
      <section id="features" className="py-32 bg-[#030711]">
         <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-24">
               <span className="text-red-500 text-[11px] font-black uppercase tracking-[0.4em] mb-6 inline-block">Parameters</span>
               <h2 className="text-4xl md:text-6xl font-black text-white italic tracking-tighter uppercase">Everything students need to prepare smarter</h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
               {[
                 { icon: "🎯", title: "Adaptive Practice", desc: "Questions and practice plans adjust to the student’s performance in real time." },
                 { icon: "⚡", title: "Instant Feedback", desc: "Students get explanations and corrections right away instead of waiting." },
                 { icon: "📊", title: "Performance Tracking", desc: "Clear progress reports show what is improving and what needs more work." },
                 { icon: "🧠", title: "Weak Area Focus", desc: "AI spots patterns and targets the exact skills hurting the score." }
               ].map((f, i) => (
                  <div key={i} className="bg-[#0a0f1d] p-10 rounded-[40px] border border-white/5 shadow-2xl h-full flex flex-col hover:border-red-600/30 transition-colors">
                     <div className="text-4xl mb-8">{f.icon}</div>
                     <h3 className="text-xl font-black italic tracking-tighter text-white uppercase mb-4">{f.title}</h3>
                     <p className="text-sm font-medium text-slate-500 leading-relaxed uppercase tracking-tighter">{f.desc}</p>
                  </div>
               ))}
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 text-center opacity-40">
         <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em] mb-4">© 2026 AIPrep365 • Powered by Test Prep Pundits</p>
         <p className="text-[8px] font-black text-slate-800 uppercase tracking-[0.2em] italic">AI-powered SAT prep for ambitious students</p>
      </footer>

    </div>
  );
}
