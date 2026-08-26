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

    const isDarkReport = type === 'Group' || type === 'Student';

    return (
        <div ref={ref} style={{ backgroundColor: isDarkReport ? '#0a0e24' : 'white', padding: '0', color: '#111827', width: '100%', fontFamily: 'Helvetica, Arial, sans-serif', boxSizing: 'border-box' }} className="hidden-pdf-container">

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

            {/* 3. GROUP REPORT (Full dashboard parity: KPIs, section averages, three Top-10
                 leaderboards, and the complete student roster - mirrors GroupLevelView.jsx's
                 own dark navy theme, paginated into Overview / Rankings / Roster pages) */}
            {type === 'Group' && data?.overview && (() => {
                const ov = data.overview;
                const students = data.students || [];
                const CARD_BG = '#111625';
                const BORDER = '#1e293b';
                const MUTED = '#94a3b8';

                const statCard = (label, value, color) => (
                    <div style={{ backgroundColor: CARD_BG, padding: '14px', borderRadius: '10px', border: `1px solid ${BORDER}`, textAlign: 'center', pageBreakInside: 'avoid' }}>
                        <p style={{ margin: '0 0 6px 0', fontSize: '10px', color: MUTED, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>{label}</p>
                        <p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color }}>{value}</p>
                    </div>
                );

                const sectionAverage = (label, section, accent) => (
                    <div style={{ flex: 1, backgroundColor: CARD_BG, padding: '16px', borderRadius: '10px', border: `1px solid ${accent}55`, pageBreakInside: 'avoid' }}>
                        <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: accent, textTransform: 'uppercase', fontWeight: 'bold' }}>{label}</p>
                        <p style={{ margin: 0, fontSize: '26px', fontWeight: 'bold', color: 'white' }}>{section?.averageScore || '--'} <span style={{ fontSize: '13px', color: MUTED, fontWeight: 'normal' }}>/ 800</span></p>
                        <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#cbd5e1' }}>{section?.testsCompleted || 0} tests completed &bull; {section?.accuracy || 0}% accuracy</p>
                    </div>
                );

                const leaderboard = (title, list, scoreKey, maxLabel, accent) => (
                    <div style={{ marginBottom: '22px', pageBreakInside: 'avoid' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: `${accent}33`, border: `1px solid ${accent}66`, borderRadius: '8px 8px 0 0', padding: '8px 12px' }}>
                            <h3 style={{ margin: 0, fontSize: '13px', color: accent, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>{title}</h3>
                            <span style={{ fontSize: '10px', color: MUTED, fontWeight: 'bold' }}>Max {maxLabel.replace('/', '').trim()}</span>
                        </div>
                        {(!list || list.length === 0) ? (
                            <p style={{ fontSize: '12px', color: MUTED, padding: '14px', backgroundColor: CARD_BG, border: `1px solid ${BORDER}`, borderTop: 'none' }}>No completed attempts yet.</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', border: `1px solid ${BORDER}`, borderTop: 'none' }}>
                                <thead>
                                    <tr style={{ color: MUTED }}>
                                        <th style={{ padding: '8px 12px', width: '15%', backgroundColor: CARD_BG, fontSize: '10px', textTransform: 'uppercase' }}>Rank</th>
                                        <th style={{ padding: '8px 12px', backgroundColor: CARD_BG, fontSize: '10px', textTransform: 'uppercase' }}>Student</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right', width: '25%', backgroundColor: CARD_BG, fontSize: '10px', textTransform: 'uppercase' }}>Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {list.map((st, idx) => (
                                        <tr key={st.id || idx} style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: idx % 2 === 0 ? '#0a0e24' : CARD_BG, pageBreakInside: 'avoid' }}>
                                            <td style={{ padding: '8px 12px', fontWeight: 'bold', color: accent }}>#{idx + 1}</td>
                                            <td style={{ padding: '8px 12px', fontWeight: 'bold', color: 'white' }}>{st.name}</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: 'white' }}>{st[scoreKey]} <span style={{ color: MUTED, fontWeight: 'normal' }}>{maxLabel}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                );

                const sectionTitle = (text) => (
                    <h3 style={{ fontSize: '15px', margin: '0 0 14px 0', color: 'white', fontWeight: 'bold' }}>{text}</h3>
                );

                return (
                    <div style={{ backgroundColor: '#0a0e24', padding: '24px', minHeight: '100%' }}>
                        {renderHeader(ov.groupName || 'Group Report', 'Group Performance & Analytics Report')}

                        {/* PAGE 1: Group Overview KPIs + Section Averages */}
                        <div style={{ marginBottom: '20px' }}>
                            {sectionTitle('Group Overview')}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '10px' }}>
                                {statCard('Total Students', ov.totalStudents || 0, 'white')}
                                {statCard('Active Students', ov.activeStudents || 0, '#34d399')}
                                {statCard('Completed Tests', ov.totalTestsCompleted || 0, '#60a5fa')}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '10px' }}>
                                {statCard('Total Questions', ov.totalQuestionsAttempted || 0, 'white')}
                                {statCard('Avg Accuracy', `${ov.overallAccuracy || 0}%`, '#818cf8')}
                                {statCard('Avg SAT Score', `${ov.averageSatScore || 0} / 1600`, '#fbbf24')}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                {statCard('Not Started', ov.studentsNotStarted || 0, '#f87171')}
                                {statCard('Avg Study Time', `${Math.round((ov.averageStudyTime || 0) / 60)}m`, 'white')}
                                {statCard('Group Progress', `${ov.overallGroupProgress || 0}%`, '#22d3ee')}
                            </div>
                        </div>

                        {/* Section Averages - Math vs Reading & Writing */}
                        <div style={{ display: 'flex', gap: '14px', pageBreakInside: 'avoid' }}>
                            {sectionAverage('Math Section Average', ov.math, '#60a5fa')}
                            {sectionAverage('Reading & Writing Section Average', ov.readingWriting, '#c084fc')}
                        </div>

                        {/* PAGE 2: Performance Rankings - Math + Reading & Writing */}
                        <div style={{ pageBreakBefore: 'always', paddingTop: '24px' }}>
                            {sectionTitle('Performance Rankings')}
                            {leaderboard('SAT Math — Top 10', ov.topMathStudents, 'math', '/ 800', '#60a5fa')}
                            {leaderboard('SAT Reading & Writing — Top 10', ov.topRwStudents, 'readingWriting', '/ 800', '#c084fc')}
                        </div>

                        {/* PAGE 3: Overall SAT Ranking + Full Student Roster */}
                        <div style={{ pageBreakBefore: 'always', paddingTop: '24px' }}>
                            {sectionTitle('Overall SAT & Student Roster')}
                            {leaderboard('Overall SAT — Top 10', ov.topOverallStudents, 'satScore', '/ 1600', '#fbbf24')}

                            <div style={{ marginTop: '10px' }}>
                                <div style={{ backgroundColor: `#60a5fa33`, border: `1px solid #60a5fa66`, borderRadius: '8px 8px 0 0', padding: '8px 12px' }}>
                                    <h3 style={{ margin: 0, fontSize: '13px', color: 'white', fontWeight: 'bold' }}>
                                        Student Roster ({students.length} {students.length === 1 ? 'Student' : 'Students'})
                                    </h3>
                                </div>
                                {students.length === 0 ? (
                                    <p style={{ fontSize: '12px', color: MUTED, padding: '14px', backgroundColor: CARD_BG, border: `1px solid ${BORDER}`, borderTop: 'none' }}>No students enrolled in this group.</p>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', textAlign: 'left', border: `1px solid ${BORDER}`, borderTop: 'none' }}>
                                        <thead>
                                            <tr style={{ color: MUTED }}>
                                                <th style={{ padding: '8px 10px', backgroundColor: CARD_BG, fontSize: '9.5px', textTransform: 'uppercase' }}>Student</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'center', backgroundColor: CARD_BG, fontSize: '9.5px', textTransform: 'uppercase' }}>Math</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'center', backgroundColor: CARD_BG, fontSize: '9.5px', textTransform: 'uppercase' }}>R&amp;W</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'center', backgroundColor: CARD_BG, fontSize: '9.5px', textTransform: 'uppercase' }}>SAT</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'center', backgroundColor: CARD_BG, fontSize: '9.5px', textTransform: 'uppercase' }}>Accuracy</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'center', backgroundColor: CARD_BG, fontSize: '9.5px', textTransform: 'uppercase' }}>Tests</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'center', backgroundColor: CARD_BG, fontSize: '9.5px', textTransform: 'uppercase' }}>Progress</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'center', backgroundColor: CARD_BG, fontSize: '9.5px', textTransform: 'uppercase' }}>Study</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map((s, idx) => (
                                                <tr key={s.id || idx} style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: idx % 2 === 0 ? '#0a0e24' : CARD_BG, pageBreakInside: 'avoid' }}>
                                                    <td style={{ padding: '8px 10px' }}><strong style={{ color: 'white' }}>{s.name}</strong><br/><span style={{ color: MUTED, fontSize: '9px' }}>{s.email}</span></td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'center', color: '#60a5fa', fontWeight: 'bold' }}>{s.math}</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'center', color: '#c084fc', fontWeight: 'bold' }}>{s.readingWriting}</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'center', color: '#fbbf24', fontWeight: 'bold' }}>{s.satScore}</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'center', color: '#34d399', fontWeight: 'bold' }}>{s.accuracy}</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'center', color: 'white' }}>{s.tests}</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'center', color: 'white' }}>{s.progress}</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'center', color: '#cbd5e1' }}>{s.studyTime}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* 4. STUDENT REPORT (Full dashboard parity: R&W/Math/Overall score cards, a
                 hand-drawn SVG score-progression chart - not the live Recharts component, since
                 ResponsiveContainer's size-measurement doesn't reliably survive being rendered
                 inside PdfExportWrapper's hidden/off-screen capture container - and the complete
                 Completed Tests table. Mirrors StudentLevelView.jsx. Consumes the RAW backend
                 payload shape { student, overall, math, readingWriting, trend, completedAttempts }
                 - this data has no `overview`/`students` keys, so the old shared Group/Student/
                 Course branch never matched this shape and rendered nothing for Student PDFs. */}
            {type === 'Student' && (data?.overall || data?.math || data?.readingWriting) && (() => {
                const overall = data.overall || {};
                const math = data.math || {};
                const rw = data.readingWriting || {};
                const trend = data.trend || [];
                const attempts = data.completedAttempts || [];
                const CARD_BG = '#111625';
                const BORDER = '#1e293b';
                const MUTED = '#94a3b8';

                const fmtTime = (sec) => {
                    if (!sec || sec <= 0) return '0s';
                    const m = Math.floor(sec / 60);
                    const s = Math.round(sec % 60);
                    return m > 0 ? `${m}m ${s}s` : `${s}s`;
                };

                const trendPill = (improvement) => {
                    const n = parseFloat(improvement);
                    const positive = !isNaN(n) && n > 0;
                    const negative = !isNaN(n) && n < 0;
                    const color = positive ? '#34d399' : negative ? '#f87171' : MUTED;
                    const text = improvement === undefined || improvement === null ? 'N/A' : `${positive ? '+' : ''}${improvement} Impr.`;
                    return (
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color, backgroundColor: `${color}22`, border: `1px solid ${color}55`, borderRadius: '999px', padding: '2px 8px' }}>{text}</span>
                    );
                };

                const scoreCard = (label, accent, best, max, stats, extra) => (
                    <div style={{ flex: 1, backgroundColor: CARD_BG, border: `1px solid ${accent}55`, borderRadius: '10px', padding: '16px', pageBreakInside: 'avoid' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 'bold', color: accent, backgroundColor: `${accent}22`, border: `1px solid ${accent}55`, borderRadius: '6px', padding: '3px 8px', textTransform: 'uppercase' }}>{label}</span>
                            {extra}
                        </div>
                        <p style={{ margin: 0, fontSize: '30px', fontWeight: 'bold', color: 'white' }}>{best ?? '--'} <span style={{ fontSize: '14px', color: MUTED, fontWeight: 'normal' }}>/ {max}</span></p>
                        <p style={{ margin: '2px 0 12px 0', fontSize: '10px', color: MUTED }}>Best {label} Score</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', borderTop: `1px solid ${BORDER}`, paddingTop: '10px' }}>
                            {stats.map(([k, v], i) => (
                                <div key={i}>
                                    <p style={{ margin: '0 0 2px 0', fontSize: '9px', color: MUTED, textTransform: 'uppercase' }}>{k}</p>
                                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: 'white' }}>{v}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                );

                // Hand-drawn SVG line chart (SAT Total / Math / R&W vs. attempt index). Built with
                // fixed pixel coordinates rather than Recharts' <ResponsiveContainer>, which
                // measures its own size via ResizeObserver - unreliable inside a hidden capture div.
                const chartW = 720, chartH = 200;
                const pad = { left: 44, right: 12, top: 12, bottom: 22 };
                const innerW = chartW - pad.left - pad.right;
                const innerH = chartH - pad.top - pad.bottom;
                const yMin = 400, yMax = 1600;
                const n = trend.length;
                const xFor = (i) => pad.left + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
                const yFor = (v) => {
                    const clamped = Math.max(yMin, Math.min(yMax, v || yMin));
                    return pad.top + innerH - ((clamped - yMin) / (yMax - yMin)) * innerH;
                };
                const linePoints = (key) => trend.map((t, i) => `${xFor(i)},${yFor(t[key])}`).join(' ');
                const gridLines = [400, 700, 1000, 1300, 1600];

                return (
                    <div style={{ backgroundColor: '#0a0e24', padding: '24px', minHeight: '100%' }}>
                        {renderHeader(data.student?.name || studentName || 'Student Report', 'Student Performance Report')}

                        {/* Three score cards - Reading & Writing / Math / Overall SAT */}
                        <div style={{ display: 'flex', gap: '14px', marginBottom: '22px' }}>
                            {scoreCard('Reading & Writing', '#c084fc', rw.bestScore, 800, [
                                ['Average Score', rw.averageScore ?? '--'],
                                ['Lowest', rw.lowestScore ?? '--'],
                                ['Accuracy', `${rw.accuracy || 0}%`],
                                ['Tests Done', rw.testsCompleted || 0]
                            ], trendPill(rw.scoreImprovement))}
                            {scoreCard('SAT Math', '#60a5fa', math.bestScore, 800, [
                                ['Average Score', math.averageScore ?? '--'],
                                ['Lowest', math.lowestScore ?? '--'],
                                ['Accuracy', `${math.accuracy || 0}%`],
                                ['Tests Done', math.testsCompleted || 0]
                            ], trendPill(math.scoreImprovement))}
                            {scoreCard('Overall SAT Score', '#fbbf24', overall.bestSatScore, 1600, [
                                ['Average SAT Score', overall.averageSatScore ?? '--'],
                                ['Overall Accuracy', `${overall.overallAccuracy || 0}%`],
                                ['Tests Completed', overall.completedTests || 0],
                                ['Total Questions', overall.totalQuestions || 0]
                            ], (
                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#22d3ee', backgroundColor: '#22d3ee22', border: '1px solid #22d3ee55', borderRadius: '999px', padding: '2px 8px' }}>
                                    Status: {overall.trendStatus || 'Stable'}
                                </span>
                            ))}
                        </div>

                        {/* Questions breakdown line for Math / R&W */}
                        <div style={{ display: 'flex', gap: '14px', marginBottom: '22px', fontSize: '10px', color: MUTED, pageBreakInside: 'avoid' }}>
                            <p style={{ flex: 1, margin: 0 }}>R&amp;W Questions: {rw.totalQuestions || 0} (<span style={{ color: '#34d399' }}>&#10003; {rw.correct || 0}</span> | <span style={{ color: '#f87171' }}>&#10007; {rw.incorrect || 0}</span>)</p>
                            <p style={{ flex: 1, margin: 0 }}>Math Questions: {math.totalQuestions || 0} (<span style={{ color: '#34d399' }}>&#10003; {math.correct || 0}</span> | <span style={{ color: '#f87171' }}>&#10007; {math.incorrect || 0}</span>)</p>
                        </div>

                        {/* SAT Score Progression chart */}
                        <div style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '16px', marginBottom: '22px', pageBreakInside: 'avoid' }}>
                            <h3 style={{ margin: '0 0 2px 0', fontSize: '13px', color: 'white', fontWeight: 'bold' }}>SAT Score Progression</h3>
                            <p style={{ margin: '0 0 10px 0', fontSize: '10px', color: MUTED }}>Historical scaled score changes over practice attempts</p>
                            {n === 0 ? (
                                <p style={{ fontSize: '12px', color: MUTED, padding: '20px 0', textAlign: 'center' }}>No completed attempts yet.</p>
                            ) : (
                                <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ display: 'block' }}>
                                    {gridLines.map((g) => (
                                        <g key={g}>
                                            <line x1={pad.left} x2={chartW - pad.right} y1={yFor(g)} y2={yFor(g)} stroke="#1e293b" strokeDasharray="3 3" />
                                            <text x={pad.left - 6} y={yFor(g) + 3} fontSize="9" fill={MUTED} textAnchor="end">{g}</text>
                                        </g>
                                    ))}
                                    {trend.map((t, i) => (
                                        <text key={i} x={xFor(i)} y={chartH - 4} fontSize="9" fill={MUTED} textAnchor="middle">{t.name || `Test ${i + 1}`}</text>
                                    ))}
                                    <polyline points={linePoints('mathScore')} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" />
                                    <polyline points={linePoints('rwScore')} fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="4 4" />
                                    <polyline points={linePoints('satScore')} fill="none" stroke="#f59e0b" strokeWidth="3" />
                                    {trend.map((t, i) => (
                                        <circle key={i} cx={xFor(i)} cy={yFor(t.satScore)} r="3.5" fill="#f59e0b" />
                                    ))}
                                </svg>
                            )}
                            <div style={{ display: 'flex', gap: '18px', marginTop: '8px', fontSize: '10px' }}>
                                <span style={{ color: '#f59e0b' }}>&#9679; SAT Total (/ 1600)</span>
                                <span style={{ color: '#3b82f6' }}>&#9679; Math (/ 800)</span>
                                <span style={{ color: '#a855f7' }}>&#9679; R&amp;W (/ 800)</span>
                            </div>
                        </div>

                        {/* Completed Tests table */}
                        <div style={{ pageBreakBefore: attempts.length > 6 ? 'always' : 'auto', paddingTop: attempts.length > 6 ? '10px' : '0' }}>
                            <div style={{ backgroundColor: '#60a5fa33', border: '1px solid #60a5fa66', borderRadius: '8px 8px 0 0', padding: '8px 12px' }}>
                                <h3 style={{ margin: 0, fontSize: '13px', color: 'white', fontWeight: 'bold' }}>Completed Tests ({attempts.length})</h3>
                            </div>
                            {attempts.length === 0 ? (
                                <p style={{ fontSize: '12px', color: MUTED, padding: '14px', backgroundColor: CARD_BG, border: `1px solid ${BORDER}`, borderTop: 'none' }}>No completed tests yet.</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', border: `1px solid ${BORDER}`, borderTop: 'none' }}>
                                    <thead>
                                        <tr style={{ color: MUTED }}>
                                            <th style={{ padding: '8px 10px', backgroundColor: CARD_BG, fontSize: '9.5px', textTransform: 'uppercase' }}>Test / Topic</th>
                                            <th style={{ padding: '8px 10px', backgroundColor: CARD_BG, fontSize: '9.5px', textTransform: 'uppercase' }}>Date</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'center', backgroundColor: CARD_BG, fontSize: '9.5px', textTransform: 'uppercase' }}>Status</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'center', backgroundColor: CARD_BG, fontSize: '9.5px', textTransform: 'uppercase' }}>Accuracy</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'center', backgroundColor: CARD_BG, fontSize: '9.5px', textTransform: 'uppercase' }}>Score</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'center', backgroundColor: CARD_BG, fontSize: '9.5px', textTransform: 'uppercase' }}>Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attempts.map((a, idx) => (
                                            <tr key={a.courseId || idx} style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: idx % 2 === 0 ? '#0a0e24' : CARD_BG, pageBreakInside: 'avoid' }}>
                                                <td style={{ padding: '8px 10px' }}>
                                                    <strong style={{ color: 'white' }}>{a.testName || a.topicName || 'Test'}</strong>
                                                    {a.courseName && a.testName && <br/>}
                                                    {a.courseName && a.testName && <span style={{ color: MUTED, fontSize: '9px' }}>{a.courseName}</span>}
                                                </td>
                                                <td style={{ padding: '8px 10px', color: '#cbd5e1' }}>{fDate(a.date)}</td>
                                                <td style={{ padding: '8px 10px', textAlign: 'center', color: a.isFullyCompleted ? '#34d399' : '#fbbf24', fontWeight: 'bold', fontSize: '9.5px' }}>
                                                    {a.isFullyCompleted ? 'Completed' : `In Progress (${(a.activeLevels || []).length}/3)`}
                                                </td>
                                                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#34d399', fontWeight: 'bold' }}>{a.isFullyCompleted ? `${a.accuracy}%` : '--'}</td>
                                                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#fbbf24', fontWeight: 'bold' }}>{a.isFullyCompleted ? `${a.scaledScore} / 800` : '--'}</td>
                                                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#cbd5e1' }}>{fmtTime(a.timeTaken)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* 5. COURSE (Minimal support to prevent breakage, formatted cleanly) */}
            {type === 'Course' && data?.overview && (
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
