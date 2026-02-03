# Tutor-wise Student Grouping System & Analytics Implementation Plan

## Overview
This document outlines the implementation of a comprehensive tutor-wise student grouping system with advanced analytics and reporting capabilities.

## Phase 1: Enhanced Backend API (HIGH PRIORITY) ✅

### 1.1 Group Analytics Endpoints
- [x] GET `/api/tutor/groups/:groupId/analytics` - Get detailed analytics for a specific group
- [x] GET `/api/tutor/groups/:groupId/members` - Get all members with their performance data
- [x] GET `/api/tutor/groups/compare` - Compare performance between groups
- [x] GET `/api/tutor/groups/:groupId/report` - Generate downloadable report

### 1.2 Admin Group Management Endpoints
- [ ] GET `/api/admin/groups` - View all groups across all tutors
- [ ] POST `/api/admin/groups/:groupId/assign-tutor` - Reassign group to different tutor
- [ ] POST `/api/admin/groups/:groupId/assign-students` - Bulk assign students to groups
- [ ] GET `/api/admin/tutors/:tutorId/groups` - Get all groups for a specific tutor

### 1.3 Enhanced Student Assignment
- [ ] POST `/api/admin/assign-student-to-tutor` - Assign student to tutor's course
- [ ] DELETE `/api/admin/remove-student-from-tutor` - Remove student from tutor
- [ ] GET `/api/admin/unassigned-students` - Get students not assigned to any tutor

## Phase 2: Frontend Components

### 2.1 Admin Components
- [ ] `AdminGroupManagement.jsx` - View and manage all groups
- [ ] `AdminTutorAssignment.jsx` - Assign students to tutors
- [ ] `AdminGroupAnalytics.jsx` - View analytics across all groups

### 2.2 Tutor Components
- [x] Enhanced `GroupManager.jsx` - Add analytics view
- [ ] `GroupAnalytics.jsx` - Detailed group performance dashboard
- [ ] `GroupReport.jsx` - Generate and download reports
- [ ] `GroupComparison.jsx` - Compare multiple groups

### 2.3 Shared Components
- [ ] `PerformanceChart.jsx` - Reusable chart component
- [ ] `StudentPerformanceCard.jsx` - Individual student metrics
- [ ] `ReportGenerator.jsx` - PDF/CSV report generation

## Phase 3: Analytics Features

### 3.1 Group-wise Metrics
- Average score across all tests
- Top 3 performing students
- Bottom 3 students needing attention
- Subject-wise performance breakdown
- Progress trends (weekly/monthly)
- Attendance/participation rate

### 3.2 Comparison Features
- Compare groups within same course
- Compare groups across different courses
- Benchmark against platform average
- Identify best practices from top-performing groups

### 3.3 Reporting
- PDF reports with charts and tables
- CSV exports for further analysis
- Scheduled email reports (optional)
- Custom date range selection

## Phase 4: Database Enhancements

### 4.1 New Tables/Views
```sql
-- View for group analytics
CREATE VIEW group_analytics AS ...

-- Table for report history
CREATE TABLE group_reports (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT REFERENCES student_groups(id),
  generated_by UUID REFERENCES profiles(id),
  report_type TEXT,
  date_range JSONB,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Indexes for Performance
```sql
CREATE INDEX idx_test_submissions_course_date ON test_submissions(course_id, created_at);
CREATE INDEX idx_group_members_group_student ON group_members(group_id, student_id);
```

## Implementation Priority

### HIGH PRIORITY (Implement First)
1. ✅ Backend analytics endpoints
2. Enhanced GroupManager with analytics tab
3. Admin group management interface
4. Basic reporting (PDF/CSV)

### MEDIUM PRIORITY
1. Group comparison features
2. Advanced charts and visualizations
3. Trend analysis (weekly/monthly)

### LOW PRIORITY (Nice to Have)
1. Scheduled reports
2. Email notifications
3. Mobile-responsive analytics
4. Export to Google Sheets

## Success Metrics
- Tutors can view their groups' performance at a glance
- Admin can reassign students between tutors easily
- Reports can be generated in under 5 seconds
- Analytics update in real-time as students complete tests

## Timeline
- Phase 1: 2-3 hours
- Phase 2: 3-4 hours
- Phase 3: 2-3 hours
- Phase 4: 1-2 hours

**Total Estimated Time: 8-12 hours**
