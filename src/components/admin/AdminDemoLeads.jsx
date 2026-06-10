import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import supabase from '../../supabase/supabase';
import * as XLSX from 'xlsx';
import axios from 'axios';

const { FiDownload, FiRefreshCw, FiAlertCircle, FiLoader, FiCheckCircle, FiXCircle, FiTrash2 } = FiIcons;

const AdminDemoLeads = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      setError('');
      // Fetch demo leads and join with courses to get course name
      const { data, error: fetchError } = await supabase
        .from('demo_leads')
        .select('*, courses(name)')
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

  const processDataForExport = () => {
    return leads.map(lead => ({
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Demo Leads</h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">View and export student submissions from demo forms</p>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            onClick={loadLeads}
            className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition-all"
            title="Refresh Data"
          >
            <SafeIcon icon={FiRefreshCw} className={`w-5 h-5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportCSV}
            disabled={loading || leads.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
          >
            <SafeIcon icon={FiDownload} /> CSV
          </button>
          <button
            onClick={handleExportExcel}
            disabled={loading || leads.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-green-200 dark:shadow-none"
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

      {/* Leads Table */}
      <div className="bg-white dark:bg-gray-800 rounded-[32px] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 responsive-table-container">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 space-y-4">
            <SafeIcon icon={FiLoader} className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Loading leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="py-20 text-center">
            <SafeIcon icon={FiAlertCircle} className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">No demo leads found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
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
                {leads.map((lead) => (
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
