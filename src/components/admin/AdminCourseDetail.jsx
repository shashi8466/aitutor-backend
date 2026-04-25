import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService, uploadService, questionService, enrollmentService, authService } from '../../services/api';
import CourseForm from './CourseForm';
import AdaptiveCourseForm from './AdaptiveCourseForm';
import supabase from '../../supabase/supabase';

import EnrollmentKeyManager from './EnrollmentKeyManager';
import TutorGrades from '../tutor/TutorGrades';

const { FiBook, FiArrowLeft, FiEdit, FiFile, FiVideo, FiHelpCircle, FiUsers, FiTrash2, FiCheck, FiFilter, FiCalendar, FiMail, FiKey, FiRefreshCw, FiCheckCircle, FiPlus } = FiIcons;

const AdminCourseDetail = () => {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [questionsCount, setQuestionsCount] = useState(0);
  const [students, setStudents] = useState([]);
  const [allTutors, setAllTutors] = useState([]);
  const [updating, setUpdating] = useState({});
  const [activeTab, setActiveTab] = useState('content');
  const [showEditForm, setShowEditForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourseData();
  }, [id]);

  const loadCourseData = async () => {
    try {
      // Load basic course data
      const { data: courseData } = await courseService.getById(id);
      setCourse(courseData);

      // Load uploads directly via DB to bypass 404 errors in deployed environments
      const { data: uploadsData } = await supabase.from('uploads').select('*').eq('course_id', id);
      setUploads(uploadsData || []);

      // Load all profiles to filter tutors
      const { data: profiles } = await authService.getAllProfiles();
      setAllTutors((profiles || []).filter(p => p.role === 'tutor'));

      // Load all questions for this course so we can compute an "active" count
      // that matches what students actually see:
      //   - manual questions (upload_id null)
      //   - latest quiz_document upload per level (Easy/Medium/Hard) only
      const { data: questions } = await questionService.getAll({ courseId: id });

      const allQuestions = questions || [];

      // Manual questions (created directly in UI, no upload_id)
      const manualCount = allQuestions.filter(q => !q.upload_id).length;

      // Determine latest quiz upload per level
      const levels = ['Easy', 'Medium', 'Hard'];
      const latestQuizUploadsByLevel = {};

      levels.forEach(level => {
        const levelUploads = (uploadsData || [])
          .filter(u => u.category === 'quiz_document' && u.level === level)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        if (levelUploads.length > 0) {
          latestQuizUploadsByLevel[level] = levelUploads[0];
        }
      });

      // Sum questions_count from only the latest quiz upload per level
      const latestQuizQuestionsCount = Object.values(latestQuizUploadsByLevel)
        .reduce((sum, upload) => sum + (upload.questions_count || 0), 0);

      setQuestionsCount(manualCount + latestQuizQuestionsCount);

      // Load enrolled students directly via DB
      const { data: studentsData } = await supabase
        .from('enrollments')
        .select(`
          *,
          profiles (*)
        `)
        .eq('course_id', id);
        
      setStudents(studentsData || []);

    } catch (error) {
      console.error("Error loading details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUpload = async (uploadId) => {
    // Removed window.confirm to avoid sandbox errors
    await uploadService.delete(uploadId);
    loadCourseData();
  };

  if (loading) return <div className="p-8 text-center">Loading Course Details...</div>;
  if (!course) return <div className="p-8 text-center">Course not found</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-8 md:pb-12 mobile-safe">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/admin/courses" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4">
            <SafeIcon icon={FiArrowLeft} className="w-4 h-4 mr-1" /> Back to Courses
          </Link>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-200 dark:border-slate-800 p-4 md:p-8 flex flex-col md:flex-row gap-4 md:justify-between md:items-start">
            <div className="flex items-start space-x-3 md:space-x-4 min-w-0">
              <div className="bg-blue-100 p-3 md:p-4 rounded-xl">
                <SafeIcon icon={FiBook} className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 break-words">{course.name}</h1>
                <p className="text-gray-600 text-sm md:text-lg mb-2 break-words">{course.description}</p>
                <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-500">
                  <span className="bg-gray-100 px-2 py-1 rounded">{course.tutor_type}</span>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded capitalize">{course.status}</span>
                  <span>{questionsCount} Questions</span>
                  <span>{(course.manual_enrollment_count || 0) > students.length ? course.manual_enrollment_count : students.length} Students</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowEditForm(true)}
              className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <SafeIcon icon={FiEdit} className="w-4 h-4" /> Edit Course
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            <TabButton
              active={activeTab === 'content'}
              onClick={() => setActiveTab('content')}
              icon={FiFile}
              label="Content & Uploads"
            />
            <TabButton
              active={activeTab === 'students'}
              onClick={() => setActiveTab('students')}
              icon={FiUsers}
              label={`Enrolled Students (${(course.manual_enrollment_count || 0) > students.length ? course.manual_enrollment_count : students.length})`}
            />
            <TabButton
              active={activeTab === 'keys'}
              onClick={() => setActiveTab('keys')}
              icon={FiKey}
              label="Enrollment Keys"
            />
            <TabButton
              active={activeTab === 'tutors'}
              onClick={() => setActiveTab('tutors')}
              icon={FiIcons.FiShield || FiUsers}
              label="Tutors & Staff"
            />
            <TabButton
              active={activeTab === 'grades'}
              onClick={() => setActiveTab('grades')}
              icon={FiIcons.FiBarChart2 || FiBook}
              label="Grades & Analysis"
            />
          </div>
        </div>

        {/* Content Tab */}
        {activeTab === 'content' && (
          <div className="space-y-10">
            {course.is_adaptive ? (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                    Reading & Writing Modules
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <UploadsGroup section="reading_writing" level="Moderate" color="blue" uploads={uploads} onDelete={handleDeleteUpload} />
                    <UploadsGroup section="reading_writing" level="Easy" color="emerald" uploads={uploads} onDelete={handleDeleteUpload} />
                    <UploadsGroup section="reading_writing" level="Hard" color="orange" uploads={uploads} onDelete={handleDeleteUpload} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-purple-600 rounded-full"></div>
                    Math Modules
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <UploadsGroup section="math" level="Moderate" color="purple" uploads={uploads} onDelete={handleDeleteUpload} />
                    <UploadsGroup section="math" level="Easy" color="emerald" uploads={uploads} onDelete={handleDeleteUpload} />
                    <UploadsGroup section="math" level="Hard" color="orange" uploads={uploads} onDelete={handleDeleteUpload} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <UploadsGroup level="Easy" color="blue" uploads={uploads} onDelete={handleDeleteUpload} />
                <UploadsGroup level="Medium" color="purple" uploads={uploads} onDelete={handleDeleteUpload} />
                <UploadsGroup level="Hard" color="orange" uploads={uploads} onDelete={handleDeleteUpload} />
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-200 dark:border-slate-800 p-4 md:p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">All Uploaded Files</h3>
              <div className="responsive-table-container">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                    {uploads.map((upload) => (
                      <tr key={upload.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center">
                            <SafeIcon icon={getFileIcon(upload.category)} className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400" />
                            {upload.file_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 capitalize">{upload.category?.replace('_', ' ')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(upload.level)}`}>
                            {upload.level}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">{new Date(upload.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={() => handleDeleteUpload(upload.id)} className="text-red-600 hover:text-red-900">
                            <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Enrolled Students Tab - FIXED */}
        {activeTab === 'students' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-200 p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Enrolled Students</h3>
                <p className="text-xs text-gray-400">Actual students enrolled via the platform</p>
              </div>
              <div className="flex gap-2">
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                  Real: {students.length}
                </span>
                {course.manual_enrollment_count > 0 && (
                  <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                    Display: {course.manual_enrollment_count}
                  </span>
                )}
              </div>
            </div>

            {students.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <SafeIcon icon={FiUsers} className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No students enrolled yet.</p>
                <p className="text-sm text-gray-400">Students will appear here once they enroll in this course.</p>
              </div>
            ) : (
              <div className="responsive-table-container">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enrolled On</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                    {students.map((student, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                              {student.profiles?.name?.charAt(0) || 'U'}
                            </div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {student.profiles?.name || 'Unknown User'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-500 dark:text-slate-400">
                            <SafeIcon icon={FiMail} className="w-4 h-4 mr-2 text-gray-400" />
                            {student.profiles?.email || 'No Email'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                          <div className="flex items-center">
                            <SafeIcon icon={FiCalendar} className="w-4 h-4 mr-2 text-gray-400" />
                            {new Date(student.enrolled_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Enrollment Keys Tab */}
        {activeTab === 'keys' && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 md:p-8">
            <EnrollmentKeyManager courseId={id} courseName={course.name} />
          </div>
        )}

        {/* Tutors Tab */}
        {activeTab === 'tutors' && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Course Tutors & Staff</h3>
                <p className="text-sm text-gray-500">Manage instructors authorized to view this course's analytics</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allTutors.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <SafeIcon icon={FiUsers} className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-bold uppercase tracking-widest">No Tutors Found</p>
                  <p className="text-sm text-gray-400 mt-1">Visit User Management to create tutor accounts.</p>
                </div>
              ) : (
                allTutors.map(tutor => {
                  const isAssigned = (tutor.assigned_courses || []).includes(parseInt(id));
                  const isUpdating = updating[tutor.id];

                  return (
                    <div
                      key={tutor.id}
                      className={`p-5 rounded-2xl border-2 transition-all ${isAssigned
                        ? 'border-blue-500 bg-blue-50/30 shadow-md shadow-blue-50'
                        : 'border-gray-100 bg-white hover:border-blue-200'
                        }`}
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-white ${isAssigned ? 'bg-blue-600' : 'bg-gray-400'}`}>
                          {tutor.name?.charAt(0) || 'T'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 truncate uppercase tracking-tight">{tutor.name}</h4>
                          <p className={`text-[10px] font-black uppercase inline-flex px-2 py-0.5 rounded-md ${tutor.tutor_approved ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            {tutor.tutor_approved ? 'Approved' : 'Pending Approval'}
                          </p>
                        </div>
                      </div>

                      <button
                        disabled={isUpdating}
                        onClick={async () => {
                          setUpdating(prev => ({ ...prev, [tutor.id]: true }));
                          const currentCourses = tutor.assigned_courses || [];
                          const newCourses = isAssigned
                            ? currentCourses.filter(cid => cid !== parseInt(id))
                            : [...currentCourses, parseInt(id)];

                          try {
                            await authService.updateProfile(tutor.id, { assigned_courses: newCourses });
                            setAllTutors(prev => prev.map(p => p.id === tutor.id ? { ...p, assigned_courses: newCourses } : p));
                          } catch (err) {
                            console.error('Update failed:', err);
                          } finally {
                            setUpdating(prev => ({ ...prev, [tutor.id]: false }));
                          }
                        }}
                        className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isAssigned
                          ? 'bg-blue-600 text-white hover:bg-red-600'
                          : 'bg-white border-2 border-gray-100 text-gray-700 hover:border-blue-500 hover:text-blue-600'
                          }`}
                      >
                        {isUpdating ? (
                          <SafeIcon icon={FiRefreshCw} className="animate-spin" />
                        ) : isAssigned ? (
                          <><SafeIcon icon={FiCheckCircle} /> Assigned Account</>
                        ) : (
                          <><FiPlus className="w-4 h-4" /> Authorize Access</>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Grades Tab */}
        {activeTab === 'grades' && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-2">
            <TutorGrades adminMode={true} courseId={id} />
          </div>
        )}

        {/* Edit Form Modal */}
        {showEditForm && (
          course?.tutor_type === 'Full-Length SAT Test' ? (
            <AdaptiveCourseForm
              course={course}
              onClose={() => setShowEditForm(false)}
              onSave={() => { loadCourseData(); }}
            />
          ) : (
            <CourseForm
              course={course}
              onClose={() => setShowEditForm(false)}
              onSave={() => { loadCourseData(); }}
            />
          )
        )}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`shrink-0 md:flex-1 py-3 md:py-4 px-3 md:px-6 text-center text-xs md:text-sm font-medium whitespace-nowrap transition-colors flex items-center justify-center gap-2 ${active
      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
  >
    <SafeIcon icon={icon} className="w-4 h-4" /> {label}
  </button>
);

const UploadsGroup = ({ section, level, color, uploads, onDelete }) => {
  const levelUploads = uploads.filter(u => {
    const matchesLevel = u.level?.toLowerCase() === level.toLowerCase() || 
                        (level === 'Medium' && u.level === 'Moderate') ||
                        (level === 'Moderate' && u.level === 'Medium');
    const matchesSection = section ? (
      u.section === section || 
      (!u.section && (
        (section === 'math' && u.file_name?.toLowerCase().includes('math')) ||
        (section === 'reading_writing' && !u.file_name?.toLowerCase().includes('math'))
      ))
    ) : true;
    return matchesLevel && matchesSection;
  });
  
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100',
    purple: 'bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-100',
    orange: 'bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-100',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-100',
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <h3 className="font-bold mb-4 flex items-center justify-between">
        {level} Level Content
        <span className="text-xs bg-white px-2 py-1 rounded border border-gray-200">{levelUploads.length} files</span>
      </h3>
      <div className="space-y-2">
        {levelUploads.length === 0 && <p className="text-sm opacity-60 italic">No files uploaded</p>}
        {levelUploads.map(file => (
          <div key={file.id} className="bg-white dark:bg-slate-800/50 p-2 rounded border border-gray-200 dark:border-slate-700/50 flex justify-between items-center">
            <div className="flex items-center gap-2 overflow-hidden">
              <SafeIcon icon={getFileIcon(file.category)} className="w-4 h-4 flex-shrink-0 text-slate-600 dark:text-slate-400" />
              <span className="text-sm truncate text-slate-900 dark:text-white font-bold" title={file.file_name}>{file.file_name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const getFileIcon = (category) => {
  if (category === 'video_lecture') return FiVideo;
  if (category === 'study_material') return FiFile;
  return FiBook; // quiz or source
};

const getLevelColor = (level) => {
  const l = level?.toLowerCase();
  switch (l) {
    case 'easy': return 'bg-green-100 text-green-800';
    case 'medium': 
    case 'moderate': return 'bg-purple-100 text-purple-800';
    case 'hard': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default AdminCourseDetail;