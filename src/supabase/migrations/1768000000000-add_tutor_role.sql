/* 
# Add Tutor Role Support
1. Add tutor-specific fields to profiles table
2. Create indexes for tutor lookups
3. Update RLS policies for tutor access
*/

-- Add tutor-specific columns to profiles
DO $$ 
BEGIN 
    -- Add tutor specialty (e.g., "SAT Math", "ACT Science")
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'tutor_specialty') THEN
        ALTER TABLE profiles ADD COLUMN tutor_specialty text;
    END IF;

    -- Add tutor bio/description
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'tutor_bio') THEN
        ALTER TABLE profiles ADD COLUMN tutor_bio text;
    END IF;

    -- Add tutor approval status (tutors need admin approval)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'tutor_approved') THEN
        ALTER TABLE profiles ADD COLUMN tutor_approved boolean DEFAULT false;
    END IF;

    -- Add assigned courses array (which courses this tutor can access)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'assigned_courses') THEN
        ALTER TABLE profiles ADD COLUMN assigned_courses bigint[] DEFAULT '{}';
    END IF;

    -- Add phone number for all users
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
        ALTER TABLE profiles ADD COLUMN phone text;
    END IF;

    -- Add profile image
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
        ALTER TABLE profiles ADD COLUMN avatar_url text;
    END IF;
END $$;

-- Create index for tutor role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role_tutor 
ON profiles(role) WHERE role = 'tutor';

-- Create index for approved tutors
CREATE INDEX IF NOT EXISTS idx_profiles_tutor_approved 
ON profiles(tutor_approved) WHERE role = 'tutor' AND tutor_approved = true;

-- Create index for assigned courses (GIN index for array operations)
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_courses 
ON profiles USING GIN(assigned_courses);

-- Update RLS Policies for Tutor Access

-- Tutors can view their assigned courses
DROP POLICY IF EXISTS "Tutors can view assigned courses" ON courses;
CREATE POLICY "Tutors can view assigned courses"
ON courses FOR SELECT TO authenticated
USING (
  -- Course is public OR user is admin OR user is tutor with this course assigned
  true = true OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'tutor' 
    AND courses.id = ANY(assigned_courses)
    AND tutor_approved = true
  )
);

-- Tutors can view students enrolled in their courses
DROP POLICY IF EXISTS "Tutors can view enrolled students" ON profiles;
CREATE POLICY "Tutors can view enrolled students"
ON profiles FOR SELECT TO authenticated
USING (
  -- User can view own profile OR is admin OR is viewing students in their courses
  auth.uid() = id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') OR
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN enrollments e ON e.user_id = profiles.id
    WHERE p.id = auth.uid()
    AND p.role = 'tutor'
    AND p.tutor_approved = true
    AND e.course_id = ANY(p.assigned_courses)
  )
);

-- Tutors can view enrollments for their courses
DROP POLICY IF EXISTS "Tutors can view course enrollments" ON enrollments;
CREATE POLICY "Tutors can view course enrollments"
ON enrollments FOR SELECT TO authenticated
USING (
  -- User can view own enrollments OR is admin OR is tutor for this course
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'tutor'
    AND p.tutor_approved = true
    AND enrollments.course_id = ANY(p.assigned_courses)
  )
);

-- Tutors can view questions for their assigned courses
DROP POLICY IF EXISTS "Tutors can view course questions" ON questions;
CREATE POLICY "Tutors can view course questions"
ON questions FOR SELECT TO authenticated
USING (
  -- Everyone can view questions OR specifically tutors for their courses
  true = true OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'tutor'
    AND p.tutor_approved = true
    AND questions.course_id = ANY(p.assigned_courses)
  )
);

-- Create a function to check if user is an approved tutor
CREATE OR REPLACE FUNCTION is_approved_tutor()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'tutor'
    AND tutor_approved = true
  );
END;
$$;

-- Create a function to get tutor's assigned courses
CREATE OR REPLACE FUNCTION get_tutor_courses()
RETURNS TABLE (
  id bigint,
  name text,
  description text,
  tutor_type text,
  created_at timestamptz,
  enrolled_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.tutor_type,
    c.created_at,
    COUNT(DISTINCT e.user_id) as enrolled_count
  FROM courses c
  LEFT JOIN enrollments e ON e.course_id = c.id
  WHERE c.id = ANY(
    SELECT unnest(assigned_courses) 
    FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'tutor'
    AND tutor_approved = true
  )
  GROUP BY c.id, c.name, c.description, c.tutor_type, c.created_at;
END;
$$;

-- Create a function to get students for tutor's courses
CREATE OR REPLACE FUNCTION get_tutor_students(course_filter bigint DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  enrolled_course_id bigint,
  enrolled_at timestamptz,
  progress_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.email,
    e.course_id as enrolled_course_id,
    e.enrolled_at,
    COUNT(pr.id)::bigint as progress_count
  FROM profiles p
  JOIN enrollments e ON e.user_id = p.id
  LEFT JOIN progress pr ON pr.user_id = p.id
  WHERE p.role = 'student'
  AND e.course_id = ANY(
    SELECT unnest(assigned_courses) 
    FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'tutor'
    AND tutor_approved = true
  )
  AND (course_filter IS NULL OR e.course_id = course_filter)
  GROUP BY p.id, p.name, p.email, e.course_id, e.enrolled_at
  ORDER BY e.enrolled_at DESC;
END;
$$;
