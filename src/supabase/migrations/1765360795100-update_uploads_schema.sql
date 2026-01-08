/* 
# Update Uploads Schema for Course Materials
1. New Columns in `uploads` table:
   - `category`: To distinguish between 'source_document', 'study_material', 'video_lecture'
   - `level`: To tag files with 'Easy', 'Medium', 'Hard', or 'All'
   - `file_type`: To store extension (pdf, mp4, etc.)
   - `file_url`: For storing the path/url (simulated for now)
*/

DO $$ 
BEGIN 
    -- Add category column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'uploads' AND column_name = 'category') THEN 
        ALTER TABLE uploads ADD COLUMN category text DEFAULT 'source_document'; 
    END IF;

    -- Add level column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'uploads' AND column_name = 'level') THEN 
        ALTER TABLE uploads ADD COLUMN level text DEFAULT 'All'; 
    END IF;

    -- Add file_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'uploads' AND column_name = 'file_type') THEN 
        ALTER TABLE uploads ADD COLUMN file_type text; 
    END IF;

    -- Add file_url column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'uploads' AND column_name = 'file_url') THEN 
        ALTER TABLE uploads ADD COLUMN file_url text; 
    END IF;
END $$;