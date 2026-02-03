# 📚 Tutor-wise Student Grouping System & Analytics

## Overview

A comprehensive student grouping and analytics system that enables tutors to organize students into groups, track performance, and generate detailed reports. Admins have full oversight and can manage groups across all tutors.

## 🎯 Key Features

### For Tutors
- ✅ Create and manage student groups by course
- ✅ Add/remove students from groups
- ✅ View detailed group analytics
- ✅ Track individual student performance
- ✅ Compare multiple groups
- ✅ Download CSV reports
- ✅ Filter analytics by date range

### For Admins
- ✅ View all groups across all tutors
- ✅ Reassign groups to different tutors
- ✅ Bulk assign students to groups
- ✅ View unassigned students
- ✅ Delete any group
- ✅ Monitor platform-wide statistics

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- Supabase account
- Existing educational platform setup

### Installation

The feature is already integrated into the platform. No additional installation required.

### Database Setup

The required tables are created via the migration file:
```sql
src/supabase/migrations/1768400000000-tutor_enhancements.sql
```

Tables created:
- `student_groups` - Group information
- `group_members` - Student-group relationships
- `test_responses` - Question-level analytics

## 📖 Usage Guide

### Tutor Workflow

#### 1. Create a Group
```javascript
// Navigate to Student Groups in tutor dashboard
// Click "Create New Group"
// Fill in:
// - Group Name (e.g., "Batch A", "Monday Session")
// - Select Course
// - Add Description (optional)
```

#### 2. Add Students to Group
```javascript
// Click "Manage" on any group card
// Search for students by name or email
// Click + icon to select students
// Click "Add to Group"
```

#### 3. View Analytics
```javascript
// Click "Analytics" on any group card
// View:
// - Summary statistics
// - Progress trends
// - Subject performance
// - Top/low performers
// - Complete student list
```

#### 4. Download Report
```javascript
// In analytics view, click "Download Report"
// CSV file includes:
// - Summary statistics
// - Top performers
// - All student details
// - Performance metrics
```

### Admin Workflow

#### 1. View All Groups
```javascript
import { adminService } from './services/api';

const { data } = await adminService.getAllGroups();
// Returns all groups with tutor and course info
```

#### 2. Reassign Group
```javascript
// In AdminGroupManagement component
// Click reassign icon on any group
// Select new tutor from dropdown
// Confirm reassignment
```

#### 3. Bulk Assign Students
```javascript
await adminService.bulkAssignStudents(groupId, [
    'student-uuid-1',
    'student-uuid-2',
    'student-uuid-3'
]);
```

#### 4. Find Unassigned Students
```javascript
const { data } = await adminService.getUnassignedStudents(courseId);
// Returns students enrolled but not in any group
```

## 🔌 API Reference

### Tutor Endpoints

#### Get Groups
```http
GET /api/tutor/groups?courseId={courseId}
```
Returns all groups created by the tutor.

#### Get Group Members
```http
GET /api/tutor/groups/:groupId/members
```
Returns all members with performance data.

#### Get Group Analytics
```http
GET /api/tutor/groups/:groupId/analytics?startDate={date}&endDate={date}
```
Returns comprehensive analytics for the group.

**Response:**
```json
{
  "group_name": "Batch A",
  "total_students": 25,
  "total_tests": 150,
  "average_score": 78.5,
  "top_performers": [
    {
      "id": "uuid",
      "name": "John Doe",
      "average_score": 95.2,
      "total_tests": 6
    }
  ],
  "low_performers": [...],
  "subject_performance": {
    "math": {
      "average_percentage": 82.3,
      "total_questions": 450,
      "total_tests": 50
    },
    "reading": {...},
    "writing": {...}
  },
  "progress_trend": [
    {
      "week": "2026-01-20",
      "average_score": 75.5,
      "test_count": 12
    }
  ]
}
```

#### Compare Groups
```http
GET /api/tutor/groups/compare?groupIds=1,2,3
```
Returns comparison data for multiple groups.

#### Create Group
```http
POST /api/tutor/groups
Content-Type: application/json

{
  "name": "Batch A",
  "courseId": 1,
  "description": "Morning session students"
}
```

#### Add Members
```http
POST /api/tutor/groups/:groupId/members
Content-Type: application/json

{
  "studentIds": ["uuid1", "uuid2"]
}
```

#### Remove Member
```http
DELETE /api/tutor/groups/:groupId/members/:studentId
```

#### Delete Group
```http
DELETE /api/tutor/groups/:groupId
```

### Admin Endpoints

#### Get All Groups
```http
GET /api/admin/groups
```
Returns all groups across all tutors.

#### Get Tutor's Groups
```http
GET /api/admin/tutors/:tutorId/groups
```

#### Reassign Group
```http
POST /api/admin/groups/:groupId/assign-tutor
Content-Type: application/json

{
  "tutorId": "new-tutor-uuid"
}
```

#### Bulk Assign Students
```http
POST /api/admin/groups/:groupId/assign-students
Content-Type: application/json

{
  "studentIds": ["uuid1", "uuid2", "uuid3"]
}
```

#### Get Unassigned Students
```http
GET /api/admin/unassigned-students?courseId={courseId}
```

#### Delete Group (Admin)
```http
DELETE /api/admin/groups/:groupId
```

## 🎨 Components

### GroupManager.jsx
Main component for tutors to manage groups.

**Props:** None (uses auth context)

**Features:**
- Create groups
- View groups grid
- Manage members
- Toggle to analytics view

### GroupAnalytics.jsx
Detailed analytics dashboard for a specific group.

**Props:**
```javascript
{
  groupId: number,        // Required
  groupName: string,      // Required
  onBack: function        // Required callback
}
```

**Features:**
- Summary cards
- Progress trend chart
- Subject performance chart
- Top/low performers lists
- Complete student table
- Date range filtering
- CSV export

### AdminGroupManagement.jsx
Admin interface for managing all groups.

**Props:** None (uses auth context)

**Features:**
- View all groups
- Filter by tutor
- Search functionality
- Reassign groups
- Delete groups
- Platform statistics

## 📊 Analytics Metrics

### Group-Level Metrics
- **Total Students**: Number of students in group
- **Total Tests**: Total test submissions
- **Average Score**: Mean percentage across all tests
- **Top Score**: Highest average score in group

### Student-Level Metrics
- **Average Score**: Student's mean score
- **Latest Score**: Most recent test score
- **Total Tests**: Number of tests taken
- **Last Test Date**: Date of most recent submission

### Subject-Level Metrics
- **Average Percentage**: Mean score for subject
- **Total Questions**: Total questions answered
- **Total Tests**: Tests containing subject questions

### Trend Metrics
- **Weekly Progress**: Average scores by week
- **Test Count**: Tests taken per week

## 🎯 Use Cases

### 1. Batch Management
Create groups for different batches (morning/evening sessions).

```javascript
// Create morning batch
await tutorService.createGroup({
  name: "Morning Batch - Jan 2026",
  courseId: 1,
  description: "9 AM - 12 PM session"
});
```

### 2. Performance Tracking
Monitor group progress over time.

```javascript
// Get analytics for last month
const { data } = await tutorService.getGroupAnalytics(
  groupId,
  '2026-01-01',
  '2026-01-31'
);
```

### 3. Identify Struggling Students
Automatically find students needing attention.

```javascript
// Analytics returns low_performers array
const needsAttention = analytics.low_performers;
// Take action: schedule extra sessions, provide resources
```

### 4. Compare Teaching Methods
Compare performance between different groups.

```javascript
const { data } = await tutorService.compareGroups([1, 2, 3]);
// Identify which group/method is most effective
```

### 5. Generate Reports
Create reports for stakeholders.

```javascript
// Download CSV with all metrics
// Share with parents, administrators, or for records
```

## 🔒 Security & Permissions

### Role-Based Access Control

#### Students
- ❌ Cannot view groups
- ❌ Cannot access analytics
- ✅ Can see their own performance

#### Tutors
- ✅ Can create groups for their courses
- ✅ Can manage their own groups
- ✅ Can view analytics for their groups
- ❌ Cannot see other tutors' groups
- ❌ Cannot reassign groups

#### Admins
- ✅ Full access to all groups
- ✅ Can reassign groups
- ✅ Can delete any group
- ✅ Can view all analytics
- ✅ Can bulk assign students

### Data Privacy
- Students only see their own data
- Tutors see only assigned students
- All endpoints verify authorization
- Group ownership validated on every request

## 🚧 Troubleshooting

### Groups Not Loading
```javascript
// Check browser console for errors
// Verify user is authenticated
// Ensure user has tutor/admin role
// Check network tab for API responses
```

### Analytics Not Showing
```javascript
// Ensure group has members
// Verify students have taken tests
// Check date range filters
// Confirm course_id matches
```

### CSV Download Not Working
```javascript
// Check browser's download settings
// Ensure popup blocker is disabled
// Verify data exists in analytics
```

### Permission Denied
```javascript
// Verify user role (tutor/admin)
// Check group ownership
// Ensure tutor_approved flag is true
```

## 📈 Performance Optimization

### Database Queries
- Indexed on `course_id`, `created_by`, `student_id`
- Aggregated calculations on backend
- Efficient joins for member data

### Frontend
- Lazy loading of analytics
- Cached profile lookups
- Debounced search inputs
- Optimized chart rendering

### Scalability
- Supports unlimited groups per tutor
- Handles large student populations
- Efficient date range filtering
- Batch operations for bulk assignments

## 🧪 Testing

### Manual Testing Checklist

#### Tutor Features
- [ ] Create a new group
- [ ] Add students to group
- [ ] Remove student from group
- [ ] View group analytics
- [ ] Download CSV report
- [ ] Filter analytics by date
- [ ] Compare multiple groups
- [ ] Delete a group

#### Admin Features
- [ ] View all groups
- [ ] Filter by tutor
- [ ] Search groups
- [ ] Reassign group to new tutor
- [ ] Bulk assign students
- [ ] View unassigned students
- [ ] Delete any group

### API Testing
```bash
# Test tutor endpoints
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/tutor/groups

# Test admin endpoints
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/admin/groups
```

## 📝 Future Enhancements

### Planned Features
- [ ] PDF report generation
- [ ] Email scheduled reports
- [ ] Group comparison UI
- [ ] Mobile app support
- [ ] AI-powered insights
- [ ] Performance benchmarking
- [ ] Automated student grouping
- [ ] Parent access to group reports

### Community Requests
Submit feature requests via GitHub issues.

## 🤝 Contributing

### Development Setup
```bash
# Clone repository
git clone <repo-url>

# Install dependencies
npm install

# Start development server
npm run dev
```

### Code Style
- Use ESLint configuration
- Follow existing patterns
- Add JSDoc comments
- Write meaningful commit messages

## 📄 License

This feature is part of the educational platform and follows the same license.

## 🙋 Support

### Documentation
- API docs in route files
- Component docs in source files
- This README

### Contact
For issues or questions:
- Create GitHub issue
- Contact development team
- Check existing documentation

## 🎉 Acknowledgments

Built with:
- React
- Express.js
- Supabase
- Recharts
- Framer Motion
- TailwindCSS

---

**Version**: 1.0.0  
**Last Updated**: January 29, 2026  
**Status**: ✅ Production Ready
