# AI Tutor Application - Feature Implementation Plan
**Date:** January 12, 2026  
**Version:** 1.0

---

## 📋 Table of Contents
1. [Overview](#overview)
2. [Feature 1: Separate Login Panels](#feature-1-separate-login-panels)
3. [Feature 2: Enrollment Key System](#feature-2-enrollment-key-system)
4. [Feature 3: Advanced Grading System](#feature-3-advanced-grading-system)
5. [Feature 4: Student Invitation Links](#feature-4-student-invitation-links)
6. [Database Schema Changes](#database-schema-changes)
7. [Implementation Timeline](#implementation-timeline)
8. [Testing Strategy](#testing-strategy)

---

## Overview

This document outlines the implementation plan for four major features being added to the AI Tutor Application:

1. **Separate Login Panels** - Role-based authentication for Admin, Tutor, and Student
2. **Enrollment Key System** - Secure course enrollment via unique keys
3. **Advanced Grading System** - Detailed performance tracking with section-wise scoring
4. **Student Invitation Links** - Tutor/Admin-generated invitation system

### Current Architecture Analysis

**Technology Stack:**
- Frontend: React + Vite + TailwindCSS
- Backend: Node.js/Express (Render.com)
- Database: Supabase (PostgreSQL)
- Authentication: Supabase Auth
- Payment: Stripe

**Current Roles:**
- Admin (existing)
- Student (existing)
- Tutor (to be added)

**Current Tables:**
- `profiles` - User information with role field
- `courses` - Course metadata with pricing
- `questions` - Quiz questions
- `enrollments` - User-course relationships
- `progress` - Student progress tracking
- `test_reviews` - Test submission data
- `site_settings` - Application configuration

---

## Feature 1: Separate Login Panels

### 1.1 Objective
Create distinct login interfaces for Admin, Tutor, and Student roles with appropriate branding and role-specific dashboards.

### 1.2 Current State
- Single login page at `/login`
- Role detection happens after authentication
- Redirects to `/admin` or `/student` based on profile role

### 1.3 Proposed Changes

#### 1.3.1 Frontend Changes

**New Components:**
```
src/components/auth/
├── RoleSelector.jsx         # Landing page for role selection
├── AdminLogin.jsx           # Admin-specific login
├── TutorLogin.jsx           # Tutor-specific login  
├── StudentLogin.jsx         # Student-specific login
└── CommonLoginForm.jsx      # Reusable login form component
```

**New Routes (App.jsx):**
```javascript
<Route path="/login" element={<RoleSelector />} />
<Route path="/login/admin" element={<AdminLogin />} />
<Route path="/login/tutor" element={<TutorLogin />} />
<Route path="/login/student" element={<StudentLogin />} />
```

**Tutor Layout:**
```
src/components/layout/
└── TutorLayout.jsx          # Layout wrapper for tutor routes

src/components/tutor/
├── TutorDashboard.jsx       # Main tutor dashboard
├── TutorCourseManagement.jsx # Assigned courses
├── StudentManagement.jsx     # View/manage students
├── InvitationManager.jsx     # Generate invitation links
├── EnrollmentKeyManager.jsx  # Create/manage enrollment keys
├── GradeReports.jsx          # View student grades
└── TutorSettings.jsx         # Tutor profile settings
```

#### 1.3.2 Backend Changes

**Update Profile Schema (Migration):**
```sql
-- File: src/supabase/migrations/[timestamp]-add_tutor_role.sql

-- Update role enum to include 'tutor'
-- Existing roles: 'admin', 'student'
-- Note: profiles.role is currently stored as text, not enum

-- Add tutor-specific fields to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS tutor_specialty text,
ADD COLUMN IF NOT EXISTS tutor_bio text,
ADD COLUMN IF NOT EXISTS tutor_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS assigned_courses bigint[] DEFAULT '{}';

-- Create index for tutor lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role_tutor 
ON profiles(role) WHERE role = 'tutor';
```

**Update RLS Policies:**
```sql
-- Tutors can view their assigned courses
CREATE POLICY "Tutors can view assigned courses"
ON courses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'tutor' 
    AND courses.id = ANY(assigned_courses)
  )
);

-- Tutors can view students in their courses
CREATE POLICY "Tutors can view enrolled students"
ON profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN enrollments e ON e.user_id = profiles.id
    WHERE p.id = auth.uid()
    AND p.role = 'tutor'
    AND e.course_id = ANY(p.assigned_courses)
  )
);
```

#### 1.3.3 API Endpoints

**New Endpoints (src/server/routes/):**

Create `src/server/routes/tutor.js`:
```javascript
// GET /api/tutor/dashboard - Get tutor dashboard data
// GET /api/tutor/courses - Get assigned courses
// GET /api/tutor/students - Get enrolled students
// POST /api/tutor/invite - Generate invitation link
// GET /api/tutor/grades/:courseId - Get student grades for course
```

### 1.4 Implementation Steps

1. ✅ **Step 1.1:** Create database migration for tutor role
2. ✅ **Step 1.2:** Update RLS policies for tutor access
3. ✅ **Step 1.3:** Create RoleSelector component
4. ✅ **Step 1.4:** Create individual login components (Admin/Tutor/Student)
5. ✅ **Step 1.5:** Create TutorLayout and TutorDashboard
6. ✅ **Step 1.6:** Add tutor routes to App.jsx
7. ✅ **Step 1.7:** Update ProtectedRoute to handle tutor role
8. ✅ **Step 1.8:** Create tutor API routes
9. ✅ **Step 1.9:** Test authentication flow for all three roles
10. ✅ **Step 1.10:** Update signup to support tutor registration (admin-approved)

### 1.5 Design Considerations

**Role Selector UI:**
- Modern card-based design
- Visual icons for each role
- Description of each role type
- Smooth animations

**Login Branding:**
- Admin: Red/Professional theme
- Tutor: Blue/Educational theme  
- Student: Green/Friendly theme

### 1.6 User Stories

- **As an Admin**, I want a dedicated login portal so I can quickly access administrative functions
- **As a Tutor**, I want my own login page so I can manage my students and courses
- **As a Student**, I want a student-focused login experience with relevant messaging

---

## Feature 2: Enrollment Key System

### 2.1 Objective
Enable secure course enrollment through unique, time-limited enrollment keys with usage restrictions.

### 2.2 Proposed Schema

#### 2.2.1 New Table: `enrollment_keys`

```sql
-- File: src/supabase/migrations/[timestamp]-create_enrollment_keys.sql

CREATE TABLE enrollment_keys (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  
  -- Key Information
  key_code text UNIQUE NOT NULL,  -- e.g., "SAT-MATH-2026-ABC123"
  course_id bigint REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  
  -- Created By
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  creator_role text, -- 'admin' or 'tutor'
  
  -- Restrictions
  max_uses integer DEFAULT NULL,  -- NULL = unlimited
  current_uses integer DEFAULT 0,
  max_students integer DEFAULT NULL,  -- NULL = unlimited
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz DEFAULT NULL,  -- NULL = no expiry
  
  -- Status
  is_active boolean DEFAULT true,
  
  -- Metadata
  description text,  -- Admin note about key purpose
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_enrollment_keys_course ON enrollment_keys(course_id);
CREATE INDEX idx_enrollment_keys_code ON enrollment_keys(key_code);
CREATE INDEX idx_enrollment_keys_active ON enrollment_keys(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE enrollment_keys ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enrollment keys viewable by creators"
ON enrollment_keys FOR SELECT TO authenticated
USING (
  created_by = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins and tutors can create enrollment keys"
ON enrollment_keys FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'tutor')
  )
);

CREATE POLICY "Creators can update their keys"
ON enrollment_keys FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Creators can delete their keys"
ON enrollment_keys FOR DELETE TO authenticated
USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

#### 2.2.2 Update Enrollments Table

```sql
-- File: src/supabase/migrations/[timestamp]-update_enrollments_for_keys.sql

-- Add enrollment_key_id to track which key was used
ALTER TABLE enrollments
ADD COLUMN IF NOT EXISTS enrollment_key_id bigint REFERENCES enrollment_keys(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS enrollment_method text DEFAULT 'manual'; 
-- Values: 'manual', 'key', 'invitation', 'payment'

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_enrollments_key ON enrollments(enrollment_key_id);
```

### 2.3 Key Generation Logic

**Algorithm:**
```javascript
// src/server/utils/keyGenerator.js

const generateEnrollmentKey = (courseId, courseName) => {
  // Format: [COURSE-PREFIX]-[RANDOM-6-CHARS]
  // Example: SAT-MATH-A7B9X2
  
  const prefix = courseName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '-')
    .substring(0, 12);
    
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  
  return `${prefix}-${random}`;
};
```

### 2.4 Frontend Components

**New Components:**
```
src/components/admin/EnrollmentKeyManagement.jsx
src/components/tutor/EnrollmentKeyManager.jsx
src/components/student/EnrollmentKeyInput.jsx
src/components/common/KeyValidation.jsx
```

**Admin Key Management Features:**
- View all enrollment keys (table view)
- Create new keys with restrictions
- Edit existing keys (activate/deactivate)
- View key usage statistics
- Filter keys by course/status/creator

**Student Key Input:**
- Input field in StudentDashboard or StudentCourseList
- Real-time validation
- Success/error messaging
- Auto-enrollment on valid key

### 2.5 API Endpoints

**New Endpoints:**
```javascript
// src/server/routes/enrollment.js

// POST /api/enrollment/create-key
// Body: { courseId, maxUses, maxStudents, validUntil, description }
// Returns: { keyCode, keyId }

// POST /api/enrollment/validate-key
// Body: { keyCode, userId }
// Returns: { valid: true/false, courseId, courseName }

// POST /api/enrollment/use-key
// Body: { keyCode, userId }
// Returns: { enrolled: true/false, courseId }

// GET /api/enrollment/keys/:courseId
// Returns: Array of keys for course

// GET /api/enrollment/my-keys
// Returns: Keys created by current user

// PATCH /api/enrollment/key/:keyId
// Body: { isActive, maxUses, validUntil }
// Returns: Updated key

// DELETE /api/enrollment/key/:keyId
// Returns: { deleted: true }

// GET /api/enrollment/key-stats/:keyId
// Returns: { totalUses, uniqueStudents, activeUsers }
```

### 2.6 Validation Rules

**Server-side Validation:**
```javascript
const validateEnrollmentKey = async (keyCode, userId) => {
  const key = await getKeyByCode(keyCode);
  
  if (!key) return { valid: false, error: 'Invalid key' };
  if (!key.is_active) return { valid: false, error: 'Key is inactive' };
  
  // Check time validity
  const now = new Date();
  if (key.valid_from && now < new Date(key.valid_from)) {
    return { valid: false, error: 'Key not yet valid' };
  }
  if (key.valid_until && now > new Date(key.valid_until)) {
    return { valid: false, error: 'Key has expired' };
  }
  
  // Check usage limits
  if (key.max_uses && key.current_uses >= key.max_uses) {
    return { valid: false, error: 'Key usage limit reached' };
  }
  
  // Check if already enrolled
  const existingEnrollment = await checkEnrollment(userId, key.course_id);
  if (existingEnrollment) {
    return { valid: false, error: 'Already enrolled in this course' };
  }
  
  return { valid: true, courseId: key.course_id };
};
```

### 2.7 User Stories

- **As an Admin**, I want to generate enrollment keys for courses so I can control who can enroll
- **As a Tutor**, I want to create limited-use keys for my students so I can manage class sizes
- **As a Student**, I want to enter an enrollment key to join a course quickly and securely

---

## Feature 3: Advanced Grading System

### 3.1 Objective
Implement a comprehensive grading system with section-wise scoring (Math, Reading, Writing) and standardized test-style reporting.

### 3.2 Current State
- Basic quiz scoring exists
- Progress tracking in `progress` table
- Test reviews stored in `test_reviews` table
- No section-based grading

### 3.3 Proposed Schema Changes

#### 3.3.1 Update Questions Table

```sql
-- File: src/supabase/migrations/[timestamp]-add_question_sections.sql

-- Add section identifier to questions
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS section text DEFAULT 'general',
ADD COLUMN IF NOT EXISTS difficulty_weight numeric(3, 2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS points integer DEFAULT 1;

-- Create index for section-based queries
CREATE INDEX IF NOT EXISTS idx_questions_section ON questions(section);
CREATE INDEX IF NOT EXISTS idx_questions_course_section ON questions(course_id, section);

-- Update existing questions to have section based on course type
-- This would be done via a data migration script
```

**Section Types:**
- `math` - Mathematical reasoning
- `reading` - Reading comprehension
- `writing` - Writing and language
- `general` - Mixed or uncategorized

#### 3.3.2 New Table: `test_submissions`

```sql
-- File: src/supabase/migrations/[timestamp]-create_test_submissions.sql

CREATE TABLE test_submissions (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  
  -- Student & Course
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  course_id bigint REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  level text NOT NULL,
  
  -- Test Metadata
  test_date timestamptz DEFAULT now(),
  test_duration_seconds integer,
  total_questions integer NOT NULL,
  
  -- Overall Scores
  raw_score integer NOT NULL,  -- Total correct answers
  raw_score_percentage numeric(5, 2),  -- Percentage
  scaled_score integer,  -- e.g., 200-800 for SAT
  
  -- Section Scores (Math)
  math_raw_score integer DEFAULT 0,
  math_total_questions integer DEFAULT 0,
  math_percentage numeric(5, 2),
  math_scaled_score integer,
  
  -- Section Scores (Reading)
  reading_raw_score integer DEFAULT 0,
  reading_total_questions integer DEFAULT 0,
  reading_percentage numeric(5, 2),
  reading_scaled_score integer,
  
  -- Section Scores (Writing)
  writing_raw_score integer DEFAULT 0,
  writing_total_questions integer DEFAULT 0,
  writing_percentage numeric(5, 2),
  writing_scaled_score integer,
  
  -- Analytics
  correct_questions bigint[] DEFAULT '{}',
  incorrect_questions bigint[] DEFAULT '{}',
  skipped_questions bigint[] DEFAULT '{}',
  
  -- Weak Areas Analysis
  weak_topics text[] DEFAULT '{}',
  strong_topics text[] DEFAULT '{}',
  
  -- Status
  is_completed boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_test_submissions_user ON test_submissions(user_id);
CREATE INDEX idx_test_submissions_course ON test_submissions(course_id);
CREATE INDEX idx_test_submissions_date ON test_submissions(test_date DESC);
CREATE INDEX idx_test_submissions_user_course ON test_submissions(user_id, course_id);

-- Enable RLS
ALTER TABLE test_submissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own submissions"
ON test_submissions FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own submissions"
ON test_submissions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all submissions"
ON test_submissions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Tutors can view their students' submissions"
ON test_submissions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN enrollments e ON e.user_id = test_submissions.user_id
    WHERE p.id = auth.uid()
    AND p.role = 'tutor'
    AND e.course_id = ANY(p.assigned_courses)
  )
);
```

#### 3.3.3 New Table: `grade_scales`

```sql
-- File: src/supabase/migrations/[timestamp]-create_grade_scales.sql

-- For standardized test scoring (e.g., SAT, ACT)
CREATE TABLE grade_scales (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  
  course_id bigint REFERENCES courses(id) ON DELETE CASCADE,
  section text NOT NULL,  -- 'overall', 'math', 'reading', 'writing'
  
  -- Scoring Configuration
  min_raw_score integer NOT NULL,
  max_raw_score integer NOT NULL,
  min_scaled_score integer NOT NULL,
  max_scaled_score integer NOT NULL,
  
  -- Scale Type
  scale_type text DEFAULT 'linear',  -- 'linear', 'curved', 'percentile'
  scale_config jsonb,  -- Additional config for non-linear scales
  
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Example data for SAT-style course
INSERT INTO grade_scales (course_id, section, min_raw_score, max_raw_score, min_scaled_score, max_scaled_score)
VALUES 
  (1, 'math', 0, 58, 200, 800),
  (1, 'reading', 0, 52, 200, 800),
  (1, 'writing', 0, 44, 200, 800);
```

### 3.4 Scoring Algorithm

**Calculation Logic:**
```javascript
// src/server/utils/gradingEngine.js

const calculateScores = (answers, questions) => {
  // Group questions by section
  const sectionResults = {
    math: { correct: 0, total: 0, questionIds: [] },
    reading: { correct: 0, total: 0, questionIds: [] },
    writing: { correct: 0, total: 0, questionIds: [] }
  };
  
  let totalCorrect = 0;
  
  answers.forEach((answer, index) => {
    const question = questions[index];
    const section = question.section || 'general';
    const isCorrect = answer === question.correct_answer;
    
    if (isCorrect) {
      totalCorrect++;
      if (sectionResults[section]) {
        sectionResults[section].correct++;
      }
    }
    
    if (sectionResults[section]) {
      sectionResults[section].total++;
      sectionResults[section].questionIds.push(question.id);
    }
  });
  
  // Calculate percentages
  const rawScorePercentage = (totalCorrect / questions.length) * 100;
  
  // Calculate scaled scores using grade scale
  const scaledScores = await calculateScaledScores(
    courseId,
    totalCorrect,
    sectionResults
  );
  
  return {
    rawScore: totalCorrect,
    rawScorePercentage,
    scaledScore: scaledScores.overall,
    sections: {
      math: {
        rawScore: sectionResults.math.correct,
        total: sectionResults.math.total,
        percentage: (sectionResults.math.correct / sectionResults.math.total) * 100,
        scaledScore: scaledScores.math
      },
      // ... similar for reading and writing
    }
  };
};

const calculateScaledScores = async (courseId, rawScore, sectionResults) => {
  const scales = await getGradeScales(courseId);
  
  const scaleScore = (raw, total, scale) => {
    if (!scale) return null;
    
    const percentage = raw / total;
    const range = scale.max_scaled_score - scale.min_scaled_score;
    
    return Math.round(scale.min_scaled_score + (percentage * range));
  };
  
  return {
    overall: scaleScore(rawScore, totalQuestions, scales.overall),
    math: scaleScore(sectionResults.math.correct, sectionResults.math.total, scales.math),
    reading: scaleScore(sectionResults.reading.correct, sectionResults.reading.total, scales.reading),
    writing: scaleScore(sectionResults.writing.correct, sectionResults.writing.total, scales.writing)
  };
};
```

### 3.5 Frontend Components

**New Components:**
```
src/components/student/
├── GradeReport.jsx          # Detailed grade breakdown
├── ScoreChart.jsx           # Visual score representation
├── SectionAnalysis.jsx      # Section-wise analysis
└── ProgressGraph.jsx        # Score trends over time

src/components/admin/
├── GradingConfiguration.jsx # Configure grade scales
└── StudentGrades.jsx        # View all student grades

src/components/tutor/
└── ClassGrades.jsx          # View class performance
```

**Grade Report Features:**
- Overall score with visual gauge
- Section breakdown (Math, Reading, Writing)
- Scaled score conversion
- Percentile ranking (future enhancement)
- Weak areas identification
- Historical score comparison
- Downloadable PDF report

### 3.6 API Endpoints

```javascript
// src/server/routes/grading.js

// POST /api/grading/submit-test
// Body: { courseId, level, answers, duration }
// Returns: { submissionId, scores }

// GET /api/grading/submission/:submissionId
// Returns: Detailed submission with scores

// GET /api/grading/my-scores/:courseId
// Returns: All scores for a course

// GET /api/grading/section-analysis/:courseId
// Returns: Section-wise performance analytics

// POST /api/grading/configure-scale
// Body: { courseId, section, minRaw, maxRaw, minScaled, maxScaled }
// Returns: Created scale configuration

// GET /api/grading/class-report/:courseId (Tutor/Admin)
// Returns: Aggregated class performance data
```

### 3.7 User Stories

- **As a Student**, I want to see my detailed score breakdown so I know which sections to improve
- **As a Tutor**, I want to analyze class-wide performance to adapt my teaching
- **As an Admin**, I want to configure grading scales for different test types

---

## Feature 4: Student Invitation Links

### 4.1 Objective
Enable tutors and admins to generate secure, trackable invitation links for student registration and automatic course enrollment.

### 4.2 Proposed Schema

#### 4.2.1 New Table: `invitation_links`

```sql
-- File: src/supabase/migrations/[timestamp]-create_invitation_links.sql

CREATE TABLE invitation_links (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  
  -- Link Information
  invite_code text UNIQUE NOT NULL,  -- e.g., UUID or short code
  invite_url text NOT NULL,  -- Full URL for easy sharing
  
  -- Creator Information
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  creator_role text NOT NULL,  -- 'admin' or 'tutor'
  
  -- Course Assignment
  course_id bigint REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  auto_enroll boolean DEFAULT true,
  
  -- Restrictions
  max_uses integer DEFAULT NULL,  -- NULL = unlimited
  current_uses integer DEFAULT 0,
  valid_until timestamptz DEFAULT NULL,  -- NULL = no expiry
  
  -- Student Restrictions
  allowed_emails text[] DEFAULT NULL,  -- NULL = any email allowed
  required_email_domain text,  -- e.g., 'school.edu'
  
  -- Status
  is_active boolean DEFAULT true,
  
  -- Metadata
  description text,
  custom_message text,  -- Welcome message shown to students
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_invitation_links_code ON invitation_links(invite_code);
CREATE INDEX idx_invitation_links_creator ON invitation_links(created_by);
CREATE INDEX idx_invitation_links_course ON invitation_links(course_id);
CREATE INDEX idx_invitation_links_active ON invitation_links(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE invitation_links ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own invitations"
ON invitation_links FOR SELECT TO authenticated
USING (
  created_by = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins and tutors can create invitations"
ON invitation_links FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'tutor')
  )
);

CREATE POLICY "Creators can update their invitations"
ON invitation_links FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Creators can delete their invitations"
ON invitation_links FOR DELETE TO authenticated
USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

#### 4.2.2 New Table: `invitation_uses`

```sql
-- Track who used which invitation
CREATE TABLE invitation_uses (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  
  invitation_id bigint REFERENCES invitation_links(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  
  email text NOT NULL,  -- Email used during signup
  ip_address text,
  user_agent text,
  
  registration_completed boolean DEFAULT false,
  enrolled_in_course boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_invitation_uses_invitation ON invitation_uses(invitation_id);
CREATE INDEX idx_invitation_uses_user ON invitation_uses(user_id);
```

### 4.3 Invitation Flow

**Generation Flow:**
1. Tutor/Admin clicks "Invite Students" button
2. Selects course for auto-enrollment
3. Sets optional restrictions (expiry, max uses, email domain)
4. Adds custom welcome message
5. System generates unique invite code and URL
6. Tutor copies link or sends via email

**Student Registration Flow:**
1. Student clicks invitation link (e.g., `/signup?invite=ABC123`)
2. Signup page pre-fills course information
3. Shows custom welcome message from tutor
4. Student completes registration
5. Email verification (if enabled)
6. Upon verification, auto-enrolled in course
7. Redirected to course dashboard

### 4.4 Frontend Components

**New Components:**
```
src/components/tutor/InvitationManager.jsx
src/components/admin/InvitationManagement.jsx
src/components/auth/InviteSignup.jsx
src/components/common/InvitationCard.jsx
```

**InvitationManager Features:**
- Create new invitation
- View active invitations (table)
- Copy invitation URL to clipboard
- Send invitations via email (future: integrate with email service)
- View invitation usage statistics
- Activate/deactivate invitations
- Set expiry dates

**InviteSignup Features:**
- Display course name and description
- Show tutor's custom message
- Pre-fill course enrollment
- Validate invitation before allowing signup
- Show invitation expired/invalid messages

### 4.5 API Endpoints

```javascript
// src/server/routes/invitations.js

// POST /api/invitations/create
// Body: { courseId, maxUses, validUntil, allowedEmails, customMessage }
// Returns: { inviteCode, inviteUrl, invitationId }

// GET /api/invitations/validate/:inviteCode
// Returns: { valid, courseInfo, customMessage, restrictions }

// POST /api/invitations/use
// Body: { inviteCode, email, userId }
// Returns: { success, enrolled }

// GET /api/invitations/my-invitations
// Returns: Array of invitations created by user

// GET /api/invitations/stats/:invitationId
// Returns: { totalUses, pendingRegistrations, completedEnrollments }

// PATCH /api/invitations/:invitationId
// Body: { isActive, maxUses, validUntil }
// Returns: Updated invitation

// DELETE /api/invitations/:invitationId
// Returns: { deleted: true }

// GET /api/invitations/course/:courseId
// Returns: All invitations for a course
```

### 4.6 Security Considerations

**Validation:**
- Check invitation validity before signup
- Verify email domain if restricted
- Prevent duplicate uses by same email
- Rate limiting on invitation creation
- Track suspicious activity (multiple failed attempts)

**Invite Code Generation:**
```javascript
// Short, user-friendly codes
const generateInviteCode = () => {
  // Format: XXXX-XXXX (e.g., AB7X-9M2Q)
  return crypto.randomBytes(4)
    .toString('base64')
    .replace(/[+/=]/g, '')
    .substring(0, 8)
    .toUpperCase()
    .replace(/(.{4})/, '$1-');
};
```

### 4.7 User Stories

- **As a Tutor**, I want to send invitation links to my students so they can easily join my course
- **As an Admin**, I want to generate bulk invitations for a new class cohort
- **As a Student**, I want to use an invitation link to quickly register and join my course

---

## Database Schema Changes

### Summary of New Tables

| Table | Purpose | Relationships |
|-------|---------|---------------|
| `enrollment_keys` | Course enrollment keys | → courses, profiles |
| `invitation_links` | Student invitation system | → courses, profiles |
| `invitation_uses` | Track invitation usage | → invitation_links, profiles |
| `test_submissions` | Detailed test results | → profiles, courses |
| `grade_scales` | Scoring configuration | → courses |

### Summary of Modified Tables

| Table | Changes |
|-------|---------|
| `profiles` | + tutor role fields (specialty, bio, approved, assigned_courses) |
| `questions` | + section, difficulty_weight, points |
| `enrollments` | + enrollment_key_id, enrollment_method |

### Database Migration Strategy

**Migration Order:**
1. ✅ Add tutor role support to profiles
2. ✅ Create enrollment_keys table
3. ✅ Create invitation_links and invitation_uses tables
4. ✅ Create test_submissions table
5. ✅ Create grade_scales table
6. ✅ Update questions table with sections
7. ✅ Update enrollments table
8. ✅ Update all RLS policies
9. ✅ Create necessary indexes
10. ✅ Seed initial data (grade scales for existing courses)

**Rollback Plan:**
- Each migration file should include a rollback section
- Document current state before migrations
- Test migrations in development environment
- Create database backup before production deployment

---

## Implementation Timeline

### Phase 1: Foundation (Week 1) ⏰ **7-10 days**

**Database Setup:**
- [x] Create all migration files
- [ ] Test migrations locally
- [ ] Review and optimize indexes
- [ ] Update RLS policies

**Backend API:**
- [ ] Create tutor routes
- [ ] Create enrollment key endpoints
- [ ] Create invitation endpoints
- [ ] Create grading endpoints
- [ ] Add input validation
- [ ] Add error handling

### Phase 2: Authentication & Roles (Week 2) ⏰ **7 days**

**Frontend - Auth:**
- [ ] Create RoleSelector component
- [ ] Create AdminLogin component
- [ ] Create TutorLogin component
- [ ] Create StudentLogin component
- [ ] Update App.jsx routing
- [ ] Update ProtectedRoute
- [ ] Update Signup for tutor registration

**Frontend - Tutor Dashboard:**
- [ ] Create TutorLayout
- [ ] Create TutorDashboard
- [ ] Create TutorCourseManagement
- [ ] Create StudentManagement

### Phase 3: Enrollment Systems (Week 3) ⏰ **7-10 days**

**Enrollment Keys:**
- [ ] EnrollmentKeyManagement (Admin)
- [ ] EnrollmentKeyManager (Tutor)
- [ ] EnrollmentKeyInput (Student)
- [ ] Key validation logic
- [ ] Test key creation and usage

**Invitation Links:**
- [ ] InvitationManager (Tutor)
- [ ] InvitationManagement (Admin)
- [ ] InviteSignup component
- [ ] Email validation
- [ ] Auto-enrollment logic
- [ ] Test invitation flow

### Phase 4: Grading System (Week 4) ⏰ **10-14 days**

**Backend:**
- [ ] Implement scoring algorithms
- [ ] Create grade calculation engine
- [ ] Section-wise analysis logic
- [ ] Weak area identification

**Frontend:**
- [ ] GradeReport component
- [ ] ScoreChart visualization
- [ ] SectionAnalysis component
- [ ] ProgressGraph component
- [ ] GradingConfiguration (Admin)
- [ ] Update QuizInterface to use new grading

**Integration:**
- [ ] Update existing quiz submission
- [ ] Migrate old scores (if needed)
- [ ] Test all grading scenarios

### Phase 5: Testing & Polish (Week 5) ⏰ **5-7 days**

**Testing:**
- [ ] Unit tests for grading engine
- [ ] Integration tests for enrollment flows
- [ ] E2E tests for user journeys
- [ ] Security testing
- [ ] Performance testing

**Polish:**
- [ ] UI/UX refinements
- [ ] Error message improvements
- [ ] Loading states
- [ ] Responsive design check
- [ ] Accessibility audit

### Phase 6: Deployment (Week 6) ⏰ **3-5 days**

**Pre-deployment:**
- [ ] Database backup
- [ ] Run migrations on production DB
- [ ] Environment variables setup
- [ ] Stripe integration check (if needed)

**Deployment:**
- [ ] Deploy backend to Render
- [ ] Deploy frontend to Firebase
- [ ] Smoke tests on production
- [ ] Monitor error logs

**Post-deployment:**
- [ ] User acceptance testing
- [ ] Bug fixes
- [ ] Documentation updates
- [ ] Training materials for admins/tutors

---

## Testing Strategy

### Unit Tests

**Backend:**
```javascript
// tests/grading.test.js
describe('Grading Engine', () => {
  it('calculates raw score correctly', () => {});
  it('calculates section scores', () => {});
  it('applies grade scale conversion', () => {});
  it('identifies weak areas', () => {});
});

// tests/enrollment.test.js
describe('Enrollment Key Validation', () => {
  it('validates active keys', () => {});
  it('rejects expired keys', () => {});
  it('enforces usage limits', () => {});
  it('prevents duplicate enrollments', () => {});
});
```

**Frontend:**
```javascript
// tests/components/GradeReport.test.jsx
describe('GradeReport Component', () => {
  it('renders score breakdown', () => {});
  it('displays section analysis', () => {});
  it('shows scaled scores', () => {});
});
```

### Integration Tests

**User Flows:**
1. **Tutor Registration → Course Assignment → Student Invitation**
2. **Student Invitation Use → Signup → Auto-enrollment**
3. **Enrollment Key Creation → Student Key Use → Course Access**
4. **Quiz Completion → Grade Calculation → Report Display**

### Manual Testing Checklist

**Authentication:**
- [ ] Admin can log in via /login/admin
- [ ] Tutor can log in via /login/tutor
- [ ] Student can log in via /login/student
- [ ] Role-based redirects work correctly
- [ ] Tutor approval workflow functions

**Enrollment Keys:**
- [ ] Admin can create keys with restrictions
- [ ] Tutor can create keys for assigned courses
- [ ] Student can use valid key to enroll
- [ ] Expired keys are rejected
- [ ] Usage limits are enforced

**Invitation Links:**
- [ ] Tutor can generate invitation link
- [ ] Link includes course information
- [ ] Custom message displays on signup
- [ ] Auto-enrollment works after verification
- [ ] Invitation statistics are accurate

**Grading:**
- [ ] Quiz submission calculates all scores
- [ ] Section breakdown is accurate
- [ ] Scaled scores apply correctly
- [ ] Grade report displays properly
- [ ] Historical scores show trends

---

## API Documentation

### Authentication Endpoints

```
POST /api/auth/signup
Body: { email, password, name, role, inviteCode? }
Returns: { user, session }

POST /api/auth/login
Body: { email, password, role }
Returns: { user, session }

POST /api/auth/logout
Returns: { success: true }

GET /api/auth/session
Returns: { user, session }
```

### Enrollment Endpoints

```
POST /api/enrollment/create-key
Headers: Authorization: Bearer <token>
Body: { courseId, maxUses, maxStudents, validUntil, description }
Returns: { key: { id, keyCode, courseId, ... } }

POST /api/enrollment/validate-key
Body: { keyCode }
Returns: { valid, course, restrictions }

POST /api/enrollment/use-key
Headers: Authorization: Bearer <token>
Body: { keyCode }
Returns: { enrolled, enrollmentId, course }

GET /api/enrollment/keys
Headers: Authorization: Bearer <token>
Query: ?courseId=123
Returns: { keys: [...] }

DELETE /api/enrollment/key/:keyId
Headers: Authorization: Bearer <token>
Returns: { success: true }
```

### Invitation Endpoints

```
POST /api/invitations/create
Headers: Authorization: Bearer <token>
Body: { courseId, maxUses, validUntil, customMessage }
Returns: { invitation: { id, inviteCode, inviteUrl, ... } }

GET /api/invitations/validate/:inviteCode
Returns: { valid, invitation, course }

POST /api/invitations/use
Body: { inviteCode, email, userId }
Returns: { success, enrolled }

GET /api/invitations/my-invitations
Headers: Authorization: Bearer <token>
Returns: { invitations: [...] }

GET /api/invitations/stats/:invitationId
Headers: Authorization: Bearer <token>
Returns: { stats: { uses, pending, completed } }
```

### Grading Endpoints

```
POST /api/grading/submit-test
Headers: Authorization: Bearer <token>
Body: { courseId, level, answers, duration }
Returns: { submission: { id, scores, sections, ... } }

GET /api/grading/submission/:submissionId
Headers: Authorization: Bearer <token>
Returns: { submission: {...} }

GET /api/grading/my-scores/:courseId
Headers: Authorization: Bearer <token>
Returns: { submissions: [...] }

GET /api/grading/section-analysis/:courseId
Headers: Authorization: Bearer <token>
Returns: { analysis: { math: {...}, reading: {...}, writing: {...} } }

POST /api/grading/configure-scale
Headers: Authorization: Bearer <token>
Body: { courseId, section, minRaw, maxRaw, minScaled, maxScaled }
Returns: { scale: {...} }
```

### Tutor Endpoints

```
GET /api/tutor/dashboard
Headers: Authorization: Bearer <token>
Returns: { courses, students, stats }

GET /api/tutor/students
Headers: Authorization: Bearer <token>
Query: ?courseId=123
Returns: { students: [...] }

GET /api/tutor/course-grades/:courseId
Headers: Authorization: Bearer <token>
Returns: { grades: [...] }
```

---

## Security Considerations

### Authentication & Authorization

**Role-Based Access:**
- All tutor endpoints require `role = 'tutor'` verification
- Tutors can only access assigned courses
- RLS policies enforce data isolation
- Admin override for all policies

**Token Security:**
- JWT tokens from Supabase Auth
- Token expiration: 1 hour (configurable)
- Refresh token rotation
- Secure httpOnly cookies for sessions

### Data Validation

**Input Sanitization:**
```javascript
// Example validator for enrollment key creation
const validateKeyCreation = (data) => {
  const schema = Joi.object({
    courseId: Joi.number().required(),
    maxUses: Joi.number().min(1).max(1000).optional(),
    maxStudents: Joi.number().min(1).max(500).optional(),
    validUntil: Joi.date().greater('now').optional(),
    description: Joi.string().max(500).optional()
  });
  
  return schema.validate(data);
};
```

**Rate Limiting:**
- Enrollment key creation: 10/hour per user
- Invitation creation: 20/hour per user
- Key validation attempts: 100/hour per IP
- Failed login attempts: 5/15min per email

### Privacy & GDPR

**Data Handling:**
- Student email addresses encrypted at rest
- IP addresses anonymized after 30 days
- GDPR-compliant data export
- Right to be forgotten implementation

---

## Performance Optimization

### Database Optimization

**Indexes:**
- All foreign keys have indexes
- Composite indexes for common queries
- Partial indexes for active records only

**Query Optimization:**
```sql
-- Efficient query for tutor's students
SELECT p.* 
FROM profiles p
JOIN enrollments e ON e.user_id = p.id
WHERE e.course_id IN (
  SELECT unnest(assigned_courses) 
  FROM profiles 
  WHERE id = $1 AND role = 'tutor'
)
AND p.role = 'student';
```

### Caching Strategy

**Redis Caching (Future Enhancement):**
- Cache enrollment key validations (5 min TTL)
- Cache grade scales (1 hour TTL)
- Cache course information (30 min TTL)

**Browser Caching:**
- Grade reports cached in localStorage
- Course list cached for 5 minutes
- Static assets with long cache headers

### Frontend Performance

**Code Splitting:**
```javascript
// Lazy load heavy components
const GradeReport = lazy(() => import('./components/student/GradeReport'));
const InvitationManager = lazy(() => import('./components/tutor/InvitationManager'));
```

**Pagination:**
- Grade history: 20 records per page
- Enrollment keys: 50 per page
- Student lists: 50 per page

---

## Documentation & Training

### User Guides

**Admin Guide:**
1. Managing tutor accounts
2. Creating enrollment keys
3. Configuring grade scales
4. Viewing system-wide analytics

**Tutor Guide:**
1. Accessing tutor dashboard
2. Managing assigned courses
3. Creating invitation links
4. Viewing student grades
5. Generating class reports

**Student Guide:**
1. Using enrollment keys
2. Registering via invitation links
3. Understanding grade reports
4. Tracking section performance

### API Documentation

- Comprehensive endpoint documentation
- Request/response examples
- Error code reference
- Authentication flow diagrams

---

## Monitoring & Analytics

### Metrics to Track

**Engagement:**
- Enrollment key usage rates
- Invitation link conversion rates
- Average time to enroll
- Active tutors count

**Performance:**
- Grade calculation time
- Database query performance
- API response times
- Error rates

**Business:**
- Students per tutor
- Course enrollment trends
- Test submission rates
- Score improvement over time

### Error Tracking

**Sentry Integration:**
- Frontend error tracking
- Backend exception monitoring
- Performance monitoring
- User session replay

---

## Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Bulk Operations:**
   - CSV import for student enrollment
   - Bulk invitation email sending
   - Batch key generation

2. **Advanced Analytics:**
   - Percentile rankings
   - Class comparisons
   - Learning curve analysis
   - Predictive scoring

3. **Communication:**
   - In-app messaging (tutor ↔ student)
   - Announcement system
   - Email notifications for key events

4. **Collaboration:**
   - Tutor groups/departments
   - Shared enrollment keys
   - Co-teaching support

5. **Mobile App:**
   - React Native app
   - Push notifications
   - Offline grade viewing

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Database migration failure | Low | High | Test thoroughly, create backups |
| RLS policy conflicts | Medium | Medium | Careful policy design, testing |
| Scaling issues (many enrollments) | Medium | Medium | Implement caching, optimize queries |
| Grading calculation bugs | Medium | High | Extensive unit tests, QA |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| User adoption (tutors) | Medium | High | Training materials, onboarding |
| Complexity overwhelming users | Medium | Medium | Phased rollout, UI/UX focus |
| Data privacy concerns | Low | High | GDPR compliance, clear policies |

---

## Success Criteria

### Launch Metrics (First Month)

- [ ] 90%+ successful login rate for all roles
- [ ] <2% enrollment key validation failure rate
- [ ] <5 seconds average grade calculation time
- [ ] Zero critical security vulnerabilities
- [ ] >95% uptime (backend + database)

### User Satisfaction (First Quarter)

- [ ] >80% tutor satisfaction with invitation system
- [ ] >85% student satisfaction with grade reports
- [ ] <5% support tickets related to enrollment issues
- [ ] >70% invitation link conversion rate

---

## Appendix

### Technology Stack

**Frontend:**
- React 18
- Vite 5
- TailwindCSS
- Framer Motion
- React Router v6
- Recharts (for grade visualizations)

**Backend:**
- Node.js v18+
- Express.js
- Supabase (PostgreSQL)
- Stripe (payments)

**DevOps:**
- Frontend: Firebase Hosting
- Backend: Render.com
- Database: Supabase Cloud
- Version Control: Git

### Database ER Diagram (Simplified)

```
profiles (users)
├── id (PK)
├── role (admin/tutor/student)
└── assigned_courses (tutor only)

courses
├── id (PK)
└── name

enrollment_keys
├── id (PK)
├── course_id (FK → courses)
├── created_by (FK → profiles)
└── key_code

invitation_links
├── id (PK)
├── course_id (FK → courses)
├── created_by (FK → profiles)
└── invite_code

test_submissions
├── id (PK)
├── user_id (FK → profiles)
├── course_id (FK → courses)
├── raw_score
├── scaled_score
└── section scores (math/reading/writing)

enrollments
├── id (PK)
├── user_id (FK → profiles)
├── course_id (FK → courses)
├── enrollment_key_id (FK → enrollment_keys)
└── enrollment_method
```

---

## Conclusion

This implementation plan outlines a comprehensive approach to adding four major features to the AI Tutor Application. The phased approach ensures manageable development cycles while maintaining system stability. Each feature builds upon the existing architecture and follows established patterns in the codebase.

**Estimated Total Development Time:** 6-8 weeks  
**Team Size Recommendation:** 2-3 developers  
**Priority Order:**
1. Separate Login Panels (Foundation for all other features)
2. Enrollment Key System (Quick win, high value)
3. Student Invitation Links (Complements enrollment keys)
4. Advanced Grading System (Most complex, highest long-term value)

---

**Document Version:** 1.0  
**Last Updated:** January 12, 2026  
**Status:** Ready for Review & Implementation
