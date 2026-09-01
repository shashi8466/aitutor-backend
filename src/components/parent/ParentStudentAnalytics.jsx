import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLevelView from '../analytics/StudentLevelView';
import CourseLevelView from '../analytics/CourseLevelView';
import DomainLevelView from '../analytics/DomainLevelView';
import TopicLevelView from '../analytics/TopicLevelView';

/**
 * Complete Student Analytics for the Parent Portal - the same Course -> Domain -> Topic
 * drill-down chain the tutor/admin Student Report already uses (StudentLevelView etc., driven
 * there by GroupAnalytics.jsx), just without a Student Group (parentMode selects parentService,
 * groupId is never used). "View Report" from the Completed Tests table navigates to the exact
 * same Test History & Review report pages (/parent/topic-report, /parent/report) instead of a
 * separate report renderer, so a report always looks the same no matter which page opened it.
 */
const ParentStudentAnalytics = ({ studentId, student }) => {
    const navigate = useNavigate();
    const [selectedCourseName, setSelectedCourseName] = useState(null);
    const [selectedDomain, setSelectedDomain] = useState(null);
    const [selectedTopic, setSelectedTopic] = useState(null);

    if (!student) return null;

    if (selectedTopic) {
        return (
            <TopicLevelView
                topic={selectedTopic}
                student={student}
                parentMode
                onBack={() => setSelectedTopic(null)}
            />
        );
    }

    if (selectedDomain) {
        return (
            <DomainLevelView
                domain={selectedDomain}
                student={student}
                onBack={() => setSelectedDomain(null)}
                onTopicSelect={(subtopic) => setSelectedTopic(subtopic)}
            />
        );
    }

    if (selectedCourseName) {
        return (
            <CourseLevelView
                student={student}
                courseName={selectedCourseName}
                parentMode
                onBack={() => setSelectedCourseName(null)}
                onDomainSelect={(domain) => setSelectedDomain(domain)}
                onTopicSelect={(topic) => {
                    if (topic.subtopics && topic.subtopics.length > 0) setSelectedDomain(topic);
                    else setSelectedTopic(topic);
                }}
            />
        );
    }

    return (
        <StudentLevelView
            student={student}
            parentMode
            onBack={() => navigate('/parent')}
            onCourseSelect={(courseName) => setSelectedCourseName(courseName)}
            onTopicReportSelect={(courseId) => navigate(`/parent/topic-report/${studentId}/${courseId}`)}
            onAttemptSelect={(submissionId) => navigate(`/parent/report/${submissionId}`)}
        />
    );
};

export default ParentStudentAnalytics;
