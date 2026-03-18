import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiMail, FiMessageSquare, FiPhone, FiCalendar, FiCheck, FiX, FiClock } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';

const NotificationHistory = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
    }
  }, [user, filter, page]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        studentId: user.id,
        limit: 20,
        page: page
      });
      
      if (filter !== 'all') {
        queryParams.append('type', filter);
      }

      const response = await fetch(`/api/notifications/history?${queryParams}`);
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.notifications);
        setTotalPages(data.pagination?.pages || 1);
      }
    } catch (error) {
      console.error('Error fetching notification history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'email':
        return <FiMail className="text-blue-600" />;
      case 'sms':
        return <FiMessageSquare className="text-green-600" />;
      case 'whatsapp':
        return <FiPhone className="text-green-500" />;
      default:
        return <FiMail className="text-gray-600" />;
    }
  };

  const getStatusIcon = (status, channel) => {
    if (status === 'pending') {
      return <FiClock className="text-yellow-500" />;
    }
    return status ? <FiCheck className="text-green-500" /> : <FiX className="text-red-500" />;
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'test_completion':
        return 'Test Completion';
      case 'weekly_progress':
        return 'Weekly Progress';
      case 'test_due_date':
        return 'Due Date Reminder';
      default:
        return 'Notification';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'test_completion':
        return 'blue';
      case 'weekly_progress':
        return 'green';
      case 'test_due_date':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filterOptions = [
    { value: 'all', label: 'All Notifications' },
    { value: 'test_completion', label: 'Test Completion' },
    { value: 'weekly_progress', label: 'Weekly Progress' },
    { value: 'test_due_date', label: 'Due Date Reminders' }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Notification History</h2>
          
          {/* Filter Dropdown */}
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {filterOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <FiMail className="text-4xl text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No notifications found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification, index) => (
              <motion.div
                key={notification._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${getTypeColor(notification.type)}-100 text-${getTypeColor(notification.type)}-800`}>
                        {getTypeLabel(notification.type)}
                      </span>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <FiCalendar className="w-4 h-4" />
                        {formatDate(notification.sentAt)}
                      </div>
                    </div>
                    
                    <h3 className="font-medium text-gray-800 mb-1">
                      {notification.testName || `${getTypeLabel(notification.type)} Notification`}
                    </h3>
                    
                    {notification.studentId && (
                      <p className="text-sm text-gray-600 mb-2">
                        Student: {notification.studentId.name}
                      </p>
                    )}

                    {/* Delivery Status */}
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-2">
                        {getNotificationIcon('email')}
                        {getStatusIcon(notification.results?.email?.success, 'email')}
                        <span className="text-xs text-gray-600">Email</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getNotificationIcon('sms')}
                        {getStatusIcon(notification.results?.sms?.success, 'sms')}
                        <span className="text-xs text-gray-600">SMS</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getNotificationIcon('whatsapp')}
                        {getStatusIcon(notification.results?.whatsapp?.success, 'whatsapp')}
                        <span className="text-xs text-gray-600">WhatsApp</span>
                      </div>
                    </div>

                    {/* Error Messages */}
                    {(notification.results?.email?.error || 
                      notification.results?.sms?.error || 
                      notification.results?.whatsapp?.error) && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                        {notification.results?.email?.error && (
                          <p>Email: {notification.results.email.error}</p>
                        )}
                        {notification.results?.sms?.error && (
                          <p>SMS: {notification.results.sms.error}</p>
                        )}
                        {notification.results?.whatsapp?.error && (
                          <p>WhatsApp: {notification.results.whatsapp.error}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            
            <span className="px-3 py-1 text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationHistory;
