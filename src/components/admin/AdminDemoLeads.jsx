import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import supabase from '../../supabase/supabase';
import * as XLSX from 'xlsx';
import axios from 'axios';

const { FiDownload, FiRefreshCw, FiAlertCircle, FiLoader, FiCheckCircle, FiXCircle, FiTrash2, FiFileText, FiSearch } = FiIcons;

// Classifies a lead's course into a Test Type, mirroring the main_category/is_adaptive
// convention used everywhere else in the app (StudentCourseList.jsx, the universal
// leaderboard) rather than inventing a new one.
const classifyLeadCourse = (lead) => {
  const courseObj = lead.courses || {};
  const name = (courseObj.name || '').toLowerCase();
  const mainCategoryField = (courseObj.main_category || '').toUpperCase();
  const isAdaptive = courseObj.is_adaptive === true;

  if (mainCategoryField === 'FULL LENGTH TESTS' || isAdaptive || name.includes('full length') || name.includes('full-length') || name.includes('linear sat')) {
    return 'FULL LENGTH TESTS';
  }
  if (mainCategoryField === 'AP' || /\bap\b/.test(name)) return 'AP';
  if (mainCategoryField === 'ACT' || name.includes('act')) return 'ACT';
  return 'SAT';
};

const AdminDemoLeads = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtering state
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'yesterday', '7days', '30days', 'custom'
  const [customDateRange, setCustomDateRange] = useState({ from: '', to: '' });
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'SAT' | 'ACT' | 'AP' | 'FULL LENGTH TESTS'
  const [testFilter, setTestFilter] = useState('all'); // specific course name within the selected type
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'in_progress'
  const [searchQuery, setSearchQuery] = useState('');

  const navigate = useNavigate();

  const buildReportData = (lead) => {
    return {
      studentName: lead.full_name || 'Demo Student',
      finalScores: {
        totalScore: lead.score_details?.comprehensive?.finalPredictedScore || lead.final_combined_score,
        rwScore: lead.score_details?.comprehensive?.rwScore,
        mathScore: lead.score_details?.comprehensive?.mathScore,
        overallAccuracy: lead.score_details?.comprehensive?.overallAccuracy,
        moduleDetails: lead.score_details?.allLevels || {},
        completedAt: lead.created_at
      },
      moduleHistory: lead.score_details?.comprehensive?.moduleHistory || [],
      moduleAnswers: lead.score_details?.moduleAnswers || {},
      questionTimes: lead.score_details?.questionTimes || {},
      moduleDurations: lead.score_details?.moduleDurations || {},
    };
  };

  const handleViewReport = (lead) => {
    const reportData = buildReportData(lead);
    navigate(`/demo/${lead.course_id}/report`, { state: { reportData, isAdminView: true } });
  };

  const handleDownloadReport = (lead) => {
    const reportData = buildReportData(lead);
    navigate(`/demo/${lead.course_id}/report`, { state: { reportData, isAdminView: true, autoPrint: true } });
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      setError('');
      // Fetch demo leads and join with courses to get course name + classification fields
      const { data, error: fetchError } = await supabase
        .from('demo_leads')
        .select('*, courses(name, main_category, category, is_adaptive)')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setLeads(data || []);
    } catch (err) {
      console.error('Error fetching demo leads:', err);
      setError('Failed to load demo leads: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDeleteLead = async (id) => {
    if (!window.confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
      return;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Not authenticated or session expired');
      }

      const response = await axios.delete(`/api/demo/lead/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
        
      if (!response.data.success) {
        throw new Error(response.data.error || 'Unknown error occurred');
      }
      
      setLeads(leads.filter(lead => lead.id !== id));
    } catch (err) {
      console.error('Error deleting lead:', err);
      const errMsg = err.response?.data?.error || err.message;
      setError('Failed to delete lead: ' + errMsg);
    }
  };

  // Defensive de-duplication: keep only the latest row per (email, course_id). The backend
  // upsert now normalizes email + refreshes created_at on every update, so this mainly
  // guards against legacy duplicate rows created before that fix.
  const dedupedLeads = useMemo(() => {
    const byKey = new Map();
    leads.forEach(lead => {
      const key = `${(lead.email || '').toLowerCase().trim()}::${lead.course_id}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, lead);
        return;
      }
      const existingTime = new Date(existing.created_at).getTime();
      const leadTime = new Date(lead.created_at).getTime();
      if (leadTime > existingTime || (leadTime === existingTime && lead.id > existing.id)) {
        byKey.set(key, lead);
      }
    });
    return Array.from(byKey.values());
  }, [leads]);

  const availableTests = useMemo(() => {
    const scoped = typeFilter === 'all' ? dedupedLeads : dedupedLeads.filter(l => classifyLeadCourse(l) === typeFilter);
    return Array.from(new Set(scoped.map(l => l.courses?.name).filter(Boolean))).sort();
  }, [dedupedLeads, typeFilter]);

  const filteredLeads = dedupedLeads.filter(lead => {
    if (typeFilter !== 'all' && classifyLeadCourse(lead) !== typeFilter) {
      return false;
    }

    if (testFilter !== 'all' && lead.courses?.name !== testFilter) {
      return false;
    }

    if (statusFilter !== 'all') {
      const isCompleted = !!lead.final_email_sent;
      if (statusFilter === 'completed' && !isCompleted) return false;
      if (statusFilter === 'in_progress' && isCompleted) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const haystack = [
        lead.full_name,
        lead.email,
        lead.score_details?.parentName,
        lead.score_details?.parentEmail
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (dateFilter !== 'all') {
      const leadDate = new Date(lead.created_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateFilter === 'today') {
        if (leadDate < today) return false;
      } else if (dateFilter === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (leadDate < yesterday || leadDate >= today) return false;
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (leadDate < sevenDaysAgo) return false;
      } else if (dateFilter === '30days') {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (leadDate < thirtyDaysAgo) return false;
      } else if (dateFilter === 'custom') {
        if (customDateRange.from) {
          const fromDate = new Date(customDateRange.from);
          fromDate.setHours(0,0,0,0);
          if (leadDate < fromDate) return false;
        }
        if (customDateRange.to) {
          const toDate = new Date(customDateRange.to);
          toDate.setHours(23,59,59,999);
          if (leadDate > toDate) return false;
        }
      }
    }

    return true;
  });

  const processDataForExport = () => {
    return filteredLeads.map(lead => ({
      'Date Submitted': formatDate(lead.created_at),
      'Student Name': lead.full_name || 'N/A',
      'Grade': lead.grade || 'N/A',
      'Student Email': lead.email || 'N/A',
      'Phone': lead.phone || 'N/A',
      'Parent Name': lead.score_details?.parentName || 'N/A',
      'Parent Email': lead.score_details?.parentEmail || 'N/A',
      'Course': lead.courses?.name || 'Unknown',
      'Levels Completed': lead.levels_completed ? JSON.parse(lead.levels_completed).join(', ') : 'None',
      'Final Combined Score': lead.final_combined_score || 0,
      'Email Sent': lead.final_email_sent ? 'Yes' : 'No'
    }));
  };

  const handleExportCSV = () => {
    const data = processDataForExport();
    if (data.length === 0) return;

    // Create CSV content
    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header];
        // Escape quotes and wrap in quotes if there's a comma
        const escaped = ('' + val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `demo_leads_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    const data = processDataForExport();
    if (data.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Demo Leads");
    XLSX.writeFile(workbook, `demo_leads_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Demo Leads</h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">View and export student submissions from demo forms</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          <button
            onClick={loadLeads}
            className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition-all flex-shrink-0"
            title="Refresh Data"
          >
            <SafeIcon icon={FiRefreshCw} className={`w-5 h-5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportCSV}
            disabled={loading || filteredLeads.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 flex-shrink-0"
          >
            <SafeIcon icon={FiDownload} /> CSV
          </button>
          <button
            onClick={handleExportExcel}
            disabled={loading || filteredLeads.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-green-200 dark:shadow-none flex-shrink-0"
          >
            <SafeIcon icon={FiDownload} /> Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400">
          <SafeIcon icon={FiAlertCircle} />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-center mb-6">
        <select 
          value={dateFilter} 
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          <option value="all">All Dates</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
          <option value="custom">Custom Range</option>
        </select>
        
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <input 
              type="date" 
              value={customDateRange.from} 
              onChange={e => setCustomDateRange({...customDateRange, from: e.target.value})}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400">-</span>
            <input 
              type="date" 
              value={customDateRange.to} 
              onChange={e => setCustomDateRange({...customDateRange, to: e.target.value})}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setTestFilter('all'); }}
          className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          <option value="all">All Test Types</option>
          <option value="SAT">SAT</option>
          <option value="ACT">ACT</option>
          <option value="AP">AP</option>
          <option value="FULL LENGTH TESTS">Full-Length Test</option>
        </select>

        <select
          value={testFilter}
          onChange={(e) => setTestFilter(e.target.value)}
          className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500 sm:w-64 cursor-pointer"
        >
          <option value="all">{typeFilter === 'all' ? 'All Tests' : 'All ' + (typeFilter === 'FULL LENGTH TESTS' ? 'Full-Length Tests' : typeFilter)}</option>
          {availableTests.map(test => (
            <option key={test} value={test}>{test}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="in_progress">In Progress</option>
        </select>

        <div className="relative flex-1 min-w-[220px]">
          <SafeIcon icon={FiSearch} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, email, or parent email..."
            className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white dark:bg-gray-800 rounded-[32px] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-x-auto w-full max-w-full responsive-table-container">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 space-y-4">
            <SafeIcon icon={FiLoader} className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Loading leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="py-20 text-center">
            <SafeIcon icon={FiAlertCircle} className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">No demo leads found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full max-w-full">
            <table className="w-full min-w-[1160px]">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Date</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Student Details</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Parent Details</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Course & Progress</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-all">
                    {/* Date */}
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] font-medium text-gray-400">
                        {new Date(lead.created_at).toLocaleTimeString()}
                      </div>
                    </td>

                    {/* Student */}
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                        {lead.full_name} <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded ml-2 normal-case tracking-normal">Gr {lead.grade}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{lead.email}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{lead.phone}</div>
                    </td>

                    {/* Parent */}
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-700 dark:text-gray-300">
                        {lead.score_details?.parentName || '-'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {lead.score_details?.parentEmail || '-'}
                      </div>
                    </td>

                    {/* Course & Progress */}
                    <td className="px-6 py-5">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        {lead.courses?.name || 'Unknown Course'}
                      </div>
                      <div className="text-[10px] mt-1 text-gray-500 uppercase tracking-wider font-bold">
                        Levels: {lead.levels_completed ? JSON.parse(lead.levels_completed).join(', ') : 'None'}
                      </div>
                      {lead.final_combined_score > 0 && (
                        <div className="text-[11px] mt-1 font-black text-indigo-600 bg-indigo-50 inline-block px-2 py-0.5 rounded uppercase">
                          Score: {lead.final_combined_score}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-3">
                        {lead.final_email_sent ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-green-100 text-green-700">
                            <SafeIcon icon={FiCheckCircle} className="w-3 h-3" /> Email Sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-600">
                            <SafeIcon icon={FiAlertCircle} className="w-3 h-3" /> In Progress
                          </span>
                        )}
                        {lead.final_combined_score > 0 && (
                          <>
                            <button
                              onClick={() => handleViewReport(lead)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                              title="View Report"
                            >
                              <SafeIcon icon={FiFileText} className="w-3.5 h-3.5" /> View Report
                            </button>
                            <button
                              onClick={() => handleDownloadReport(lead)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-200"
                              title="Download PDF"
                            >
                              <SafeIcon icon={FiDownload} className="w-3.5 h-3.5" /> Download PDF
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteLead(lead.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Lead"
                        >
                          <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDemoLeads;
