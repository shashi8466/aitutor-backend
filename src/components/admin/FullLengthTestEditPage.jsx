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

const { FiBook, FiArrowLeft, FiEdit, FiFile, FiVideo, FiHelpCircle, FiUsers, FiTrash2, FiCheck, FiRefreshCw, FiCheckCircle, FiPlus, FiActivity, FiSearch } = FiIcons;

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
    <div className="min-h-screen bg-[#0f1115] pb-12 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/admin/courses" className="inline-flex items-center text-blue-500 hover:text-blue-400 mb-4 font-bold text-sm transition-colors">
            <SafeIcon icon={FiArrowLeft} className="w-4 h-4 mr-1" /> Back to Course Management
          </Link>
          <div className="bg-[#1b2028] rounded-2xl shadow-sm border border-gray-800 p-8 flex flex-col md:flex-row gap-6 md:justify-between md:items-start">
            <div className="flex items-start gap-6">
              <div className="bg-purple-900/30 p-4 rounded-2xl">
                <SafeIcon icon={FiActivity} className="w-10 h-10 text-purple-500" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-black text-white tracking-tight">{course.name}</h1>
                  <span className="px-2 py-1 bg-purple-900/30 text-purple-500 rounded-md text-[10px] font-black uppercase tracking-widest border border-purple-500/30">Adaptive DSAT</span>
                </div>
                <p className="text-gray-400 text-sm mb-4 max-w-2xl">{course.description}</p>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 bg-transparent border border-gray-700 px-3 py-1.5 rounded-lg">
                    <SafeIcon icon={FiHelpCircle} className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-bold text-gray-300">{questionsCount} Questions</span>
                  </div>
                  <div className="flex items-center gap-2 bg-transparent border border-gray-700 px-3 py-1.5 rounded-lg">
                    <SafeIcon icon={FiUsers} className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-bold text-gray-300">{(course.manual_enrollment_count || 0) > students.length ? course.manual_enrollment_count : students.length} Students</span>
                  </div>
                  <div className="flex items-center gap-2 bg-emerald-900/10 px-3 py-1.5 rounded-lg border border-emerald-900/50">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">{course.status}</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowEditForm(true)}
              className="w-full md:w-auto px-5 py-2.5 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-all text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              <SafeIcon icon={FiEdit} className="w-4 h-4" /> Edit Adaptive Flow
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar border-b border-gray-800 mb-8 pb-4">
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
              className={`flex-1 min-w-[140px] py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 uppercase tracking-widest ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-500 hover:text-white bg-transparent'
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
                <h3 className="text-sm font-bold text-white flex items-center gap-3">
                  <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                  Reading & Writing Modules
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <UploadsGroup section="reading_writing" level="Easy" color="blue" uploads={uploads} onDelete={handleDeleteUpload} />
                  <UploadsGroup section="reading_writing" level="Moderate" color="emerald" uploads={uploads} onDelete={handleDeleteUpload} />
                  <UploadsGroup section="reading_writing" level="Hard" color="orange" uploads={uploads} onDelete={handleDeleteUpload} />
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-sm font-bold text-white flex items-center gap-3">
                  <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
                  Math Modules
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <UploadsGroup section="math" level="Easy" color="purple" uploads={uploads} onDelete={handleDeleteUpload} />
                  <UploadsGroup section="math" level="Moderate" color="emerald" uploads={uploads} onDelete={handleDeleteUpload} />
                  <UploadsGroup section="math" level="Hard" color="orange" uploads={uploads} onDelete={handleDeleteUpload} />
                </div>
              </div>

              <div className="bg-[#1b2028] rounded-xl shadow-sm border border-gray-800 overflow-hidden mt-8">
                <div className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800">
                   <div>
                     <h3 className="text-lg font-bold text-white">Module Asset Audit</h3>
                     <p className="text-xs text-gray-500 mt-1">Review all uploaded files and manage your curriculum assets.</p>
                   </div>
                   <div className="flex items-center gap-3 w-full md:w-auto">
                     <div className="relative flex-1 md:flex-none">
                       <input type="text" placeholder="Search files..." className="w-full bg-[#0f1115] border border-gray-700 text-white text-xs rounded-lg pl-3 pr-8 py-2 outline-none focus:border-gray-500 md:w-64" />
                       <SafeIcon icon={FiSearch} className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                     </div>
                     <button className="flex items-center gap-2 bg-transparent border border-gray-700 text-gray-300 px-3 py-2 rounded-lg text-xs hover:bg-[#0f1115] transition-colors">
                       <SafeIcon icon={FiIcons.FiFilter} className="w-3.5 h-3.5" /> Filter
                     </button>
                     <button className="flex items-center gap-2 bg-transparent border border-gray-700 text-gray-300 px-3 py-2 rounded-lg text-xs hover:bg-[#0f1115] transition-colors">
                       <SafeIcon icon={FiRefreshCw} className="w-3.5 h-3.5" />
                     </button>
                   </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#0f1115]/50 border-b border-gray-800">
                      <tr>
                        <th className="px-5 py-3 w-10">
                          <input type="checkbox" className="rounded border-gray-700 bg-transparent text-purple-600 focus:ring-purple-600 focus:ring-offset-gray-900" />
                        </th>
                        <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">File Name</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Category</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tier</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Questions</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Size</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Uploaded By</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Uploaded On <SafeIcon icon={FiIcons.FiArrowDown} className="inline w-3 h-3 ml-1" /></th>
                        <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {uploads.map((upload) => {
                        const [actualFileName, uploaderNameStr] = upload.file_name?.includes('|') ? upload.file_name.split('|') : [upload.file_name, 'Admin'];
                        const uploaderName = uploaderNameStr || 'Admin';
                        const initials = uploaderName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                        
                        const uploadDate = new Date(upload.created_at);
                        const diffDays = Math.floor((Date.now() - uploadDate.getTime()) / (1000 * 60 * 60 * 24));
                        const relativeTime = diffDays === 0 ? 'Today' : diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;

                        return (
                        <tr key={upload.id} className="hover:bg-[#252b36] transition-colors group">
                          <td className="px-5 py-4">
                            <input type="checkbox" className="rounded border-gray-700 bg-transparent text-purple-600 focus:ring-purple-600 focus:ring-offset-gray-900" />
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3 font-medium text-gray-300 text-xs">
                              <SafeIcon icon={getFileIcon(upload.category)} className="w-4 h-4 text-gray-500" />
                              {actualFileName}
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-[11px] font-medium text-gray-400 capitalize">
                              {upload.category?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${getLevelColor(upload.level)}`}>
                              {upload.level}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-xs text-gray-300">{upload.questions_count || 0}</span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-xs text-gray-400">{upload.file_size ? (upload.file_size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}</span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${['bg-blue-600', 'bg-purple-600', 'bg-orange-600', 'bg-emerald-600', 'bg-rose-600'][Math.abs(uploaderName.length % 5)]}`}>
                                {initials}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-300 font-medium">{uploaderName}</span>
                                <span className="text-[10px] text-gray-500">Admin</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-[11px] text-gray-300">{uploadDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} {uploadDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className={`text-[10px] ${diffDays < 3 ? 'text-emerald-500' : diffDays > 10 ? 'text-red-500' : 'text-gray-500'}`}>{diffDays === 0 ? '(Latest)' : relativeTime}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => window.open(upload.file_url)} className="p-1.5 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition-colors border border-gray-700">
                                <SafeIcon icon={FiIcons.FiDownload} className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteUpload(upload.id)} className="p-1.5 bg-red-900/20 text-red-500 hover:bg-red-900/40 hover:text-red-400 rounded-lg transition-colors border border-red-900/30">
                                <SafeIcon icon={FiTrash2} className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="p-4 border-t border-gray-800 flex justify-between items-center bg-[#0f1115]/50">
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-bold text-gray-500 bg-[#1b2028] px-2 py-1 rounded border border-gray-800">0 files selected</span>
                      <button className="flex items-center gap-2 bg-transparent border border-red-900/30 text-red-500 hover:bg-red-900/10 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors">
                        <SafeIcon icon={FiTrash2} className="w-3 h-3" /> Bulk Delete
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-gray-500 font-bold">
                      Showing 1 to {uploads.length} of {uploads.length} Files
                      <div className="flex gap-1 ml-4">
                        <button className="w-6 h-6 flex items-center justify-center bg-[#1b2028] border border-gray-800 rounded hover:bg-gray-800 transition-colors">&lt;</button>
                        <button className="w-6 h-6 flex items-center justify-center bg-purple-600 text-white rounded border border-purple-500">1</button>
                        <button className="w-6 h-6 flex items-center justify-center bg-[#1b2028] border border-gray-800 rounded hover:bg-gray-800 transition-colors">&gt;</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'students' && (
             <div className="bg-[#1b2028] rounded-2xl shadow-sm border border-gray-800 p-8">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-2xl font-black text-white tracking-tight">Active Examinees</h3>
                   <div className="flex gap-2">
                     <span className="bg-blue-900/30 text-blue-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-blue-900/50">
                       Real: {students.length}
                     </span>
                   </div>
                </div>
                {students.length === 0 ? (
                  <div className="text-center py-20 bg-[#0f1115] rounded-2xl border-2 border-dashed border-gray-800">
                    <SafeIcon icon={FiUsers} className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-500 font-bold uppercase tracking-widest">No candidates enrolled</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {students.map((student, idx) => (
                      <div key={idx} className="p-4 bg-[#0f1115] rounded-xl border border-gray-800 flex items-center gap-4">
                         <div className="w-12 h-12 bg-[#1b2028] rounded-full flex items-center justify-center font-black text-purple-500 border border-gray-700 shadow-sm">
                           {student.profiles?.name?.charAt(0) || 'U'}
                         </div>
                         <div className="min-w-0">
                            <p className="font-bold text-white truncate">{student.profiles?.name || 'Anonymous'}</p>
                            <p className="text-xs text-gray-500 truncate">{student.profiles?.email}</p>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          )}

          {activeTab === 'keys' && (
            <div className="bg-[#1b2028] rounded-2xl shadow-sm border border-gray-800 p-8">
              <EnrollmentKeyManager courseId={id} courseName={course.name} />
            </div>
          )}

          {activeTab === 'tutors' && (
            <div className="bg-[#1b2028] rounded-2xl shadow-sm border border-gray-800 p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allTutors.map(tutor => {
                  const isAssigned = (tutor.assigned_courses || []).includes(parseInt(id));
                  const isUpdating = updating[tutor.id];
                  return (
                    <div key={tutor.id} className={`p-6 rounded-2xl border transition-all ${isAssigned ? 'border-purple-500/50 bg-purple-900/10' : 'border-gray-800 bg-[#0f1115]'}`}>
                      <div className="flex items-center gap-4 mb-6">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-white ${isAssigned ? 'bg-purple-600' : 'bg-gray-700'}`}>
                          {tutor.name?.charAt(0) || 'T'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-white truncate tracking-tight">{tutor.name}</h4>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Authorized Proctor</p>
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
                            const confirmedCourses = result.data?.assigned_courses || newCourses;
                            setAllTutors(prev => prev.map(p => p.id === tutor.id ? { ...p, assigned_courses: confirmedCourses } : p));
                          } catch (err) { console.error('Update failed:', err); } finally { setUpdating(prev => ({ ...prev, [tutor.id]: false })); }
                        }}
                        className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isAssigned ? 'bg-purple-600 text-white' : 'bg-[#1b2028] border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'}`}
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
            <div className="bg-[#1b2028] rounded-2xl shadow-sm border border-gray-800 p-4">
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
    blue: 'border-[#1e3a8a]',
    purple: 'border-[#4c1d95]',
    orange: 'border-[#c2410c]',
    emerald: 'border-[#065f46]',
  };

  const textColors = {
    blue: 'text-blue-500',
    purple: 'text-purple-500',
    orange: 'text-orange-500',
    emerald: 'text-emerald-500',
  };

  return (
    <div className={`rounded-xl border bg-transparent p-4 transition-all ${colors[color]}`}>
      <h3 className={`font-black text-[10px] uppercase tracking-widest mb-4 flex items-center justify-between ${textColors[color]}`}>
        {level} LEVEL
        <span className="text-[10px] bg-[#1b2028] text-gray-400 px-2 py-0.5 rounded border border-gray-800">{levelUploads.length} Questions</span>
      </h3>
      <div className="space-y-2">
        {levelUploads.length === 0 && <p className="text-xs text-gray-600 italic">No assets assigned</p>}
        {levelUploads.map(file => (
          <div key={file.id} className="bg-[#1b2028] p-2.5 rounded-lg border border-gray-800 flex justify-between items-center group">
            <div className="flex items-center gap-2 overflow-hidden">
              <SafeIcon icon={getFileIcon(file.category)} className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
              <span className="text-[11px] truncate font-medium text-gray-300" title={file.file_name}>{file.file_name?.split('|')[0]}</span>
            </div>
            <button onClick={() => onDelete(file.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-500 transition-all">
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
    case 'easy': return 'bg-emerald-900/10 border-emerald-900/50 text-emerald-500';
    case 'medium': 
    case 'moderate': return 'bg-purple-900/10 border-purple-900/50 text-purple-500';
    case 'hard': return 'bg-orange-900/10 border-orange-900/50 text-orange-500';
    default: return 'bg-gray-900/10 border-gray-800 text-gray-400';
  }
};

export default FullLengthTestEditPage;
