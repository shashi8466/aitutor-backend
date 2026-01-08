import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { questionService, courseService } from '../../services/api';
import QuestionCard from './QuestionCard';
import QuestionForm from './QuestionForm';

const { FiFilter, FiEdit, FiTrash2, FiHelpCircle, FiSearch, FiPlus, FiRefreshCw, FiAlertTriangle } = FiIcons;

const QuestionManagement = () => {
  const [questions, setQuestions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchingQuestions, setFetchingQuestions] = useState(false);
  
  // Filters state
  const [filters, setFilters] = useState({
    courseId: '',
    level: '',
    type: '',
    search: ''
  });

  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  // 1. Initial Load (Courses Only)
  useEffect(() => {
    loadCourses();
  }, []);

  // 2. Fetch Questions whenever filters change
  useEffect(() => {
    loadQuestions();
  }, [filters]);

  const loadCourses = async () => {
    try {
      const { data } = await courseService.getAll();
      setCourses(data);
    } catch (error) {
      console.error('Error loading courses:', error);
    }
  };

  const loadQuestions = async () => {
    setFetchingQuestions(true);
    setLoading(true);
    try {
      // Create a clean params object with only active filters
      const params = {};
      if (filters.courseId) params.courseId = filters.courseId;
      if (filters.level) params.level = filters.level;
      if (filters.type) params.type = filters.type;

      const response = await questionService.getAll(params);
      let filteredQuestions = response.data;
      
      // Client-side search (since API might not support fuzzy search efficiently yet)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredQuestions = filteredQuestions.filter(q => 
          (q.question && q.question.toLowerCase().includes(searchLower))
        );
      }

      setQuestions(filteredQuestions);
    } catch (error) {
      console.error('Error loading questions:', error);
    } finally {
      setFetchingQuestions(false);
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    try {
      await questionService.delete(questionId);
      setQuestions(prev => prev.filter(q => q.id !== questionId));
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete question. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    if (!filters.courseId) {
      alert("Please select a Course first to perform bulk deletion.");
      return;
    }

    const confirmMsg = `Are you sure you want to delete ALL displayed questions (${questions.length})? This cannot be undone.`;
    
    if (window.confirm(confirmMsg)) {
      try {
        // Process in batches of 10 to avoid overwhelming API if many
        const idsToDelete = questions.map(q => q.id);
        for (const id of idsToDelete) {
          await questionService.delete(id);
        }
        setQuestions([]);
        alert("All questions deleted successfully.");
      } catch (err) {
        console.error("Bulk delete failed", err);
        alert("Some questions failed to delete.");
        loadQuestions();
      }
    }
  };

  const handleEditQuestion = (question) => {
    setEditingQuestion(question);
    setShowForm(true);
  };

  const handleCreateQuestion = () => {
    setEditingQuestion(null);
    setShowForm(true);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Quiz Question Management</h2>
        <div className="flex gap-3">
          {questions.length > 0 && filters.courseId && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleBulkDelete}
              className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-red-100 transition-colors"
            >
              <SafeIcon icon={FiTrash2} className="w-4 h-4" />
              <span>Delete All Found</span>
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCreateQuestion}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700 transition-colors"
          >
            <SafeIcon icon={FiPlus} className="w-4 h-4" />
            <span>Add Question</span>
          </motion.button>
        </div>
      </div>

      {/* Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <SafeIcon icon={FiFilter} className="w-5 h-5 text-gray-600" />
            <h3 className="font-medium text-gray-900">Filters</h3>
          </div>
          <button 
            onClick={loadQuestions}
            className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
          >
            <SafeIcon icon={FiRefreshCw} className={`w-3 h-3 mr-1 ${fetchingQuestions ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select
              value={filters.courseId}
              onChange={(e) => handleFilterChange('courseId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Courses</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
            <select
              value={filters.level}
              onChange={(e) => handleFilterChange('level', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Levels</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Types</option>
              <option value="mcq">Multiple Choice</option>
              <option value="short_answer">Short Answer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <SafeIcon icon={FiSearch} className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search questions..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Questions List */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"
          />
        </div>
      ) : questions.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 bg-white rounded-xl shadow-lg border border-gray-200"
        >
          <SafeIcon icon={FiHelpCircle} className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No questions found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your filters or add a new question.</p>
          <button 
            onClick={handleCreateQuestion}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Create First Question
          </button>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm text-gray-500 mb-2">
            <span>Showing {questions.length} question{questions.length !== 1 && 's'}</span>
            {filters.courseId && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded border border-yellow-200 flex items-center gap-1"><SafeIcon icon={FiAlertTriangle} className="w-3 h-3"/> Use 'Delete All' to clear duplicates</span>}
          </div>
          {questions.map((question, index) => (
            <QuestionCard 
              key={question.id} 
              question={question} 
              courses={courses}
              index={index}
              onEdit={handleEditQuestion}
              onDelete={handleDeleteQuestion}
            />
          ))}
        </div>
      )}

      {showForm && (
        <QuestionForm 
          question={editingQuestion} 
          courses={courses} 
          onClose={() => setShowForm(false)} 
          onSave={loadQuestions}
        />
      )}
    </div>
  );
};

export default QuestionManagement;