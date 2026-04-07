import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';
import { aiService } from '../../services/api';

const { FiSend, FiCpu, FiUser, FiBook, FiFilter, FiAlertCircle, FiLoader } = FiIcons;

const Prep365Chat = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [availableTopics, setAvailableTopics] = useState([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    // Load available topics on mount
    loadAvailableTopics();
    
    // Add welcome message
    setMessages([{
      id: 1,
      sender: 'ai',
      text: `## 📚 Welcome to 24/7 AI Prep365 Chat

I provide **exact questions** from the Knowledge Base without any AI generation or rewriting.

**How to use:**
• Type a topic name (e.g., "One-variable data Distributions")
• Select difficulty level (Easy, Medium, Hard) or leave blank for mixed
• I'll fetch and display the exact KB questions

**Example topics:**
• Linear Equations
• Quadratics
• Geometry
• Statistics

What topic would you like to practice?`,
      timestamp: new Date()
    }]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadAvailableTopics = async () => {
    try {
      // This would be implemented to fetch from the new prep365KB utils
      const topics = [
        'Linear Equations',
        'Quadratics',
        'Geometry',
        'Statistics',
        'Trigonometry',
        'Problem Solving',
        'Words in Context',
        'Standard English Conventions',
        'Transitions',
        'Rhetorical Synthesis'
      ];
      setAvailableTopics(topics);
    } catch (error) {
      console.error('Failed to load topics:', error);
    }
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || loading) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue.trim();
    setInputValue('');
    setLoading(true);

    try {
      const response = await aiService.prep365Chat(currentInput, selectedDifficulty);
      
      const aiMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        text: response.data?.reply || 'No response received.',
        questions: response.data?.questions || [],
        topic: response.data?.topic || currentInput,
        difficulty: response.data?.difficulty || selectedDifficulty || 'Mixed',
        source: response.data?.source || 'Knowledge Base',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Prep365 Chat Error:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        text: `❌ **Error:** ${error.message || 'Failed to fetch questions'}\n\nPlease check your connection and try again.`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const TopicSuggestion = ({ topic, onClick }) => (
    <button
      onClick={onClick}
      className="text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm transition-colors w-full"
    >
      {topic}
    </button>
  );

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <SafeIcon icon={FiBook} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">24/7 AI Prep365 Chat</h1>
            <p className="text-blue-100 text-sm">Exact Knowledge Base Questions</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <SafeIcon icon={FiFilter} className="w-4 h-4" />
              Difficulty Filter
            </h3>
            <div className="space-y-2">
              {['', 'Easy', 'Medium', 'Hard'].map(level => (
                <button
                  key={level}
                  onClick={() => setSelectedDifficulty(level)}
                  className={`w-full p-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedDifficulty === level
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  {level || 'Mixed Levels'}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Available Topics</h3>
            <div className="space-y-1">
              {availableTopics.map(topic => (
                <TopicSuggestion
                  key={topic}
                  topic={topic}
                  onClick={() => setInputValue(topic)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-[90%] ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.sender === 'user' ? 'bg-blue-600' : 'bg-black'
                  }`}>
                    <SafeIcon 
                      icon={message.sender === 'user' ? FiUser : FiCpu} 
                      className="w-4 h-4 text-white" 
                    />
                  </div>
                  
                  <div className={`p-4 rounded-2xl shadow-sm ${
                    message.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'
                  }`}>
                    <div className="text-sm leading-relaxed">
                      <MathRenderer text={message.text} />
                    </div>
                    
                    {/* Display metadata for AI responses */}
                    {message.sender === 'ai' && message.source && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                          <SafeIcon icon={FiBook} className="w-3 h-3" />
                          <span>Source: {message.source}</span>
                          {message.difficulty && (
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              {message.difficulty}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-gray-500 text-sm">Fetching exact KB questions...</span>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a topic name (e.g., One-variable data Distributions)..."
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white dark:caret-white transition-shadow font-medium"
                disabled={loading}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <SafeIcon icon={FiSend} className="w-4 h-4" />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Prep365Chat;
