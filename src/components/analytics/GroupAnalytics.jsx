import React, { useState } from 'react';
import GroupLevelView from './GroupLevelView';
import StudentLevelView from './StudentLevelView';
import CourseLevelView from './CourseLevelView';
import DomainLevelView from './DomainLevelView';
import TopicLevelView from './TopicLevelView';
import AttemptLevelView from './AttemptLevelView';
import TopicCombinedReportView from './TopicCombinedReportView';
import GroupContentLevelView from './GroupContentLevelView';
import AnalyticsBreadcrumb from './AnalyticsBreadcrumb';
import TestReview from '../student/agents/TestReview';

/**
 * Master Controller for the Advanced Hierarchical Analytics System
 * 
 * Levels of Drill-down:
 * 1. Group (GroupLevelView)
 * 2. Student (StudentLevelView)
 * 3. Section/Course (CourseLevelView - SAT Math / SAT Reading & Writing)
 * 4. Domain (DomainLevelView - Advanced Math, Algebra, etc.)
 * 5. Subtopic (TopicLevelView - Equivalent Expressions, etc.)
 * 6. Attempt / Question-Wise (AttemptLevelView)
 */
const GroupAnalytics = ({ groupId, groupName, adminMode = false, onBack }) => {
    
    // Navigation State
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedCourseName, setSelectedCourseName] = useState(null);
    const [selectedDomain, setSelectedDomain] = useState(null);
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [selectedAttemptId, setSelectedAttemptId] = useState(null);
    // Set from the Student Report's "Completed Tests" table - opens a topic's combined
    // (Easy+Medium+Hard) report directly, bypassing the Course/Domain/Topic drill-down.
    const [selectedTopicReportCourseId, setSelectedTopicReportCourseId] = useState(null);

    // Content drill-down (Section -> Topic -> Subtopic), entered from the Group Dashboard's
    // "Content Analytics" section - independent of the student-first hierarchy above. Each
    // entry: { level: 'section'|'topic'|'subtopic', name, courseIds, data }.
    const [contentPath, setContentPath] = useState([]);
    // Set from either the plain Student Performance Table or a content-hierarchy leaf's
    // Student Performance table - kept as in-memory state (never a route navigate) so its Back
    // button returns to exactly the group/student/content context it was opened from, instead
    // of leaving Student Groups entirely.
    const [testHistoryStudent, setTestHistoryStudent] = useState(null);

    // Build breadcrumb path
    const buildPath = () => {
        const path = [{ id: 'group', level: 1, label: groupName || 'Group Analytics' }];
        if (selectedStudent) path.push({ id: 'student', level: 2, label: selectedStudent.name });
        if (selectedCourseName) path.push({ id: 'course', level: 3, label: selectedCourseName });
        if (selectedDomain) path.push({ id: 'domain', level: 4, label: selectedDomain.name });
        if (selectedTopic) path.push({ id: 'topic', level: 5, label: selectedTopic.name });
        if (selectedAttemptId) path.push({ id: 'attempt', level: 6, label: `Attempt #${selectedAttemptId}` });
        if (selectedTopicReportCourseId) path.push({ id: 'topic-report', level: 6, label: 'Combined Report' });
        contentPath.forEach((entry, idx) => path.push({ id: `content-${idx}`, level: `content-${idx}`, label: entry.name }));
        if (testHistoryStudent) path.push({ id: 'test-history', level: 'test-history', label: `${testHistoryStudent.name} — Test History` });
        return path;
    };

    const handleNavigate = (level) => {
        if (typeof level === 'string' && level.startsWith('content-')) {
            const depth = parseInt(level.split('-')[1], 10);
            setContentPath(prev => prev.slice(0, depth + 1));
            setTestHistoryStudent(null);
            return;
        }
        if (level === 'test-history') {
            setTestHistoryStudent(null);
            return;
        }
        if (level === 1) {
            setSelectedStudent(null);
            setSelectedCourseName(null);
            setSelectedDomain(null);
            setSelectedTopic(null);
            setSelectedAttemptId(null);
            setSelectedTopicReportCourseId(null);
            setContentPath([]);
            setTestHistoryStudent(null);
        } else if (level === 2) {
            setSelectedCourseName(null);
            setSelectedDomain(null);
            setSelectedTopic(null);
            setSelectedAttemptId(null);
            setSelectedTopicReportCourseId(null);
            setTestHistoryStudent(null);
        } else if (level === 3) {
            setSelectedDomain(null);
            setSelectedTopic(null);
            setSelectedAttemptId(null);
        } else if (level === 4) {
            setSelectedTopic(null);
            setSelectedAttemptId(null);
        } else if (level === 5) {
            setSelectedAttemptId(null);
        }
    };

    // Render Logic based on deep-link state
    const renderView = () => {
        // Highest priority regardless of origin (plain Student Performance Table or a content
        // hierarchy leaf) - onBack only clears this one piece of state, so whatever else was
        // active underneath (contentPath, selectedStudent, or nothing) is exactly preserved.
        if (testHistoryStudent) {
            return (
                <TestReview
                    studentId={testHistoryStudent.id}
                    basePath={adminMode ? '/admin' : '/tutor'}
                    onBack={() => setTestHistoryStudent(null)}
                />
            );
        }

        if (selectedTopicReportCourseId) {
            return (
                <TopicCombinedReportView
                    groupId={groupId}
                    student={selectedStudent}
                    courseId={selectedTopicReportCourseId}
                    adminMode={adminMode}
                    onBack={() => setSelectedTopicReportCourseId(null)}
                />
            );
        }

        if (selectedAttemptId) {
            return (
                <AttemptLevelView 
                    groupId={groupId}
                    submissionId={selectedAttemptId}
                    adminMode={adminMode}
                    onBack={() => setSelectedAttemptId(null)}
                />
            );
        }

        if (selectedTopic) {
            return (
                <TopicLevelView 
                    groupId={groupId}
                    topic={selectedTopic}
                    student={selectedStudent}
                    adminMode={adminMode}
                    onBack={() => setSelectedTopic(null)}
                    onAttemptSelect={(attemptId) => setSelectedAttemptId(attemptId)}
                />
            );
        }

        if (selectedDomain) {
            return (
                <DomainLevelView 
                    domain={selectedDomain}
                    student={selectedStudent}
                    onBack={() => setSelectedDomain(null)}
                    onTopicSelect={(subtopic) => setSelectedTopic(subtopic)}
                />
            );
        }

        if (selectedCourseName) {
            return (
                <CourseLevelView 
                    groupId={groupId}
                    student={selectedStudent}
                    courseName={selectedCourseName}
                    adminMode={adminMode}
                    onBack={() => setSelectedCourseName(null)}
                    onDomainSelect={(domain) => setSelectedDomain(domain)}
                    onTopicSelect={(topic) => {
                        if (topic.subtopics && topic.subtopics.length > 0) {
                            setSelectedDomain(topic);
                        } else {
                            setSelectedTopic(topic);
                        }
                    }}
                />
            );
        }

        if (selectedStudent) {
            return (
                <StudentLevelView 
                    groupId={groupId}
                    student={selectedStudent}
                    adminMode={adminMode}
                    onBack={() => setSelectedStudent(null)}
                    onCourseSelect={(courseName) => setSelectedCourseName(courseName)}
                    onTopicReportSelect={(courseId) => setSelectedTopicReportCourseId(courseId)}
                />
            );
        }

        if (contentPath.length > 0) {
            const depth = contentPath.length - 1;
            const current = contentPath[depth];
            const isLeaf = current.level === 'subtopic';

            let childItems = null;
            if (current.level === 'section') {
                childItems = {
                    levelLabel: 'Topic',
                    items: Object.values(current.data.topics).map(t => ({ key: t.name, label: t.name, courseIds: t.courseIds, raw: t }))
                };
            } else if (current.level === 'topic') {
                childItems = {
                    levelLabel: 'Subtopic/Test',
                    items: current.data.subtopics.map(s => ({ key: s.name, label: s.name, courseIds: [s.courseId], raw: s }))
                };
            }

            return (
                <GroupContentLevelView
                    groupId={groupId}
                    adminMode={adminMode}
                    title={current.name}
                    subtitle={contentPath.slice(0, depth).map(e => e.name).join(' → ') || undefined}
                    courseIds={current.courseIds}
                    childItems={isLeaf ? null : childItems}
                    onChildSelect={(child) => {
                        const nextLevel = current.level === 'section' ? 'topic' : 'subtopic';
                        setContentPath(prev => [...prev, { level: nextLevel, name: child.label, courseIds: child.courseIds, data: child.raw }]);
                    }}
                    onBack={() => setContentPath(prev => prev.slice(0, prev.length - 1))}
                    onStudentAnalytics={(student) => setSelectedStudent(student)}
                    onStudentTestHistory={(student) => setTestHistoryStudent(student)}
                />
            );
        }

        // Default: Level 1 - Group Dashboard
        return (
            <GroupLevelView
                groupId={groupId}
                adminMode={adminMode}
                onStudentSelect={(student) => setSelectedStudent(student)}
                onTestHistorySelect={(student) => setTestHistoryStudent(student)}
                onContentSectionSelect={(section) => setContentPath([{ level: 'section', name: section.name, courseIds: section.courseIds, data: section }])}
            />
        );
    };

    return (
        <div>
            <AnalyticsBreadcrumb path={buildPath()} onNavigate={handleNavigate} onBackToGroups={onBack} />
            {renderView()}
        </div>
    );
};

export default GroupAnalytics;
