import React, { useState } from 'react';
import GroupLevelView from './GroupLevelView';
import StudentLevelView from './StudentLevelView';
import CourseLevelView from './CourseLevelView';
import DomainLevelView from './DomainLevelView';
import TopicLevelView from './TopicLevelView';
import AttemptLevelView from './AttemptLevelView';
import TopicCombinedReportView from './TopicCombinedReportView';
import AnalyticsBreadcrumb from './AnalyticsBreadcrumb';

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

    // Build breadcrumb path
    const buildPath = () => {
        const path = [{ id: 'group', level: 1, label: groupName || 'Group Analytics' }];
        if (selectedStudent) path.push({ id: 'student', level: 2, label: selectedStudent.name });
        if (selectedCourseName) path.push({ id: 'course', level: 3, label: selectedCourseName });
        if (selectedDomain) path.push({ id: 'domain', level: 4, label: selectedDomain.name });
        if (selectedTopic) path.push({ id: 'topic', level: 5, label: selectedTopic.name });
        if (selectedAttemptId) path.push({ id: 'attempt', level: 6, label: `Attempt #${selectedAttemptId}` });
        if (selectedTopicReportCourseId) path.push({ id: 'topic-report', level: 6, label: 'Combined Report' });
        return path;
    };

    const handleNavigate = (level) => {
        if (level === 1) {
            setSelectedStudent(null);
            setSelectedCourseName(null);
            setSelectedDomain(null);
            setSelectedTopic(null);
            setSelectedAttemptId(null);
            setSelectedTopicReportCourseId(null);
        } else if (level === 2) {
            setSelectedCourseName(null);
            setSelectedDomain(null);
            setSelectedTopic(null);
            setSelectedAttemptId(null);
            setSelectedTopicReportCourseId(null);
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

        // Default: Level 1 - Group Dashboard
        return (
            <GroupLevelView 
                groupId={groupId}
                adminMode={adminMode}
                onStudentSelect={(student) => setSelectedStudent(student)}
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
