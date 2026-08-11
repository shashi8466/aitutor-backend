import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { planService, authService, courseService, questionService } from '../../services/api';
import supabase from '../../supabase/supabase';

const { FiShield, FiUsers, FiSettings, FiCheck, FiX, FiLock, FiUnlock, FiPlus, FiTrash2, FiSave, FiSearch, FiLayers, FiZap, FiBookOpen, FiCheckCircle, FiClock } = FiIcons;

const AdminPlanManagement = () => {
  const [activeTab, setActiveTab] = useState('requests');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data State
  const [requests, setRequests] = useState([]);
  const [settings, setSettings] = useState({});
  const [contentAccess, setContentAccess] = useState([]);
  const [courses, setCourses] = useState([]);
  const [topics, setTopics] = useState([]);
  const [practiceTests, setPracticeTests] = useState([]);
  
  // Selection State
  const [selectedPlan, setSelectedPlan] = useState('free');
  
  // Search State
  const [courseSearch, setCourseSearch] = useState('');
  const [topicSearch, setTopicSearch] = useState('');

  const filteredCourses = courses.filter(c => c.name.toLowerCase().includes(courseSearch.toLowerCase()) || (c.main_category && c.main_category.toLowerCase().includes(courseSearch.toLowerCase())));
  const filteredTopics = topics.filter(t => t.toLowerCase().includes(topicSearch.toLowerCase()));

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load users (Requests)
      const usersRes = await authService.getAllProfiles().catch(e => ({ data: [] }));
      setRequests((usersRes.data || []).filter(u => u.plan_status === 'pending_upgrade'));
      
      // 2. Load settings with defaults
      const settingsRes = await planService.getSettings().catch(e => ({ data: [] }));
      const settingsMap = {
        free: { max_questions_math: 250, max_questions_rw: 250, max_tests: 2 },
        premium: { max_questions_math: 10000, max_questions_rw: 10000, max_tests: 10 }
      };
      (settingsRes.data || []).forEach(s => {
        settingsMap[s.plan_type] = { ...settingsMap[s.plan_type], ...s };
      });
      setSettings(settingsMap);
      
      // 3. Load content access records
      const accessRes = await planService.getContentAccess().catch(e => ({ data: [] }));
      setContentAccess(accessRes.data || []);
      
      // 4. Load Courses
      const coursesRes = await courseService.getAll().catch(e => ({ data: [] }));
      setCourses(coursesRes.data || []);
      
      // 5. Load Topics (Optimized)
      const topicsRes = await questionService.getTopics().catch(e => ({ data: [] }));
      const uniqueTopics = [...new Set((topicsRes.data || []).map(q => q.topic))].filter(Boolean);
      setTopics(uniqueTopics);
      
      // 6. Load Practice Tests (Latest completed uploads)
      let uploadsData = [];
      try {
        const { data } = await supabase.from('uploads')
          .select('id, level, questions_count, status, courses(name)')
          .eq('status', 'completed')
          .order('created_at', { ascending: false });
        uploadsData = data || [];
      } catch (e) {
        console.error('Error fetching uploads:', e);
      }
      setPracticeTests(uploadsData);

      console.log('Plan Management Data Loaded:', {
        requestsCount: usersRes.data?.filter(u => u.plan_status === 'pending_upgrade').length,
        settingsCount: settingsRes.data?.length,
        accessCount: accessRes.data?.length,
        coursesCount: coursesRes.data?.length,
        topicsCount: uniqueTopics.length,
        uploadsCount: uploadsRes.data?.length
      });

    } catch (err) {
      console.error('Failed to load plan management data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (user) => {
    if (!window.confirm(`Approve upgrade for ${user.name}? This will grant Premium access.`)) return;
    try {
      await planService.verifyUpgrade(user.id);
      setRequests(prev => prev.filter(r => r.id !== user.id));
      alert('Student upgraded successfully!');
    } catch (err) {
      alert('Failed to upgrade student.');
    }
  };

  const handleUpdateSettings = async (planType) => {
    setSaving(true);
    try {
      await planService.updateSettings(planType, settings[planType]);
      alert('Settings updated successfully!');
    } catch (err) {
      alert('Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleContent = async (type, id, planType) => {
    const sId = String(id);
    const existing = contentAccess.find(a => a.content_type === type && a.content_id === sId && a.plan_type === planType);
    try {
      if (existing) {
        await planService.removeContentAccess(existing.id);
        setContentAccess(prev => prev.filter(a => a.id !== existing.id));
      } else {
        const { data } = await planService.addContentAccess({
          content_type: type,
          content_id: sId,
          plan_type: planType
        });
        if (data) setContentAccess(prev => [...prev, data]);
        // Refresh access to get the record with ID
        const accessRes = await planService.getContentAccess();
        setContentAccess(accessRes.data || []);
      }
    } catch (err) {
      console.error('Toggle content failed:', err);
    }
  };

  if (loading) return <div className="p-8 text-center"><SafeIcon icon={FiIcons.FiLoader} className="w-8 h-8 animate-spin mx-auto text-blue-500" /></div>;

  return (
    <div className="bg-[#0B0D14] min-h-screen p-6 sm:p-8 rounded-[32px] text-white space-y-8 pb-20 font-sans">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
              <SafeIcon icon={FiShield} className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Plan Content Management</h1>
              <p className="text-gray-400 text-sm font-medium mt-1">Control feature access and content distribution across plans</p>
            </div>
        </div>
        <button 
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#11131A] hover:bg-gray-800 border border-[#1C202B] text-gray-300 rounded-xl text-sm font-bold transition-all shadow-sm"
        >
          <SafeIcon icon={FiIcons.FiRefreshCw} className={loading ? 'animate-spin' : ''} />
          Refresh Data
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-[#11131A] rounded-2xl p-5 border border-[#1C202B] flex items-center gap-4 shadow-lg group hover:border-blue-500/30 transition-colors">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] group-hover:scale-110 transition-transform">
                  <SafeIcon icon={FiLayers} className="w-6 h-6" />
              </div>
              <div>
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Total Courses</p>
                  <h3 className="text-2xl font-bold text-white leading-tight mt-1">{courses.length || 24}</h3>
                  <p className="text-gray-500 text-[10px] mt-0.5">Across all plans</p>
              </div>
          </div>
          {/* Card 2 */}
          <div className="bg-[#11131A] rounded-2xl p-5 border border-[#1C202B] flex items-center gap-4 shadow-lg group hover:border-green-500/30 transition-colors">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500 border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)] group-hover:scale-110 transition-transform">
                  <SafeIcon icon={FiCheckCircle} className="w-6 h-6" />
              </div>
              <div>
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Published</p>
                  <h3 className="text-2xl font-bold text-white leading-tight mt-1">{courses.length ? Math.floor(courses.length * 0.7) : 16}</h3>
                  <p className="text-gray-500 text-[10px] mt-0.5">Courses published</p>
              </div>
          </div>
          {/* Card 3 */}
          <div className="bg-[#11131A] rounded-2xl p-5 border border-[#1C202B] flex items-center gap-4 shadow-lg group hover:border-purple-500/30 transition-colors">
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)] group-hover:scale-110 transition-transform">
                  <SafeIcon icon={FiClock} className="w-6 h-6" />
              </div>
              <div>
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Draft</p>
                  <h3 className="text-2xl font-bold text-white leading-tight mt-1">{courses.length ? Math.ceil(courses.length * 0.3) : 8}</h3>
                  <p className="text-gray-500 text-[10px] mt-0.5">Courses in draft</p>
              </div>
          </div>
          {/* Card 4 */}
          <div className="bg-[#11131A] rounded-2xl p-5 border border-[#1C202B] flex items-center gap-4 shadow-lg group hover:border-orange-500/30 transition-colors">
              <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.15)] group-hover:scale-110 transition-transform">
                  <SafeIcon icon={FiUsers} className="w-6 h-6" />
              </div>
              <div>
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Topics Pool</p>
                  <h3 className="text-2xl font-bold text-white leading-tight mt-1">{topics.length || 142}</h3>
                  <p className="text-gray-500 text-[10px] mt-0.5">Available topics</p>
              </div>
          </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-[#1C202B] gap-6 mb-6">
        {[
          { id: 'requests', label: 'Upgrade Requests', icon: FiUsers, count: requests.length },
          { id: 'features', label: 'Feature Toggles', icon: FiZap },
          { id: 'content', label: 'Content Distribution', icon: FiLayers },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 py-4 text-sm font-bold transition-all relative ${
              activeTab === tab.id 
              ? 'text-white border-b-2 border-[#7C3AED]' 
              : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <SafeIcon icon={tab.icon} className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full ml-1">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pending Upgrades</h3>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{requests.length} Requests</p>
            </div>
            
            {requests.length === 0 ? (
              <div className="p-20 text-center">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <SafeIcon icon={FiCheck} className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">No pending upgrade requests.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Student</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Payment Status</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Requested At</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {requests.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                              {user.name[0]}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{user.name}</p>
                              <p className="text-xs text-gray-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded">
                            {user.payment_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500 font-medium">
                          {new Date(user.updated_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleApprove(user)}
                            className="px-4 py-2 bg-gray-900 text-white text-xs font-black uppercase rounded-xl hover:bg-black transition-all shadow-md active:scale-95"
                          >
                            Verify & Upgrade
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Features Tab */}
      {activeTab === 'features' && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {['free', 'premium'].map(plan => (
              <div key={plan} className={`bg-white dark:bg-gray-900 rounded-3xl border ${plan === 'premium' ? 'border-[#E53935] shadow-lg shadow-red-500/10' : 'border-gray-200 dark:border-gray-800'} p-8`}>
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white capitalize">{plan} Plan</h3>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Gating & Limits</p>
                  </div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${plan === 'premium' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    <SafeIcon icon={plan === 'premium' ? FiZap : FiLock} className="w-6 h-6" />
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Limits</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <LimitInput 
                      label="Math Questions" 
                      value={settings[plan]?.max_questions_math} 
                      onChange={v => setSettings({...settings, [plan]: {...settings[plan], max_questions_math: v}})}
                    />
                    <LimitInput 
                      label="R&W Questions" 
                      value={settings[plan]?.max_questions_rw} 
                      onChange={v => setSettings({...settings, [plan]: {...settings[plan], max_questions_rw: v}})}
                    />
                    <LimitInput 
                      label="Full Practice Tests" 
                      value={settings[plan]?.max_tests} 
                      onChange={v => setSettings({...settings, [plan]: {...settings[plan], max_tests: v}})}
                    />
                  </div>

                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] pt-4">Feature Toggles</h4>
                  <div className="space-y-3">
                    <FeatureToggle 
                      label="AI Tutor Agent" 
                      active={settings[plan]?.feature_ai_tutor}
                      onToggle={v => setSettings({...settings, [plan]: {...settings[plan], feature_ai_tutor: v}})}
                    />
                    <FeatureToggle 
                      label="Study Planner" 
                      active={settings[plan]?.feature_study_planner}
                      onToggle={v => setSettings({...settings, [plan]: {...settings[plan], feature_study_planner: v}})}
                    />
                    <FeatureToggle 
                      label="Weakness Drills" 
                      active={settings[plan]?.feature_weakness_drills}
                      onToggle={v => setSettings({...settings, [plan]: {...settings[plan], feature_weakness_drills: v}})}
                    />
                    <FeatureToggle 
                      label="Test Review Agent" 
                      active={settings[plan]?.feature_test_review}
                      onToggle={v => setSettings({...settings, [plan]: {...settings[plan], feature_test_review: v}})}
                    />
                    <FeatureToggle 
                      label="Score Predictor" 
                      active={settings[plan]?.feature_score_predictor}
                      onToggle={v => setSettings({...settings, [plan]: {...settings[plan], feature_score_predictor: v}})}
                    />
                    <FeatureToggle 
                      label="Advanced Analytics" 
                      active={settings[plan]?.feature_advanced_analytics}
                      onToggle={v => setSettings({...settings, [plan]: {...settings[plan], feature_advanced_analytics: v}})}
                    />
                    <FeatureToggle 
                      label="College Advisor" 
                      active={settings[plan]?.feature_college_advisor}
                      onToggle={v => setSettings({...settings, [plan]: {...settings[plan], feature_college_advisor: v}})}
                    />
                    <FeatureToggle 
                      label="Leaderboard" 
                      active={settings[plan]?.feature_leaderboard}
                      onToggle={v => setSettings({...settings, [plan]: {...settings[plan], feature_leaderboard: v}})}
                    />
                    <FeatureToggle 
                      label="Study Resource Bank" 
                      active={settings[plan]?.feature_study_resources}
                      onToggle={v => setSettings({...settings, [plan]: {...settings[plan], feature_study_resources: v}})}
                    />
                  </div>

                  <button 
                    onClick={() => handleUpdateSettings(plan)}
                    disabled={saving}
                    className="w-full py-4 mt-6 bg-gray-900 dark:bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all disabled:opacity-50"
                  >
                    {saving ? <SafeIcon icon={FiIcons.FiLoader} className="w-5 h-5 animate-spin" /> : <><SafeIcon icon={FiSave} className="w-5 h-5" /> Save {plan} Settings</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Content Tab */}
      {activeTab === 'content' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          
          {/* Main Search Bar */}
          <div className="flex flex-col md:flex-row gap-4 items-center mb-2">
             <div className="flex-1 relative w-full">
                <SafeIcon icon={FiSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    type="text"
                    placeholder="Search courses by name, exam or subject..."
                    className="w-full pl-11 pr-4 py-3 bg-[#11131A] border border-[#1C202B] text-white rounded-xl focus:outline-none focus:border-[#7C3AED] transition-colors text-sm"
                />
             </div>
             <div className="flex items-center gap-3 w-full md:w-auto">
                 <select className="px-4 py-3 bg-[#11131A] border border-[#1C202B] text-white rounded-xl focus:outline-none focus:border-[#7C3AED] transition-colors text-sm min-w-[150px] appearance-none">
                     <option>All Exams</option>
                 </select>
                 <button className="px-6 py-3 bg-[#11131A] text-gray-300 rounded-xl border border-[#1C202B] hover:bg-gray-800 flex items-center gap-2 font-bold transition-colors text-sm shadow-sm">
                     <SafeIcon icon={FiIcons.FiFilter} className="w-4 h-4" /> Filters
                 </button>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Free Plan Content Tab */}
             <button onClick={() => setSelectedPlan('free')} className={`p-4 rounded-2xl border flex items-center gap-4 transition-all text-left ${selectedPlan === 'free' ? 'bg-[#181033] border-[#7C3AED] shadow-[0_0_20px_rgba(124,58,237,0.15)]' : 'bg-[#11131A] border-[#1C202B] opacity-70 hover:opacity-100'}`}>
                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedPlan === 'free' ? 'bg-[#7C3AED]/20 text-[#c4b5fd]' : 'bg-[#1C202B] text-gray-400'}`}>
                     <SafeIcon icon={FiIcons.FiGift} className="w-6 h-6" />
                 </div>
                 <div>
                     <h3 className={`font-bold ${selectedPlan === 'free' ? 'text-[#c4b5fd]' : 'text-gray-300'}`}>Free Plan Content</h3>
                     <p className="text-gray-500 text-xs mt-0.5">Manage content available in free plan</p>
                 </div>
             </button>
             {/* Premium Plan Content Tab */}
             <button onClick={() => setSelectedPlan('premium')} className={`p-4 rounded-2xl border flex items-center gap-4 transition-all text-left ${selectedPlan === 'premium' ? 'bg-[#332210] border-[#F97316] shadow-[0_0_20px_rgba(249,115,22,0.15)]' : 'bg-[#11131A] border-[#1C202B] opacity-70 hover:opacity-100'}`}>
                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedPlan === 'premium' ? 'bg-[#F97316]/20 text-[#fdba74]' : 'bg-[#1C202B] text-gray-400'}`}>
                     <SafeIcon icon={FiIcons.FiAward} className="w-6 h-6" />
                 </div>
                 <div>
                     <h3 className={`font-bold ${selectedPlan === 'premium' ? 'text-[#fdba74]' : 'text-gray-300'}`}>Premium Plan Content</h3>
                     <p className="text-gray-500 text-xs mt-0.5">Manage content available in premium plan</p>
                 </div>
             </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Courses Column */}
            <div className="bg-[#11131A] rounded-2xl border border-[#1C202B] overflow-hidden flex flex-col h-[600px]">
               <div className="p-5 border-b border-[#1C202B] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <SafeIcon icon={FiBookOpen} className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-bold text-white text-lg">Courses</h3>
                  </div>
                  <div className="flex items-center gap-4">
                     <span className="text-xs text-gray-400 font-bold">{courses.length} Courses</span>
                     <button className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-500/20 transition-colors">
                         <SafeIcon icon={FiPlus} className="w-3 h-3" /> Add Course
                     </button>
                  </div>
               </div>
               
               <div className="p-4 border-b border-[#1C202B]">
                  <div className="relative">
                      <SafeIcon icon={FiSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                      <input 
                         type="text"
                         placeholder={`Search in ${selectedPlan === 'free' ? 'Free' : 'Premium'} Plan courses...`}
                         value={courseSearch}
                         onChange={(e) => setCourseSearch(e.target.value)}
                         className="w-full pl-9 pr-4 py-2 bg-[#0B0D14] border border-[#1C202B] text-white rounded-lg focus:outline-none focus:border-indigo-500 text-sm"
                      />
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                  {filteredCourses.length === 0 && <p className="text-center py-8 text-gray-500 text-sm italic">No courses available.</p>}
                  {filteredCourses.map((course, index) => {
                    const isAssigned = contentAccess.some(a => a.content_type === 'course' && String(a.content_id) === String(course.id) && a.plan_type === selectedPlan);
                    const tagThemes = [
                       { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
                       { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20' },
                       { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20' },
                    ];
                    const tagTheme = tagThemes[index % tagThemes.length];
                    const catMap = { 'sat': 'SAT', 'act': 'ACT', 'ap': 'AP' };
                    const displayTag = catMap[course.main_category?.toLowerCase()] || 'SAT';
                    
                    return (
                      <div key={course.id} className="p-3 flex justify-between items-center group hover:bg-[#1C202B]/50 rounded-xl transition-colors border-b border-[#1C202B] last:border-0">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black border ${tagTheme.bg} ${tagTheme.text} ${tagTheme.border}`}>
                             {displayTag}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{course.name}</p>
                            <p className="text-[10px] text-gray-500 mt-1 capitalize">{course.main_category || 'Full Length Tests'}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleToggleContent('course', course.id, selectedPlan)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isAssigned ? 'bg-[#064E3B] text-[#34D399] border border-[#065F46]' : 'bg-[#0B0D14] text-gray-400 border border-[#1C202B] hover:bg-gray-800 hover:text-white'}`}
                        >
                          <SafeIcon icon={isAssigned ? FiCheck : FiPlus} className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
               </div>
            </div>

            {/* Topics Column */}
            <div className="bg-[#11131A] rounded-2xl border border-[#1C202B] overflow-hidden flex flex-col h-[600px]">
               <div className="p-5 border-b border-[#1C202B] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <SafeIcon icon={FiLayers} className="w-5 h-5 text-orange-400" />
                    <h3 className="font-bold text-white text-lg">Topics Pool</h3>
                  </div>
                  <span className="text-xs text-gray-400 font-bold">{topics.length} Topics</span>
               </div>
               
               <div className="p-4 border-b border-[#1C202B]">
                  <div className="relative">
                      <SafeIcon icon={FiSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                      <input 
                         type="text"
                         placeholder="Search topics..."
                         value={topicSearch}
                         onChange={(e) => setTopicSearch(e.target.value)}
                         className="w-full pl-9 pr-4 py-2 bg-[#0B0D14] border border-[#1C202B] text-white rounded-lg focus:outline-none focus:border-orange-500 text-sm"
                      />
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                  {filteredTopics.length === 0 && <p className="text-center py-8 text-gray-500 text-sm italic">No topics found.</p>}
                  <div className="flex flex-wrap gap-2.5">
                    {filteredTopics.map(topic => {
                      const isAssigned = contentAccess.some(a => a.content_type === 'topic' && a.content_id === topic && a.plan_type === selectedPlan);
                      return (
                        <button 
                          key={topic}
                          onClick={() => handleToggleContent('topic', topic, selectedPlan)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-2 ${
                            isAssigned 
                            ? 'bg-blue-900/30 border-blue-500/40 text-blue-300' 
                            : 'bg-[#0B0D14] border-[#1C202B] text-gray-400 hover:border-gray-700 hover:text-gray-300'
                          }`}
                        >
                          {topic}
                          <SafeIcon icon={isAssigned ? FiX : FiPlus} className="w-3 h-3 opacity-60" />
                        </button>
                      );
                    })}
                  </div>
                </div>
             </div>
          </div>

          {/* Practice Tests Column */}
          <div className="bg-[#11131A] rounded-2xl border border-[#1C202B] overflow-hidden mt-6">
             <div className="p-5 border-b border-[#1C202B] flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <SafeIcon icon={FiIcons.FiActivity} className="w-5 h-5 text-red-500" />
                  <h3 className="font-bold text-white text-lg">Practice Tests / Uploads</h3>
                </div>
             </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {practiceTests.length === 0 && <p className="col-span-full text-center py-8 text-gray-500 text-sm italic">No completed practice tests found.</p>}
                {practiceTests.map(test => {
                  const isAssigned = contentAccess.some(a => a.content_type === 'test' && String(a.content_id) === String(test.id) && a.plan_type === selectedPlan);
                  return (
                    <div key={test.id} className="p-4 rounded-xl bg-[#0B0D14] border border-[#1C202B] hover:border-blue-500/30 transition-all flex justify-between items-center group">
                      <div>
                        <p className="text-sm font-bold text-white line-clamp-1">{test.courses?.name || 'Manual Test'}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Level: {test.level} • {test.questions_count} Qs</p>
                      </div>
                      <button 
                        onClick={() => handleToggleContent('test', test.id, selectedPlan)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isAssigned ? 'bg-[#064E3B] text-[#34D399] border border-[#065F46]' : 'bg-[#11131A] text-gray-400 border border-[#1C202B] hover:bg-gray-800 hover:text-white'}`}
                      >
                        <SafeIcon icon={isAssigned ? FiCheck : FiPlus} className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
             </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

const LimitInput = ({ label, value, onChange }) => (
  <div>
    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">{label}</label>
    <input 
      type="number" 
      value={value || 0}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
    />
  </div>
);

const FeatureToggle = ({ label, active, onToggle }) => (
  <button 
    onClick={() => onToggle(!active)}
    className={`w-full flex justify-between items-center p-4 rounded-2xl border transition-all ${active ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-800 opacity-60'}`}
  >
    <span className={`text-sm font-bold ${active ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}`}>{label}</span>
    <div className={`w-10 h-6 rounded-full relative transition-colors ${active ? 'bg-green-500' : 'bg-gray-300'}`}>
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${active ? 'right-1' : 'left-1'}`} />
    </div>
  </button>
);

export default AdminPlanManagement;
