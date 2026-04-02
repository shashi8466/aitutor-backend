import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import supabase from '../../supabase/supabase';

const { 
  FiInbox, 
  FiMail, 
  FiUser, 
  FiPhone, 
  FiCalendar, 
  FiSearch, 
  FiFilter,
  FiCheckCircle,
  FiXCircle,
  FiEye,
  FiTrash2,
  FiMessageSquare,
  FiClock,
  FiChevronDown,
  FiChevronUp
} = FiIcons;

const AdminContactMessages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, support, general
  const [filterStatus, setFilterStatus] = useState('all'); // all, new, read, resolved
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [stats, setStats] = useState({ total: 0, new: 0, read: 0, resolved: 0 });

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMessages(data || []);
      
      // Calculate stats
      setStats({
        total: data?.length || 0,
        new: data?.filter(m => !m.status || m.status === 'new').length || 0,
        read: data?.filter(m => m.status === 'read').length || 0,
        resolved: data?.filter(m => m.status === 'resolved').length || 0
      });
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load contact messages');
    } finally {
      setLoading(false);
    }
  };

  const updateMessageStatus = async (messageId, status) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ 
          status,
          [status === 'resolved' ? 'resolved_at' : 'replied_at']: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) throw error;

      // Update local state
      setMessages(messages.map(msg => 
        msg.id === messageId 
          ? { ...msg, status, [status === 'resolved' ? 'resolved_at' : 'replied_at']: new Date().toISOString() }
          : msg
      ));

      if (selectedMessage?.id === messageId) {
        setSelectedMessage({ ...selectedMessage, status });
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;

    try {
      const { error } = await supabase
        .from('contact_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      setMessages(messages.filter(msg => msg.id !== messageId));
      if (selectedMessage?.id === messageId) {
        setSelectedMessage(null);
      }
    } catch (err) {
      console.error('Error deleting message:', err);
      alert('Failed to delete message');
    }
  };

  const filteredMessages = messages.filter(msg => {
    const matchesSearch = 
      msg.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.message?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || 
      (filterType === 'support' && msg.subject?.toLowerCase().includes('support')) ||
      (filterType === 'general' && !msg.subject?.toLowerCase().includes('support'));

    const currentStatus = msg.status || 'new';
    const matchesStatus = filterStatus === 'all' || currentStatus === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const badges = {
      new: { color: 'bg-blue-100 text-blue-800', icon: FiMail, label: 'New' },
      read: { color: 'bg-gray-100 text-gray-800', icon: FiEye, label: 'Read' },
      resolved: { color: 'bg-green-100 text-green-800', icon: FiCheckCircle, label: 'Resolved' }
    };
    const badge = badges[status || 'new'];
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${badge.color}`}>
        <SafeIcon icon={badge.icon} className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <SafeIcon icon={FiIcons.FiLoader} className="w-12 h-12 animate-spin text-[#E53935] mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Contact Messages
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage contact form submissions
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Messages</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <SafeIcon icon={FiInbox} className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">New</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.new}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <SafeIcon icon={FiMail} className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Read</p>
                <p className="text-3xl font-bold text-gray-600 dark:text-gray-400">{stats.read}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <SafeIcon icon={FiEye} className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Resolved</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <SafeIcon icon={FiCheckCircle} className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <div className="relative">
                <SafeIcon icon={FiSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Types</option>
                <option value="support">Support</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="read">Read</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Messages List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sender</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredMessages.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      <SafeIcon icon={FiInbox} className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No messages found</p>
                    </td>
                  </tr>
                ) : (
                  filteredMessages.map((msg) => (
                    <tr 
                      key={msg.id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${!msg.status || msg.status === 'new' ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      onClick={() => setSelectedMessage(msg)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(msg.status || 'new')}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{msg.full_name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{msg.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs truncate">
                          <p className="text-sm text-gray-900 dark:text-white">{msg.subject || 'General Inquiry'}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{msg.message}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(msg.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateMessageStatus(msg.id, 'read');
                          }}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 mr-3"
                          title="Mark as Read"
                        >
                          <SafeIcon icon={FiEye} className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateMessageStatus(msg.id, 'resolved');
                          }}
                          className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200 mr-3"
                          title="Mark as Resolved"
                        >
                          <SafeIcon icon={FiCheckCircle} className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMessage(msg.id);
                          }}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                          title="Delete"
                        >
                          <SafeIcon icon={FiTrash2} className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Message Detail Modal */}
        {selectedMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedMessage(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Message Details</h3>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <SafeIcon icon={FiXCircle} className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  {getStatusBadge(selectedMessage.status || 'new')}
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(selectedMessage.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">From</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedMessage.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Email</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedMessage.email}</p>
                  </div>
                  {selectedMessage.mobile && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Mobile</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedMessage.mobile}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Type</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedMessage.subject || 'General Inquiry'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Message</p>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-gray-900 dark:text-white whitespace-pre-wrap">
                    {selectedMessage.message}
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex gap-3">
                  <button
                    onClick={() => updateMessageStatus(selectedMessage.id, 'read')}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <SafeIcon icon={FiEye} className="w-5 h-5" />
                    Mark as Read
                  </button>
                  <button
                    onClick={() => updateMessageStatus(selectedMessage.id, 'resolved')}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <SafeIcon icon={FiCheckCircle} className="w-5 h-5" />
                    Mark as Resolved
                  </button>
                  <button
                    onClick={() => deleteMessage(selectedMessage.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <SafeIcon icon={FiTrash2} className="w-5 h-5" />
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminContactMessages;
