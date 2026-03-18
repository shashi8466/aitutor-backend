import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const TestNotification = () => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user?.id) {
      setMessage(`User ID: ${user.id}`);
    }
  }, [user]);

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4">Notification Test</h2>
      <p className="text-gray-600">{message}</p>
    </div>
  );
};

export default TestNotification;
