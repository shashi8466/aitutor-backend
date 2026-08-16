import React from 'react';

/**
 * A hidden, standardized academic report template for PDF generation.
 * Specifically styled to match the "reports.pdf" reference design, utilizing
 * inline styles for reliable html2pdf.js rendering.
 */
export const PdfReportTemplate = React.forwardRef(({ type, data, groupName, studentName }, ref) => {

    const fDate = (d) => d ? new Date(d).toLocaleDateString() : 'N/A';

    // Renders the branded blue header seen in reports.pdf
    const renderHeader = (title, subtitle) => (
        <div style={{ backgroundColor: '#1e3a8a', color: 'white', padding: '30px', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
                <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', letterSpacing: '2px' }}>AIPREP365</h1>
                <h2 style={{ margin: '5px 0 0 0', fontSize: '18px', fontWeight: 'normal', opacity: 0.9 }}>{title}</h2>
                <h3 style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#93c5fd' }}>{subtitle}</h3>
            </div>
            <div style={{ textAlign: 'right', fontSize: '14px', opacity: 0.9 }}>
                <p style={{ margin: 0 }}>Date: {new Date().toLocaleDateString()}</p>
                {studentName && <p style={{ margin: '5px 0 0 0' }}>Student: <strong>{studentName}</strong></p>}
                {groupName && <p style={{ margin: '5px 0 0 0' }}>Group: <strong>{groupName}</strong></p>}
            </div>
        </div>
    );

    // Reusable Question Log Table
    const renderQuestionLog = (title, questions) => (
        <div style={{ marginTop: '30px', pageBreakInside: 'avoid' }}>
            <h3 style={{ fontSize: '18px', borderBottom: '2px solid #1e3a8a', paddingBottom: '5px', marginBottom: '15px', color: '#1e3a8a' }}>{title}</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                        <th style={{ padding: '8px', fontWeight: 'bold' }}>Q#</th>
                        <th style={{ padding: '8px', fontWeight: 'bold' }}>Question Snippet</th>
                        <th style={{ padding: '8px', fontWeight: 'bold' }}>Difficulty</th>
                        <th style={{ padding: '8px', fontWeight: 'bold', textAlign: 'center' }}>Result</th>
                        <th style={{ padding: '8px', fontWeight: 'bold' }}>Student Ans</th>
                        <th style={{ padding: '8px', fontWeight: 'bold' }}>Correct Ans</th>
                    </tr>
                </thead>
                <tbody>
                    {questions.map((q, idx) => {
                        // Strip HTML tags for PDF question snippet
                        const strippedText = (q.questionText || '').replace(/(<([^>]+)>)/gi, "").substring(0, 80) + '...';
                        return (
                            <tr key={q.questionId || idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                                <td style={{ padding: '8px' }}>{q.displayIndex || (idx + 1)}</td>
                                <td style={{ padding: '8px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{strippedText}</td>
                                <td style={{ padding: '8px' }}>{q.difficulty || 'Medium'}</td>
                                <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: q.isCorrect === true ? '#166534' : q.isCorrect === false ? '#991b1b' : '#4b5563' }}>
                                    {q.isCorrect === true ? '✓' : q.isCorrect === false ? '✕' : '–'}
                                </td>
                                <td style={{ padding: '8px', color: q.isCorrect === false ? '#991b1b' : 'inherit' }}>{q.studentAnswer || '—'}</td>
                                <td style={{ padding: '8px', fontWeight: 'bold' }}>{q.correctAnswer}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    return (
        <div ref={ref} style={{ backgroundColor: 'white', padding: '0', color: '#111827', width: '100%', fontFamily: 'Helvetica, Arial, sans-serif', boxSizing: 'border-box' }} className="hidden-pdf-container">
            
            {/* 1. TOPIC COMBINED REPORT (New SAT Regular Course Spec) */}
            {type === 'TopicCombined' && data?.overall && (
                <div style={{ padding: '20px' }}>
                    {renderHeader(`${data.courseName || 'SAT Course'} - ${data.topicName}`, 'Topic Performance Report')}

                    {/* Total Score Visualization */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                        <div style={{ flex: '1', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: '#64748b', marginBottom: '10px' }}>Total Topic Accuracy</h3>
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '120px', height: '120px', borderRadius: '50%', border: '8px solid #1e3a8a', color: '#1e3a8a', fontSize: '32px', fontWeight: 'bold' }}>
                                {data.overall.accuracy}%
                            </div>
                        </div>
                        
                        <div style={{ flex: '2', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: '#64748b', marginBottom: '15px' }}>Performance Overview</h3>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                <div>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Total Questions</p>
                                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{data.overall.totalQuestions}</p>
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Correct</p>
                                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#166534' }}>{data.overall.correct}</p>
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Incorrect</p>
                                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#991b1b' }}>{data.overall.incorrect}</p>
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Time Spent</p>
                                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{Math.floor(data.overall.totalTime / 60)}m</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Breakdown by Level */}
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ fontSize: '18px', borderBottom: '2px solid #1e3a8a', paddingBottom: '5px', marginBottom: '15px', color: '#1e3a8a' }}>Level Progression Breakdown</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#1e3a8a', color: 'white' }}>
                                    <th style={{ padding: '10px' }}>Level</th>
                                    <th style={{ padding: '10px' }}>Status</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>Score</th>
                                    <th style={{ padding: '10px', width: '40%' }}>Accuracy Bar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {['Easy', 'Medium', 'Hard'].map(lvl => {
                                    const lData = data.levels[lvl];
                                    const completed = lData && lData.latest;
                                    const acc = completed ? lData.score : 0;
                                    return (
                                        <tr key={lvl} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: completed ? 'white' : '#f8fafc' }}>
                                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{lvl}</td>
                                            <td style={{ padding: '10px', color: completed ? '#166534' : '#64748b' }}>{completed ? 'Completed' : 'Pending'}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{completed ? `${acc}%` : '-'}</td>
                                            <td style={{ padding: '10px' }}>
                                                {completed && (
                                                    <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '4px', height: '12px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${acc}%`, backgroundColor: acc >= 80 ? '#166534' : acc >= 60 ? '#ca8a04' : '#991b1b', height: '100%' }}></div>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Subskills & Analysis */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', pageBreakInside: 'avoid' }}>
                        <div style={{ flex: '1', backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                            <h4 style={{ color: '#166534', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '14px' }}>Strengths</h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                                {data.strengths?.length > 0 ? data.strengths.map((s,i)=><li key={i}>{s}</li>) : <li>No distinct strengths yet.</li>}
                            </ul>
                        </div>
                        <div style={{ flex: '1', backgroundColor: '#fef2f2', padding: '15px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                            <h4 style={{ color: '#991b1b', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '14px' }}>Areas for Focus</h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                                {data.weaknesses?.length > 0 ? data.weaknesses.map((w,i)=><li key={i}>{w}</li>) : <li>No distinct weaknesses yet.</li>}
                            </ul>
                        </div>
                    </div>

                    {/* Detailed Question Logs */}
                    {['Easy', 'Medium', 'Hard'].map(lvl => {
                        const lData = data.levels[lvl];
                        if (!lData || !lData.latest || !lData.questions?.length) return null;
                        return renderQuestionLog(`${lvl} Level Log`, lData.questions);
                    })}
                </div>
            )}

            {/* 2. ATTEMPT REPORT (Legacy / Standard Quiz) */}
            {type === 'Attempt' && data?.attempt && (
                <div style={{ padding: '20px' }}>
                    {renderHeader(data.attempt.courseName, 'Test Attempt Report')}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-around', backgroundColor: '#f3f4f6', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#4b5563', textTransform: 'uppercase' }}>Score</p>
                            <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#1e3a8a' }}>{data.attempt.score}%</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#4b5563', textTransform: 'uppercase' }}>Correct</p>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#166534' }}>{data.attempt.correct} / {data.attempt.totalQuestions}</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#4b5563', textTransform: 'uppercase' }}>Time Spent</p>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{Math.floor(data.attempt.timeSpent / 60)}m</p>
                        </div>
                    </div>

                    {data.topicPerformance && data.topicPerformance.length > 0 && (
                        <div style={{ marginBottom: '30px' }}>
                            <h3 style={{ fontSize: '18px', borderBottom: '2px solid #1e3a8a', paddingBottom: '5px', marginBottom: '15px', color: '#1e3a8a' }}>Topic Breakdown</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#1e3a8a', color: 'white' }}>
                                        <th style={{ padding: '10px' }}>Topic</th>
                                        <th style={{ padding: '10px', textAlign: 'center' }}>Total</th>
                                        <th style={{ padding: '10px', textAlign: 'center' }}>Correct</th>
                                        <th style={{ padding: '10px', textAlign: 'center' }}>Accuracy</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.topicPerformance.map((t, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{t.topicName}</td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>{t.total}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', color: '#166534' }}>{t.correct}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{t.accuracy}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {data.questions && data.questions.length > 0 && renderQuestionLog('Question-by-Question Log', data.questions)}
                </div>
            )}

            {/* 3. GROUP / COURSE / STUDENT (Minimal support to prevent breakage, formatted cleanly) */}
            {(type === 'Group' || type === 'Student' || type === 'Course') && data?.overview && (
                 <div style={{ padding: '20px' }}>
                    {renderHeader(data.overview.groupName || data.overview.courseName || 'Summary Report', `${type} Analytics Overview`)}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '30px' }}>
                        {Object.entries(data.overview).slice(0, 8).map(([k, v], i) => (
                            <div key={i} style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>{k.replace(/([A-Z])/g, ' $1').trim()}</p>
                                <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>{v}</p>
                            </div>
                        ))}
                    </div>

                    {data.students && (
                        <div>
                             <h3 style={{ fontSize: '18px', borderBottom: '2px solid #1e3a8a', paddingBottom: '5px', marginBottom: '15px', color: '#1e3a8a' }}>Student Roster</h3>
                             <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#1e3a8a', color: 'white' }}>
                                        <th style={{ padding: '10px' }}>Name</th>
                                        <th style={{ padding: '10px', textAlign: 'center' }}>Tests</th>
                                        <th style={{ padding: '10px', textAlign: 'center' }}>Avg Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.students.map((s, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                                            <td style={{ padding: '10px' }}><strong>{s.name}</strong><br/><span style={{ color: '#64748b', fontSize: '11px' }}>{s.email}</span></td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>{s.testsCompleted}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{s.averageScore}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                 </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: '40px', padding: '20px', borderTop: '1px solid #e5e7eb', textAlign: 'center', fontSize: '10px', color: '#9ca3af' }}>
                <p style={{ margin: 0 }}>AIPrep365 Analytics Engine &copy; {new Date().getFullYear()}</p>
                <p style={{ margin: '5px 0 0 0' }}>Confidential Academic Record generated for internal reporting.</p>
            </div>
        </div>
    );
});

export default PdfReportTemplate;
