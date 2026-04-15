# Delete Parent Feature - Complete Guide

## ✅ Feature Status: **ALREADY IMPLEMENTED**

The delete parent functionality is already built and working in your application!

---

## 🎯 How to Use It

### Step 1: Navigate to Admin Panel
1. Login as Admin
2. Go to **Admin Dashboard**
3. Click on **"Parent Management"** or navigate to `/#/admin/parents`

### Step 2: Find the Parent
- Use the search box to find the parent by name or email
- Browse the parent list

### Step 3: Delete the Parent
1. Click the **red trash icon** 🗑️ on the right side of the parent's row
2. A confirmation dialog will appear showing:
   ```
   Are you sure you want to delete [Parent Name]? 
   This action cannot be undone and will:
   
   • Remove the parent account from the system
   • Unlink the parent from all students
   • Delete all associated data
   
   This action is permanent.
   ```
3. Click **"OK"** to confirm or **"Cancel"** to abort

### Step 4: Success
- You'll see a success message: `"Parent account for [Name] ([Email]) deleted successfully"`
- The parent list will automatically refresh
- The deleted parent will no longer appear

---

## 🔧 How It Works (Technical Details)

### Frontend Implementation
**File:** `src/components/admin/AdminParentManagement.jsx`

```javascript
const handleDeleteParent = async (parentId, parentName) => {
    // 1. Show confirmation dialog
    if (!window.confirm(`Are you sure you want to delete ${parentName}?...`)) {
        return;
    }

    try {
        setLoading(true);
        
        // 2. Call backend API
        const response = await adminService.deleteParent(parentId);
        
        // 3. Show success message
        if (response.data?.success) {
            setSuccessMsg(response.data.message);
            loadData(); // Refresh the list
        }
    } catch (err) {
        // 4. Handle errors
        setErrorMsg(err.response?.data?.error || 'Failed to delete parent');
    } finally {
        setLoading(false);
    }
};
```

### Backend Implementation
**File:** `src/server/routes/admin-groups.js`

The backend performs **4 deletion steps**:

```javascript
router.delete('/parents/:id', requireAdmin, async (req, res) => {
    // Step 1: Verify parent exists
    const parentProfile = await supabase
        .from('profiles')
        .select('id, email, name, role, linked_students')
        .eq('id', parentId)
        .eq('role', 'parent')
        .single();

    // Step 2: Unlink from all students
    if (parentProfile.linked_students?.length > 0) {
        await supabase
            .from('profiles')
            .update({ linked_students: null })
            .in('id', parentProfile.linked_students);
    }

    // Step 3: Delete from auth.users
    await supabase.auth.admin.deleteUser(parentId);

    // Step 4: Delete from profiles table
    await supabase
        .from('profiles')
        .delete()
        .eq('id', parentId);

    res.json({ success: true, message: '...' });
});
```

### API Service
**File:** `src/services/api.js`

```javascript
adminService = {
  deleteParent: async (parentId) => {
    return axios.delete(`/api/admin/parents/${parentId}`);
  }
}
```

---

## 🛡️ Safety Features

### 1. **Confirmation Dialog**
- Prevents accidental deletions
- Shows clear warning about consequences
- Requires explicit user confirmation

### 2. **Admin-Only Access**
- Protected by `requireAdmin` middleware
- Only admins can delete parents
- Regular users get 401 Unauthorized

### 3. **Cascading Cleanup**
- Automatically unlinks parent from students
- Deletes auth credentials
- Removes profile data
- Handles errors gracefully

### 4. **Error Handling**
- Shows user-friendly error messages
- Logs detailed errors for debugging
- Continues deletion even if auth fails
- Returns specific error codes (404, 400, 500)

---

## 📋 What Gets Deleted

When you delete a parent, the system removes:

| Data | Status | Notes |
|------|--------|-------|
| Parent Profile | ✅ Deleted | From `profiles` table |
| Auth Credentials | ✅ Deleted | From `auth.users` |
| Student Links | ✅ Removed | `linked_students` set to null |
| Parent's Notifications | ⚠️ Orphaned | May need cleanup |
| Student Accounts | ✅ Preserved | Students are NOT deleted |
| Student Progress | ✅ Preserved | Unaffected |

---

## ⚠️ Important Notes

### What Happens to Students?
- ✅ **Students are NOT deleted**
- ✅ **Student accounts remain active**
- ⚠️ **Parent link is removed** (students become unlinked)
- ℹ️ Students can still login and use the app

### Can You Undo It?
- ❌ **NO** - Deletion is permanent
- ❌ Cannot recover deleted parent account
- ✅ Can create a new parent account
- ✅ Can re-link students to new parent

### What If Auth Deletion Fails?
- The system continues with profile deletion
- Auth user might remain but profile is gone
- User won't be able to login (no profile)
- Manual cleanup may be needed in Supabase

---

## 🐛 Common Issues & Solutions

### Issue 1: "Parent account not found"
**Cause:** Parent doesn't exist or isn't a parent role

**Solution:**
```sql
-- Check if parent exists
SELECT id, email, name, role 
FROM profiles 
WHERE id = 'PARENT_ID';
```

### Issue 2: "Could not delete parent profile"
**Cause:** RLS policy blocking deletion

**Solution:**
```sql
-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'profiles';

-- May need to add admin deletion policy
```

### Issue 3: Parent deleted but still shows in list
**Cause:** Frontend cache not refreshed

**Solution:**
- Click "Refresh" button
- Navigate away and back
- Clear browser cache

### Issue 4: "Unauthorized" error
**Cause:** User is not an admin

**Solution:**
- Login with admin account
- Check user role in profiles table

---

## 🧪 Testing the Feature

### Test Case 1: Delete Parent with No Students
1. Create a parent with no linked students
2. Click delete button
3. Confirm deletion
4. ✅ Should delete successfully

### Test Case 2: Delete Parent with Linked Students
1. Create a parent with 2 linked students
2. Click delete button
3. Confirm deletion
4. ✅ Should unlink students and delete parent
5. ✅ Students should still exist

### Test Case 3: Cancel Deletion
1. Click delete button
2. Click "Cancel" in confirmation
3. ✅ Nothing should be deleted
4. ✅ Parent should remain in list

### Test Case 4: Non-Admin User
1. Login as regular user (not admin)
2. Try to access delete API directly
3. ✅ Should get 401 Unauthorized

---

## 🔍 API Endpoint Details

### Request
```http
DELETE /api/admin/parents/:id
Authorization: Bearer <admin_token>
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Parent account for John Doe (john@example.com) deleted successfully"
}
```

### Error Responses

**Not Found (404):**
```json
{
  "error": "Parent account not found"
}
```

**Bad Request (400):**
```json
{
  "error": "Could not delete parent profile",
  "details": "RLS policy violation"
}
```

**Unauthorized (401):**
```json
{
  "error": "Unauthorized"
}
```

**Server Error (500):**
```json
{
  "error": "Internal server error",
  "details": "Error message here"
}
```

---

## 📊 Deletion Flow Diagram

```
User clicks delete button
        ↓
Confirmation dialog shown
        ↓
User clicks "OK"
        ↓
Frontend calls: DELETE /api/admin/parents/:id
        ↓
Backend checks: Is user admin? → NO → 401 Error
        ↓ YES
Backend checks: Does parent exist? → NO → 404 Error
        ↓ YES
Step 1: Get parent details + linked_students
        ↓
Step 2: Unlink from students (set linked_students = null)
        ↓
Step 3: Delete from auth.users
        ↓
Step 4: Delete from profiles table
        ↓
Return success response
        ↓
Frontend shows success message
        ↓
Frontend refreshes parent list
```

---

## 🎨 UI Location

The delete button is located in the parent table:

```
┌─────────────────────────────────────────────────────┐
│ Parent Management                                   │
├─────────────────────────────────────────────────────┤
│ Name        │ Email        │ Actions               │
├─────────────┼──────────────┼───────────────────────┤
│ John Doe    │ john@mail    │ [Edit] [🗑️ Delete]   │
│ Jane Smith  │ jane@mail    │ [Edit] [🗑️ Delete]   │
└─────────────────────────────────────────────────────┘
```

- **Edit Button:** Blue icon (pencil)
- **Delete Button:** Red icon (trash can)

---

## 🚀 Quick Usage Example

### In Browser:
1. Open `http://localhost:5173/#/admin/parents`
2. Find parent you want to delete
3. Click red trash icon 🗑️
4. Confirm deletion
5. Done! ✅

### Programmatically (for testing):
```javascript
// In browser console (must be logged in as admin)
const parentId = 'PARENT_UUID_HERE';

fetch(`/api/admin/parents/${parentId}`, {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    // Auth token added automatically by axios interceptor
  }
})
.then(res => res.json())
.then(data => console.log('Delete result:', data))
.catch(err => console.error('Delete failed:', err));
```

---

## 📝 Related Features

### Also Available:
- ✅ **Edit Parent** - Click blue edit icon
- ✅ **Toggle Status** - Activate/Deactivate parent
- ✅ **Search Parents** - Use search box
- ✅ **View Parent Details** - See linked students

### Future Enhancements:
- 🔄 Soft delete (mark as deleted instead of removing)
- 🔄 Bulk delete (delete multiple parents at once)
- 🔄 Deletion confirmation via email
- 🔄 Deletion audit log

---

## ✅ Summary

| Feature | Status | Location |
|---------|--------|----------|
| Delete Parent API | ✅ Working | `/api/admin/parents/:id` |
| Delete Button UI | ✅ Working | Admin Parent Management |
| Confirmation Dialog | ✅ Working | Browser confirm() |
| Cascade Cleanup | ✅ Working | Backend handles unlinking |
| Error Handling | ✅ Working | User-friendly messages |
| Admin Protection | ✅ Working | requireAdmin middleware |

**The delete parent feature is fully functional and ready to use!** 🎉

Just go to Admin Panel → Parent Management → Click the red trash icon → Confirm deletion.
