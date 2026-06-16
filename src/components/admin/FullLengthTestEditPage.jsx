import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService, uploadService, questionService, authService } from '../../services/api';
import AdaptiveCourseForm from './AdaptiveCourseForm';
import supabase from '../../supabase/supabase';
import EnrollmentKeyManager from './EnrollmentKeyManager';
import TutorGrades from '../tutor/TutorGrades';

const { FiBook, FiArrowLeft, FiEdit, FiFile, FiVideo, FiHelpCircle, FiUsers, FiTrash2, FiCheck, FiRefreshCw, FiCheckCircle, FiPlus, FiActivity } = FiIcons;

const FullLengthTestEditPage = () => {
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
      const { data: courseData } = await courseService.getById(id);
      setCourse(courseData);

      const { data: uploadsData } = await supabase.from('uploads').select('*').eq('course_id', id);
      setUploads(uploadsData || []);

      const { data: profiles } = await authService.getAllProfiles();
      setAllTutors((profiles || []).filter(p => p.role === 'tutor'));

      const { data: questions } = await questionService.getAll({ courseId: id });
      const allQuestions = questions || [];
      const manualCount = allQuestions.filter(q => !q.upload_id).length;

      const levels = ['Easy', 'Moderate', 'Hard'];
      const latestQuizUploadsByLevel = {};

      levels.forEach(level => {
        const levelUploads = (uploadsData || [])
          .filter(u => u.category === 'quiz_document' && (u.level === level || (level === 'Moderate' && u.level === 'Medium')))
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        if (levelUploads.length > 0) {
          latestQuizUploadsByLevel[level] = levelUploads[0];
        }
      });

      const latestQuizQuestionsCount = Object.values(latestQuizUploadsByLevel)
        .reduce((sum, upload) => sum + (upload.questions_count || 0), 0);

      setQuestionsCount(manualCount + latestQuizQuestionsCount);

      const { data: studentsData } = await supabase
        .from('enrollments')
        .select(`*, profiles (*)`)
        .eq('course_id', id);
        
      setStudents(studentsData || []);

    } catch (error) {
      console.error("Error loading details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUpload = async (uploadId) => {
    await uploadService.delete(uploadId);
    loadCourseData();
  };

  if (loading) return <div className="p-8 text-center">Loading Test Details...</div>;
  if (!course) return <div className="p-8 text-center">Test not found</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/admin/courses" className="inline-flex items-center text-sky-600 hover:text-sky-700 mb-4 font-bold text-sm">
            <SafeIcon icon={FiArrowLeft} className="w-4 h-4 mr-1" /> Back to Course Management
          </Link>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col md:flex-row gap-6 md:justify-between md:items-start">
            <div className="flex items-start gap-6">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-2xl">
                <SafeIcon icon={FiActivity} className="w-10 h-10 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{course.name}</h1>
                  <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-purple-200 dark:border-purple-800">Adaptive SAT</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-lg mb-4 max-w-2xl">{course.description}</p>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <SafeIcon icon={FiHelpCircle} className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{questionsCount} Questions</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <SafeIcon icon={FiUsers} className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{(course.manual_enrollment_count || 0) > students.length ? course.manual_enrollment_count : students.length} Students</span>
                  </div>
                  <div className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">{course.status}</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowEditForm(true)}
              className="w-full md:w-auto px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 flex items-center justify-center gap-2"
            >
              <SafeIcon icon={FiEdit} className="w-4 h-4" /> Edit Adaptive Flow
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mb-8 p-1 flex overflow-x-auto hide-scrollbar">
          {[
            { id: 'content', icon: FiFile, label: 'Adaptive Modules' },
            { id: 'students', icon: FiUsers, label: `Students (${students.length})` },
            { id: 'keys', icon: FiIcons.FiKey, label: 'Enrollment Keys' },
            { id: 'tutors', icon: FiIcons.FiShield, label: 'Tutor Access' },
            { id: 'grades', icon: FiIcons.FiBarChart2, label: 'Performance Analytics' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[140px] py-3.5 px-4 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 uppercase tracking-widest ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <SafeIcon icon={tab.icon} className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-8 animate-in fade-in duration-500">
          {activeTab === 'content' && (
            <div className="space-y-10">
              <div className="space-y-6">
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                  <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                  Reading & Writing Modules
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <UploadsGroup section="reading_writing" level="Moderate" color="blue" uploads={uploads} onDelete={handleDeleteUpload} />
                  <UploadsGroup section="reading_writing" level="Easy" color="emerald" uploads={uploads} onDelete={handleDeleteUpload} />
                  <UploadsGroup section="reading_writing" level="Hard" color="orange" uploads={uploads} onDelete={handleDeleteUpload} />
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                  <div className="w-2 h-8 bg-purple-500 rounded-full"></div>
                  Math Modules
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <UploadsGroup section="math" level="Moderate" color="purple" uploads={uploads} onDelete={handleDeleteUpload} />
                  <UploadsGroup section="math" level="Easy" color="emerald" uploads={uploads} onDelete={handleDeleteUpload} />
                  <UploadsGroup section="math" level="Hard" color="orange" uploads={uploads} onDelete={handleDeleteUpload} />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                   <h3 className="text-lg font-bold text-slate-900 dark:text-white">Module Asset Audit</h3>
                   <p className="text-sm text-slate-500">Inventory of all parsed question sets and study materials</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Name</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tier</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {uploads.map((upload) => (
                        <tr key={upload.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3 font-bold text-slate-900 dark:text-slate-100 text-sm">
                              <SafeIcon icon={getFileIcon(upload.category)} className="w-4 h-4 text-slate-400" />
                              {upload.file_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter">
                              {upload.category?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${getLevelColor(upload.level)}`}>
                              {upload.level}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button onClick={() => handleDeleteUpload(upload.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
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

          {activeTab === 'students' && (
             <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Active Examinees</h3>
                   <div className="flex gap-2">
                     <span className="bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-sky-200 dark:border-sky-800">
                       Real: {students.length}
                     </span>
                   </div>
                </div>
                {students.length === 0 ? (
                  <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <SafeIcon icon={FiUsers} className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest">No candidates enrolled</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {students.map((student, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                         <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center font-black text-purple-600 border border-slate-200 dark:border-slate-700 shadow-sm">
                           {student.profiles?.name?.charAt(0) || 'U'}
                         </div>
                         <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">{student.profiles?.name || 'Anonymous'}</p>
                            <p className="text-xs text-slate-500 truncate">{student.profiles?.email}</p>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          )}

          {activeTab === 'keys' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
              <EnrollmentKeyManager courseId={id} courseName={course.name} />
            </div>
          )}

          {activeTab === 'tutors' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allTutors.map(tutor => {
                  const isAssigned = (tutor.assigned_courses || []).includes(parseInt(id));
                  const isUpdating = updating[tutor.id];
                  return (
                    <div key={tutor.id} className={`p-6 rounded-2xl border-2 transition-all ${isAssigned ? 'border-purple-500 bg-purple-50/20 shadow-lg' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                      <div className="flex items-center gap-4 mb-6">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-white ${isAssigned ? 'bg-purple-600' : 'bg-slate-400'}`}>
                          {tutor.name?.charAt(0) || 'T'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-slate-900 dark:text-white truncate tracking-tight">{tutor.name}</h4>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Authorized Proctor</p>
                        </div>
                      </div>
                      <button
                        disabled={isUpdating}
                        onClick={async () => {
                          setUpdating(prev => ({ ...prev, [tutor.id]: true }));
                          const currentCourses = tutor.assigned_courses || [];
                          const newCourses = isAssigned ? currentCourses.filter(cid => cid !== parseInt(id)) : [...currentCourses, parseInt(id)];
                          try {
                            const result = await authService.updateProfileAsAdmin(tutor.id, { assigned_courses: newCourses });
                            // Use server-confirmed data so state matches DB
                            const confirmedCourses = result.data?.assigned_courses || newCourses;
                            setAllTutors(prev => prev.map(p => p.id === tutor.id ? { ...p, assigned_courses: confirmedCourses } : p));
                          } catch (err) { console.error('Update failed:', err); } finally { setUpdating(prev => ({ ...prev, [tutor.id]: false })); }
                        }}
                        className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isAssigned ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                      >
                        {isUpdating ? <SafeIcon icon={FiRefreshCw} className="animate-spin mx-auto" /> : isAssigned ? 'Revoke Access' : 'Authorize Access'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'grades' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-4">
              <TutorGrades adminMode={true} courseId={id} />
            </div>
          )}
        </div>

        {showEditForm && (
          <AdaptiveCourseForm
            course={course}
            onClose={() => setShowEditForm(false)}
            onSave={() => { loadCourseData(); }}
          />
        )}
      </div>
    </div>
  );
};

const UploadsGroup = ({ section, level, color, uploads, onDelete }) => {
  const levelUploads = uploads.filter(u => {
    const matchesLevel = u.level?.toLowerCase() === level.toLowerCase() || (level === 'Moderate' && u.level === 'Medium');
    const matchesSection = section ? (u.section === section || (!u.section && ((section === 'math' && u.file_name?.toLowerCase().includes('math')) || (section === 'reading_writing' && !u.file_name?.toLowerCase().includes('math'))))) : true;
    return matchesLevel && matchesSection;
  });
  
  const colors = {
    blue: 'bg-blue-50/50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100',
    purple: 'bg-purple-50/50 border-purple-200 text-purple-900 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-100',
    orange: 'bg-orange-50/50 border-orange-200 text-orange-900 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-100',
    emerald: 'bg-emerald-50/50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-100',
  };

  return (
    <div className={`rounded-2xl border p-6 transition-all hover:shadow-md ${colors[color]}`}>
      <h3 className="font-black text-sm uppercase tracking-widest mb-6 flex items-center justify-between">
        {level} Level
        <span className="text-[10px] bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded border border-white/20">{levelUploads.length} files</span>
      </h3>
      <div className="space-y-3">
        {levelUploads.length === 0 && <p className="text-xs opacity-50 italic">No assets assigned</p>}
        {levelUploads.map(file => (
          <div key={file.id} className="bg-white/80 dark:bg-slate-900/40 p-3 rounded-xl border border-white/40 dark:border-slate-700/40 flex justify-between items-center group">
            <div className="flex items-center gap-2 overflow-hidden">
              <SafeIcon icon={getFileIcon(file.category)} className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
              <span className="text-xs truncate font-bold text-slate-800 dark:text-slate-200" title={file.file_name}>{file.file_name}</span>
            </div>
            <button onClick={() => onDelete(file.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 transition-all">
               <SafeIcon icon={FiTrash2} className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const getFileIcon = (category) => {
  if (category === 'video_lecture') return FiVideo;
  if (category === 'study_material') return FiFile;
  return FiBook;
};

const getLevelColor = (level) => {
  const l = level?.toLowerCase();
  switch (l) {
    case 'easy': return 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400';
    case 'medium': 
    case 'moderate': return 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400';
    case 'hard': return 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400';
    default: return 'bg-slate-50 border-slate-200 text-slate-700';
  }
};

export default FullLengthTestEditPage;
