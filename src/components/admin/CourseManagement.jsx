import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService } from '../../services/api';
import CourseForm from './CourseForm';
import CourseCard from './CourseCard';

const { FiPlus, FiBook, FiFilter, FiSearch, FiRefreshCw } = FiIcons;

const CourseManagement = ({ onStatsUpdate }) => {
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', search: '' });

  useEffect(() => {
    loadCourses();
  }, [filters]);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const response = await courseService.getAll();
      let filteredCourses = response?.data || [];

      if (filters.status) {
        filteredCourses = filteredCourses.filter(c => c.status === filters.status);
      }
      if (filters.search) {
        const term = filters.search.toLowerCase();
        filteredCourses = filteredCourses.filter(c =>
          c.name.toLowerCase().includes(term) ||
          (c.description && c.description.toLowerCase().includes(term))
        );
      }
      setCourses(filteredCourses);
      onStatsUpdate?.();
    } catch (error) {
      console.error('Error loading courses:', error);
      setCourses([]); // Set to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    // Removed window.confirm to avoid sandbox errors
    await courseService.delete(courseId);
    loadCourses();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Course Management</h2>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
        >
          <SafeIcon icon={FiPlus} className="w-4 h-4" />
          <span>Add New Course</span>
        </motion.button>
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
          <button onClick={loadCourses} className="text-blue-600 hover:text-blue-700 text-sm flex items-center">
            <SafeIcon icon={FiRefreshCw} className="w-3 h-3 mr-1" />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search courses..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </motion.div>

      {/* Courses Grid */}
      {(loading && (!courses || courses.length === 0)) ? (
        <div className="text-center py-12">
          <SafeIcon icon={FiRefreshCw} className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="mt-2 text-gray-500">Loading courses...</p>
        </div>
      ) : (!courses || courses.length === 0) ? (
        <div className="text-center py-12 bg-white rounded-xl shadow border border-gray-200">
          <p className="text-gray-500">No courses found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course, index) => (
            <CourseCard
              key={course.id}
              course={course}
              index={index}
              onDelete={handleDeleteCourse}
              manageLink={`/admin/course/${course.id}`}
            />
          ))}
        </div>
      )}

      {showForm && (
        <CourseForm
          onClose={() => setShowForm(false)}
          onSave={() => {
            loadCourses();
          }}
        />
      )}
    </div>
  );
};

export default CourseManagement;