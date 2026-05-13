import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import { aiService, gradingService } from '../../../services/api';
import { parseDocumentClient } from '../../../utils/clientParser';
import SmartDocViewer from '../smart/SmartDocViewer';
import SmartAIPanel from '../smart/SmartAIPanel';

const { FiUpload, FiLink, FiCpu, FiFileText } = FiIcons;

const SmartAITutor = () => {
  const [viewState, setViewState] = useState('upload'); // upload, processing, split
  const [analysisMode, setAnalysisMode] = useState('study'); // study, report
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  
  // AI Data
  const [extractedText, setExtractedText] = useState('');
  const [summaryData, setSummaryData] = useState(null);
  const [reportAnalysis, setReportAnalysis] = useState(null);
  const [parsedReportData, setParsedReportData] = useState(null);

  // Test selector (for report mode)
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Load recent submissions when switching to report mode
  useEffect(() => {
    if (analysisMode !== 'report') return;
    const loadSubmissions = async () => {
      setLoadingSubmissions(true);
      try {
        let storedUser = null;
        try { storedUser = JSON.parse(localStorage.getItem('user') || 'null'); } catch(e) {}
        if (!storedUser?.id) {
          const supaMod = await import('../../../supabase/supabase');
          const { data: { session } } = await supaMod.default.auth.getSession();
          if (session?.user) storedUser = session.user;
        }
        if (storedUser?.id) {
          const res = await gradingService.getAllMyScores(storedUser.id);
          const subs = res?.data?.submissions || []; // all tests
          setRecentSubmissions(subs);
          if (subs.length > 0) setSelectedSubmission(subs[0]); // default = most recent
        }
      } catch(e) {
        console.warn('Could not load submissions:', e.message);
      } finally {
        setLoadingSubmissions(false);
      }
    };
    loadSubmissions();
  }, [analysisMode]);

  // ── Core report analysis function (called with or without PDF text) ──────
  const runReportAnalysis = async (text, structuredData) => {
    console.log('🤖 [SmartAITutor] Starting SAT Report Analysis...');

    let dbScore = null, dbMath = null, dbRW = null;
    let dbCorrect = null, dbTotal = null, dbAccuracy = null;
    let dbTotalTime = null, dbAvgPerQ = null, dbRWTime = null, dbMathTime = null;
    const dbWeakTopics = [], dbStrongTopics = [];

    const latest = selectedSubmission;
    if (latest) {
      console.log('✅ [SmartAITutor] Using selected submission:', {
        id: latest.id, score: latest.scaled_score,
        math: latest.math_scaled_score, rw: latest.reading_scaled_score
      });
      dbScore = latest.scaled_score || null;
      dbMath  = latest.math_scaled_score || null;
      dbRW    = latest.reading_scaled_score || null;
      const correct = latest.raw_score ?? null;
      const total   = latest.total_questions ?? null;
      dbCorrect  = correct != null ? String(correct) : null;
      dbTotal    = total   != null ? String(total)   : null;
      dbAccuracy = latest.raw_score_percentage != null
        ? Math.round(latest.raw_score_percentage) + '%'
        : (correct != null && total != null && total > 0
            ? Math.round((correct / total) * 100) + '%' : null);
      const durSec = latest.test_duration_seconds ?? null;
      if (durSec != null && durSec > 0) {
        const mins = Math.floor(durSec / 60);
        const secs = durSec % 60;
        dbTotalTime = `${mins}m ${secs}s`;
        if (total && total > 0) {
          const avgSec = Math.round(durSec / total);
          dbAvgPerQ = avgSec >= 60 ? `${Math.floor(avgSec/60)}m ${avgSec%60}s` : `${avgSec}s`;
        }
        const rwSec = Math.round(durSec * 0.55);
        const mSec  = Math.round(durSec * 0.45);
        dbRWTime   = `${Math.floor(rwSec/60)}m ${rwSec%60}s`;
        dbMathTime = `${Math.floor(mSec/60)}m ${mSec%60}s`;
      }
    }

    const sd = structuredData || {};
    const finalScore = dbScore  || sd.totalScore || null;
    const finalMath  = dbMath   || sd.mathScore  || sd.sections?.['Math'] || null;
    const finalRW    = dbRW     || sd.rwScore    || sd.sections?.['Reading & Writing'] || null;
    const studentName = sd.studentName || 'Student';
    const correctQ   = dbCorrect || sd.correctAnswers || null;
    const incorrectQ = sd.incorrectAnswers || null;
    const totalQ     = dbTotal   || sd.totalQuestions || null;
    const accuracy   = dbAccuracy || sd.accuracy || null;
    const totalTime  = dbTotalTime || sd.totalTime || null;
    const avgPerQ    = dbAvgPerQ  || null;
    const rwTime     = dbRWTime   || null;
    const mathTime   = dbMathTime || null;

    setParsedReportData({
      totalScore: finalScore != null ? String(finalScore) : null,
      mathScore:  finalMath  != null ? String(finalMath)  : null,
      rwScore:    finalRW    != null ? String(finalRW)    : null,
      correctAnswers: correctQ,
      totalQuestions: totalQ,
      accuracy, totalTime, avgPerQ, rwTime, mathTime,
    });

    const incorrectTopics = sd.incorrectTopics || {};
    const correctTopics   = sd.correctTopics   || {};
    const topicMistakeLines = dbWeakTopics.length > 0
      ? dbWeakTopics.map(t => `- ${t}`).join('\n')
      : Object.entries(incorrectTopics).sort((a,b) => b[1]-a[1]).map(([t,c]) => `- ${t}: ${c} incorrect`).join('\n');
    const topicStrengthLines = dbStrongTopics.length > 0
      ? dbStrongTopics.map(t => `- ${t}`).join('\n')
      : Object.entries(correctTopics).sort((a,b) => b[1]-a[1]).slice(0,6).map(([t,c]) => `- ${t}: ${c} correct`).join('\n');

    const testName = selectedSubmission?.courses?.name || 'Full Length Test';

    const structuredPayload = `### STRUCTURED SAT DATA (PRIMARY — read this first)
TEST NAME: ${testName}
STUDENT NAME: ${studentName}
TOTAL SAT SCORE: ${finalScore != null ? finalScore + '/1600' : 'Not available'}
READING & WRITING SCORE: ${finalRW != null ? finalRW + '/800' : 'Not available'}
MATH SCORE: ${finalMath != null ? finalMath + '/800' : 'Not available'}
TOTAL QUESTIONS: ${totalQ || 'Not available'}
CORRECT ANSWERS: ${correctQ || 'Not available'}
INCORRECT ANSWERS: ${incorrectQ || 'Not available'}
ACCURACY: ${accuracy || 'Not available'}
TOTAL TIME: ${totalTime || 'Not available'}
AVG TIME PER QUESTION: ${avgPerQ || 'Not available'}
READING & WRITING TIME: ${rwTime || 'Not available'}
MATH TIME: ${mathTime || 'Not available'}

WEAK TOPICS:
${topicMistakeLines || '- Not available'}

STRONG TOPICS:
${topicStrengthLines || '- Not available'}

RAW PDF TEXT:
${text ? text.substring(0, 4000) : '(Not available — graphical PDF)'}`;

    let reportRes;
    try {
      reportRes = await aiService.analyzeSATReport(structuredPayload);
    } catch (apiErr) {
      console.error("AI Analysis Error:", apiErr);
      const errMsg = apiErr.response?.status === 404 || apiErr.response?.status === 405 
        ? "Backend connection failed. Are you sure your Node.js backend is deployed and connected via VITE_BACKEND_URL?" 
        : (apiErr.message || "Unknown error occurred.");
      reportRes = { data: { performance_summary: `Analysis failed: ${errMsg}. Please try again.` } };
    }
    setReportAnalysis(reportRes.data);
    setViewState('split');
  };


  const handleProcess = async () => {
    // Fast path: report mode with a selected submission — no PDF needed
    if (analysisMode === 'report' && selectedSubmission) {
      setViewState('processing');
      setError('');
      try {
        await runReportAnalysis('', null);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Analysis failed. Please try again.');
        setViewState('upload');
      }
      return;
    }

    if (!file && !url) return;
    setViewState('processing');
    setError('');
    try {
      let text = '';
      let structuredData = null;

      if (file) {
        try {
          const result = await parseDocumentClient(file, true);
          text = result.text || '';
          structuredData = result.structuredData;
        } catch (parseErr) {
          console.warn('PDF parse failed, continuing:', parseErr.message);
          text = '';
          structuredData = null;
        }
      } else if (url) {
        const res = await aiService.extractContent(null, url);
        text = res.data?.text || '';
      }

      if (analysisMode === 'report') {
        setExtractedText(text);
        await runReportAnalysis(text, structuredData);
        return;
      }

      if (!text || text.length < 50) {
        throw new Error('Could not extract enough text. Please try a different file.');
      }

      setExtractedText(text);
      const res = await aiService.summarizeContent(text);
      setSummaryData(res.data);
      setViewState('split');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to process content. Please try again.');
      setViewState('upload');
    }
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header - Premium & Minimal */}
      <div className="h-20 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center px-6 bg-black text-white z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-gradient-to-br from-[#E53935] to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/50">
              <SafeIcon icon={FiCpu} className="w-6 h-6 text-white"/>
           </div>
           <div>
              <span className="font-bold text-xl tracking-tight block leading-tight">Smart AI Tutor</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Intelligent Document Assistant</span>
           </div>
        </div>
        {viewState === 'split' && (
          <button 
            onClick={() => setViewState('upload')}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
          >
            <SafeIcon icon={FiUpload} className="w-4 h-4" /> New Analysis
          </button>
        )}
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-hidden relative bg-[#F9FAFB] dark:bg-slate-900/50">
        {/* A. Upload State */}
        {viewState === 'upload' && (
          <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4 overflow-y-auto custom-scrollbar">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 p-6 sm:p-10 rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 max-w-lg w-full text-center my-auto"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                 <SafeIcon icon={FiUpload} className="w-8 h-8 sm:w-10 sm:h-10 text-[#E53935]" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Upload Knowledge</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6 text-xs sm:text-sm font-medium">Select analysis type and upload your document.</p>

              {/* Mode Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl mb-6 max-w-xs mx-auto">
                <button 
                  onClick={() => setAnalysisMode('study')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${analysisMode === 'study' ? 'bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Study Guide
                </button>
                <button 
                  onClick={() => setAnalysisMode('report')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${analysisMode === 'report' ? 'bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Test Report
                </button>
              </div>

                            {/* Test Selector for Report Mode */}
              {analysisMode === 'report' && (
                <div className="mb-5">
                  {loadingSubmissions ? (
                    <div className="text-xs text-gray-400 text-center py-3">Loading your tests...</div>
                  ) : recentSubmissions.length > 0 ? (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/50 rounded-xl p-4">
                      <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-3">🎯 Which test is this report for?</p>
                      <select
                        value={selectedSubmission?.id || ''}
                        onChange={e => {
                          const sub = recentSubmissions.find(s => String(s.id) === e.target.value);
                          setSelectedSubmission(sub || null);
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-600 rounded-lg text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        {recentSubmissions.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.courses?.name || 'Test'} — Score: {s.scaled_score || '?'} — {new Date(s.test_date).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}
                          </option>
                        ))}
                      </select>
                      {selectedSubmission && (
                        <div className="mt-2 flex gap-3 text-xs font-bold">
                          <span className="text-indigo-700 dark:text-indigo-300">Total: {selectedSubmission.scaled_score || '--'}/1600</span>
                          <span className="text-blue-600 dark:text-blue-300">Math: {selectedSubmission.math_scaled_score || '--'}/800</span>
                          <span className="text-green-600 dark:text-green-300">R&W: {selectedSubmission.reading_scaled_score || '--'}/800</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
                      No test submissions found. Complete a Full-Length SAT test first.
                    </div>
                  )}
                </div>
              )}


              <label className="block w-full border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-10 mb-4 hover:border-[#E53935] hover:bg-red-50 dark:hover:bg-red-500/5 cursor-pointer transition-all group">
                 <span className="text-sm font-bold text-gray-400 group-hover:text-[#E53935] transition-colors block text-center">
                    {file ? (
                      <span className="text-black dark:text-white flex items-center justify-center gap-2">
                        <SafeIcon icon={FiFileText} className="text-[#E53935] w-5 h-5" /> {file.name}
                      </span>
                    ) : (
                      <span className="flex flex-col items-center gap-2">
                        <FiUpload className="w-6 h-6 mb-1 mx-auto opacity-40 group-hover:opacity-100" />
                        Click to Upload Document
                      </span>
                    )}
                 </span>
                 <input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={(e) => {
                   if (e.target.files[0]) {
                     setFile(e.target.files[0]);
                     setUrl(''); // Clear URL when file is selected
                   }
                 }} />
              </label>

              {/* URL Input */}
              <div className="relative mb-6">
                 <SafeIcon icon={FiLink} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                 <input 
                    type="text" 
                    placeholder="Or paste a website URL..." 
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-700/50 border border-transparent focus:bg-white dark:focus:bg-gray-700 focus:border-gray-200 dark:focus:border-gray-600 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-[#E53935]/10 text-sm transition-all dark:text-white"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (e.target.value) setFile(null); // Clear file when URL is entered
                    }}
                 />
              </div>

              {error && <p className="text-red-600 text-xs mb-4 font-bold bg-red-50 dark:bg-red-500/10 p-3 rounded-lg border border-red-100 dark:border-red-900/30">{error}</p>}

              <button 
                onClick={handleProcess}
                disabled={analysisMode === 'report' ? !selectedSubmission : (!file && !url)}
                className="w-full py-4 bg-black dark:bg-white dark:text-black text-white rounded-xl font-extrabold hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm uppercase tracking-widest"
              >
                {analysisMode === 'report' ? '🎯 Generate SAT Analysis' : 'Analyze Content'}
              </button>
            </motion.div>
          </div>
        )}

        {/* B. Processing State */}
        {viewState === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900">
             <div className="relative">
                <motion.div 
                  animate={{ rotate: 360 }} 
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="w-20 h-20 border-4 border-gray-100 dark:border-gray-800 border-t-[#E53935] rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                   <SafeIcon icon={FiCpu} className="w-7 h-7 text-black dark:text-white" />
                </div>
             </div>
             <h3 className="mt-8 font-bold text-2xl text-gray-900 dark:text-white">Analyzing Content</h3>
             <p className="text-gray-400 dark:text-gray-500 mt-2 text-base font-medium">Extracting chapters & key concepts...</p>
          </div>
        )}

        {/* C. Split View State */}
        {viewState === 'split' && (
          <div className="flex h-full flex-col md:flex-row">
            {/* Left: Document Viewer (50%) */}
            <div className="h-1/2 md:h-full md:w-1/2 md:border-r border-b md:border-b-0 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
               <SmartDocViewer file={file} url={url} textContent={extractedText} />
            </div>

            {/* Right: AI Assistant (50%) */}
            <div className="h-1/2 md:h-full md:w-1/2 bg-[#F9FAFB] dark:bg-gray-800/50">
               <SmartAIPanel 
                  content={extractedText} 
                  summary={summaryData} 
                  mode={analysisMode}
                  reportData={reportAnalysis}
                  parsedReportData={parsedReportData}
                  selectedSubmission={selectedSubmission}
               />

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SmartAITutor;
