# 🚀 Quick Start Guide - Group Analytics System

## For Tutors

### Step 1: Create Your First Group (2 minutes)

1. **Navigate to Student Groups**
   - Log in as a tutor
   - Go to your dashboard
   - Click on "Student Groups" in the sidebar

2. **Create a Group**
   - Click "Create New Group" button
   - Fill in the form:
     ```
     Group Name: "Batch A - January 2026"
     Course: Select from dropdown
     Description: "Morning session students" (optional)
     ```
   - Click "Create Group"

### Step 2: Add Students (3 minutes)

1. **Open Group Management**
   - Find your newly created group
   - Click "Manage" button

2. **Add Students**
   - Use the search bar to find students
   - Click the + icon next to each student's name
   - Selected students will show a checkmark
   - Click "Add to Group" when done

### Step 3: View Analytics (1 minute)

1. **Open Analytics Dashboard**
   - Click "Analytics" button on your group card
   - View instant insights:
     - Total students
     - Average score
     - Total tests taken
     - Top score

2. **Explore Details**
   - Scroll down to see:
     - Progress trend chart
     - Subject performance
     - Top performers
     - Students needing attention
     - Complete student table

### Step 4: Download Report (30 seconds)

1. **Generate CSV Report**
   - In analytics view, click "Download Report"
   - CSV file downloads automatically
   - Open in Excel/Google Sheets

2. **Report Contains:**
   - Summary statistics
   - Top performers list
   - All student details
   - Performance metrics

## For Admins

### Step 1: View All Groups (1 minute)

1. **Access Admin Panel**
   - Log in as admin
   - Navigate to "Group Management"

2. **View Statistics**
   - See platform-wide metrics:
     - Total groups
     - Total students
     - Active tutors
     - Average group size

### Step 2: Manage Groups (2 minutes)

1. **Search and Filter**
   - Use search bar to find specific groups
   - Filter by tutor using dropdown
   - Click refresh to update data

2. **Reassign a Group**
   - Click reassign icon (↻) on any group
   - Select new tutor from dropdown
   - Click "Reassign"

3. **Delete a Group**
   - Click delete icon (🗑️) on any group
   - Confirm deletion
   - Group and memberships removed

## Common Tasks

### Compare Multiple Groups

```javascript
// As a tutor, use the API
import { tutorService } from './services/api';

const comparison = await tutorService.compareGroups([1, 2, 3]);
console.log(comparison.data);
```

### Filter Analytics by Date

1. In analytics view, use date range picker
2. Select start date
3. Select end date
4. Analytics update automatically
5. Click "Clear" to remove filter

### Find Unassigned Students

```javascript
// As admin
import { adminService } from './services/api';

const students = await adminService.getUnassignedStudents(courseId);
// Returns students enrolled but not in any group
```

### Bulk Assign Students

```javascript
// As admin
await adminService.bulkAssignStudents(groupId, [
    'student-id-1',
    'student-id-2',
    'student-id-3'
]);
```

## Tips & Best Practices

### For Tutors

✅ **DO:**
- Create groups at the start of each session/batch
- Add descriptive names (e.g., "Morning Batch - Jan 2026")
- Check analytics weekly to track progress
- Download reports for record-keeping
- Use date filters to analyze specific periods

❌ **DON'T:**
- Create too many small groups (harder to manage)
- Forget to add students to groups
- Ignore low-performing students in analytics
- Delete groups with historical data

### For Admins

✅ **DO:**
- Monitor platform statistics regularly
- Reassign groups when tutors change
- Check for unassigned students weekly
- Use search and filters effectively
- Keep tutor assignments up to date

❌ **DON'T:**
- Delete groups without tutor consultation
- Reassign groups during active sessions
- Ignore unassigned students
- Make bulk changes without backup

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Search | `/` |
| Refresh | `Ctrl + R` |
| Close Modal | `Esc` |
| Download Report | `Ctrl + D` (in analytics) |

## Troubleshooting

### "No students found"
**Solution:** Ensure students are enrolled in the course first

### "Analytics not loading"
**Solution:** 
1. Check if group has members
2. Verify students have taken tests
3. Refresh the page

### "Permission denied"
**Solution:**
1. Verify you're logged in as tutor/admin
2. Check if tutor account is approved
3. Ensure you own the group (tutors only)

### "CSV download not working"
**Solution:**
1. Check browser download settings
2. Disable popup blocker
3. Try different browser

## Next Steps

### After Setup
1. ✅ Create groups for all your batches
2. ✅ Add all enrolled students
3. ✅ Set up weekly analytics review
4. ✅ Download monthly reports

### Advanced Features
- Compare group performance
- Track progress trends
- Identify subject weaknesses
- Generate custom reports

## Need Help?

### Resources
- 📖 Full documentation: `GROUP_ANALYTICS_README.md`
- 🔧 API reference: See README API section
- 💡 Implementation details: `IMPLEMENTATION_SUMMARY.md`

### Support
- Check existing documentation
- Review API responses in browser console
- Contact development team

---

**Estimated Setup Time:** 10 minutes  
**Difficulty:** Easy  
**Prerequisites:** Tutor/Admin account with approved status

🎉 **You're all set! Start managing your student groups now!**
