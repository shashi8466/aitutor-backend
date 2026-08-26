import { TAXONOMY } from './taxonomy';

// Same exact-match-first-then-substring-fallback matching HierarchicalContentSelector.jsx uses
// to resolve a taxonomy subtopic name to its course row - kept in sync deliberately so the
// Group Content Analytics tree points at the exact same course_ids the Assign Content selector
// (and therefore the group's assigned_course_ids) already uses.
function matchCourseId(subtopicName, courses) {
    const subNameLower = subtopicName.toLowerCase().trim();
    const exact = courses.find(c => {
        const cName = (c.name || '').toLowerCase().trim();
        const cCat = (c.category || '').toLowerCase().trim();
        return cName === subNameLower || cCat === subNameLower;
    });
    if (exact) return exact.id;

    const loose = courses.find(c => {
        const cName = (c.name || '').toLowerCase().trim();
        return cName.includes(subNameLower) || subNameLower.includes(cName);
    });
    return loose ? loose.id : null;
}

/**
 * Builds the Section -> Topic -> Subtopic tree for a group's assigned content, scoped to only
 * what the group actually has assigned (assignedContent, from getGroupDashboard) - never the
 * full TAXONOMY. Subject-agnostic: walks every top-level subject present in assignedContent
 * (SAT, ACT, AP, ...), not just SAT, so a group with e.g. ACT Math assigned gets the same
 * drill-down there too. Each subtopic/topic/section carries the resolved course_ids so
 * getGroupContentAnalytics can be called with the right scope at any level. A subtopic name
 * that can't be resolved to a real course (a known gap for some ACT/AP taxonomy entries) is
 * silently dropped rather than shown as unclickable/broken content.
 */
export function buildGroupContentTree(assignedContent, courses) {
    const sections = {};

    Object.entries(assignedContent || {}).forEach(([subject, subjectContent]) => {
        if (!TAXONOMY[subject] || typeof subjectContent !== 'object') return;

        Object.entries(subjectContent).forEach(([sectionName, domainsMap]) => {
            const topics = {};
            const sectionCourseIds = new Set();

            Object.entries(domainsMap || {}).forEach(([domainName, subtopicNames]) => {
                const subtopics = (subtopicNames || [])
                    .map(name => ({ name, courseId: matchCourseId(name, courses) }))
                    .filter(s => s.courseId != null);

                if (subtopics.length === 0) return;

                const topicCourseIds = subtopics.map(s => s.courseId);
                topicCourseIds.forEach(id => sectionCourseIds.add(id));

                topics[domainName] = { name: domainName, courseIds: topicCourseIds, subtopics };
            });

            if (Object.keys(topics).length > 0) {
                sections[sectionName] = { name: sectionName, courseIds: Array.from(sectionCourseIds), topics };
            }
        });
    });

    return sections;
}
