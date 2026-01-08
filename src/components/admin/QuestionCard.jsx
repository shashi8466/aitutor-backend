import React from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';

const { FiEdit, FiTrash2, FiImage } = FiIcons;

const QuestionCard = ({ question, courses, index, onEdit, onDelete }) => {
  const course = courses.find(c => c.id === question.courseId);
  const getTypeColor = (type) => type === 'mcq' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  const getLevelColor = (level) => {
    switch (level) {
      case 'Easy': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(question.type)}`}>
              {question.type === 'mcq' ? 'Multiple Choice' : 'Short Answer'}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(question.level)}`}>
              {question.level}
            </span>
            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
              {course?.name || 'Unknown Course'}
            </span>
            {question.image && (
              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium flex items-center gap-1">
                <SafeIcon icon={FiImage} className="w-3 h-3" /> Image
              </span>
            )}
          </div>
          
          {/* Admin Image Preview */}
          {question.image && (
            <div className="mb-4 mt-2 p-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center max-w-md">
              <img 
                src={question.image} 
                alt="Question Diagram" 
                className="max-h-64 w-auto object-contain rounded shadow-sm"
                onError={(e) => {
                    e.target.onerror = null; 
                    e.target.src = "https://placehold.co/400x300?text=Image+Load+Failed";
                    e.target.style.opacity = "0.5";
                }}
              />
            </div>
          )}

          <h3 className="font-medium text-gray-900 mb-2">
            <MathRenderer text={question.question} />
          </h3>

          {question.type === 'mcq' && question.options && (
            <div className="space-y-1 mb-3">
              {question.options.map((option, idx) => (
                <div key={idx} className={`text-sm p-2 rounded ${String.fromCharCode(65 + idx) === question.correct_answer ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-gray-50 text-gray-700'}`}>
                  <span className="font-medium">{String.fromCharCode(65 + idx)}.</span> <MathRenderer text={option} />
                </div>
              ))}
            </div>
          )}

          {question.type === 'short_answer' && (
            <div className="mb-3">
              <div className="text-sm bg-green-50 text-green-800 border border-green-200 p-2 rounded">
                <span className="font-medium">Correct Answer:</span> {question.correct_answer}
              </div>
            </div>
          )}

          {question.explanation && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Explanation:</span> <MathRenderer text={question.explanation} />
              </p>
            </div>
          )}
        </div>
        <div className="flex space-x-2 ml-4">
          <button onClick={() => onEdit(question)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
            <SafeIcon icon={FiEdit} className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(question.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="Delete">
            <SafeIcon icon={FiTrash2} className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default QuestionCard;