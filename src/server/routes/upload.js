import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { parseDocument } from '../utils/parser.js';
import supabaseAdmin from '../../supabase/supabaseAdmin.js';

const router = express.Router();

// CRITICAL: File size limit set to 5GB (matches DB Policy)
// Use DISK STORAGE to prevent Node.js Heap OOM crashes with large files
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const tempDir = path.join(process.cwd(), 'temp_uploads');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      cb(null, tempDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 5GB limit
});



const BUCKET_NAME = process.env.BUCKET_NAME || 'documents';

// 🟢 Connectivity Test Route
router.get('/test', async (req, res) => {
  console.log('🧪 Upload test endpoint hit');

  let supabaseStatus = 'unknown';
  let bucketStatus = 'unknown';

  try {
    // Check if client is initialized
    if (!supabaseAdmin) throw new Error('supabaseAdmin client is null');
    
    // Test simple query
    const { data: testData, error: testError } = await supabaseAdmin.from('courses').select('id').limit(1);
    if (testError) throw testError;
    supabaseStatus = 'connected';

    // Test bucket access
    const { data: bucketData, error: bucketError } = await supabaseAdmin.storage.getBucket(BUCKET_NAME);
    if (bucketError) throw bucketError;
    bucketStatus = 'accessible';

    res.json({
      success: true,
      message: 'Upload routes are working!',
      serverStatus: 'online',
      supabase: supabaseStatus,
      bucket: bucketStatus,
      bucketName: BUCKET_NAME,
      maxFileSize: '5GB',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Upload Test Failed:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      supabase: supabaseStatus,
      bucket: bucketStatus
    });
  }
});

/**
 * 🟢 GET ALL UPLOADS
 * This route allows fetching uploads for a specific course or category.
 * Used by Admin Preview to bypass RLS issues in frontend.
 */
router.get('/', async (req, res) => {
    try {
        const { courseId, courseIds } = req.query;
        const supabase = getSupabase(req.headers.authorization);

        let query = supabase.from('uploads')
            .select('*, courses(name)')
            .order('created_at', { ascending: false });

        if (courseId) {
            query = query.eq('course_id', courseId);
        } else if (courseIds) {
            const ids = String(courseIds).split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
            if (ids.length > 0) {
                query = query.in('course_id', ids);
            }
        }

        const { data, error } = await query;
        if (error) throw error;

        res.json({ data: data || [] });
    } catch (error) {
        console.error('❌ [GET ALL] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/', upload.single('file'), async (req, res) => {
  console.log('\n📤 [UPLOAD] New upload request received');
  console.log(' - Time:', new Date().toISOString());
  console.log(' - File present:', !!req.file);

  // Track temp file for cleanup
  const tempFilePath = req.file?.path;

  try {
    console.log('🚀 [UPLOAD] Starting request processing...');
    
    // 1. Validate file exists
    if (!req.file) {
      console.error('❌ [UPLOAD] No file in request');
      return res.status(400).json({ error: 'No file uploaded. Please select a file.' });
    }

    console.log('✅ [UPLOAD] File detected:', req.file.originalname);

    // 2. Extract metadata
    const { courseId, category = 'source_document', level = 'All', parse = 'false', is_practice = 'false', section = 'general' } = req.body;
    
    console.log('📦 [UPLOAD] Metadata:', { courseId, category, level, parse, is_practice, section });

    if (!courseId || courseId === 'undefined' || courseId === 'null') {
      console.error('❌ [UPLOAD] Invalid courseId:', courseId);
      if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({ error: `Invalid Course ID: ${courseId}` });
    }

    const numericCourseId = parseInt(courseId);
    if (isNaN(numericCourseId)) {
        console.error('❌ [UPLOAD] CourseId is not a number:', courseId);
        if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(400).json({ error: `Course ID must be a number, got: ${courseId}` });
    }

    // 3. Read file
    console.log('📄 [UPLOAD] Reading file from disk:', req.file.path);
    if (!fs.existsSync(req.file.path)) {
        throw new Error(`File not found on disk at ${req.file.path}`);
    }
    const fileBuffer = fs.readFileSync(req.file.path);
    console.log(`✅ [UPLOAD] Buffer ready: ${fileBuffer.length} bytes`);

    // 4. Upload to Storage
    const fileExt = req.file.originalname.split('.').pop().toLowerCase();
    const fileName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storagePath = `${numericCourseId}/${fileName}`;

    console.log(`☁️ [UPLOAD] Storage target: ${BUCKET_NAME}/${storagePath}`);

    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (storageError) {
      console.error('❌ [STORAGE] Error:', storageError);
      throw new Error(`Supabase Storage Error: ${storageError.message || JSON.stringify(storageError)}`);
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    const fileUrl = urlData.publicUrl;
    console.log('✅ [UPLOAD] Public URL:', fileUrl);

    // 5. Database Record
    const uploadData = {
      course_id: numericCourseId,
      file_name: req.file.originalname,
      status: (parse === 'true' || category === 'quiz_document') ? 'processing' : 'completed',
      category: category,
      level: level,
      section: section || 'general',
      file_type: fileExt,
      file_url: fileUrl,
      is_practice: is_practice === 'true' || is_practice === true,
      questions_count: 0
    };

    console.log('📝 [UPLOAD] Saving to DB...');
    const { data: insertedUpload, error: insertError } = await supabaseAdmin
      .from('uploads')
      .insert([uploadData])
      .select()
      .single();

    if (insertError) {
      console.error('❌ [DB] Error:', insertError);
      throw new Error(`Database Insert Error: ${insertError.message || JSON.stringify(insertError)}`);
    }

    const uploadId = insertedUpload.id;
    console.log('✅ [UPLOAD] Record created, ID:', uploadId);

    // 6. Background Parsing
    if (parse === 'true' || category === 'quiz_document') {
      console.log(`🚀 [PARSER] Starting background task for ID: ${uploadId}`);
      
      // Fire and forget
      (async () => {
        try {
          const parseResult = await parseDocument({ ...req.file, buffer: fileBuffer, path: req.file.path });
          const parsedQuestions = parseResult.questions || [];
          
          if (parsedQuestions.length > 0) {
            const questionsToInsert = parsedQuestions.map(q => ({
              course_id: numericCourseId,
              level: level === 'All' ? (q.level || 'Medium') : level,
              section: section || q.section || 'math',
              type: (q.options && q.options.length >= 2) ? 'mcq' : 'short_answer',
              question: q.question,
              options: q.options || [],
              correct_answer: q.correctAnswer || '',
              explanation: q.explanation || '',
              upload_id: uploadId,
              topic: q.topic || null,
              difficulty_weight: 1.0
            }));

            const { error: qError } = await supabaseAdmin.from('questions').insert(questionsToInsert);
            if (qError) console.error('❌ [PARSER] DB Error:', qError);
            
            await supabaseAdmin.from('uploads')
              .update({ status: 'completed', questions_count: questionsToInsert.length })
              .eq('id', uploadId);
          } else {
            await supabaseAdmin.from('uploads').update({ status: 'completed', questions_count: 0 }).eq('id', uploadId);
          }
        } catch (err) {
          console.error(`❌ [PARSER] Fatal error for upload ${uploadId}:`, err);
          await supabaseAdmin.from('uploads').update({ status: 'error' }).eq('id', uploadId);
        } finally {
          if (tempFilePath && fs.existsSync(tempFilePath)) {
              try { fs.unlinkSync(tempFilePath); } catch (e) {}
          }
        }
      })();
    } else {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
          try { fs.unlinkSync(tempFilePath); } catch (e) {}
      }
    }

    return res.json({
      success: true,
      message: 'Upload successful',
      upload: insertedUpload
    });

  } catch (error) {
    console.error('💥 [UPLOAD] Fatal Exception:', error);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }
    
    // CRITICAL: Ensure we always return JSON with a message
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Unknown server error during upload',
      details: error.stack // Only for dev debugging, help us see the line number
    });
  }
});

/**
 * 🔴 DELETE UPLOAD
 * Deletes the storage file, all related questions, and the upload record itself.
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`\n🗑️ [DELETE] Request to delete upload ID: ${id}`);
  
  if (!id) {
    return res.status(400).json({ error: 'Upload ID is required' });
  }

  try {

    // 1. Fetch record to get storage path
    const { data: upload, error: fetchError } = await supabaseAdmin
      .from('uploads')
      .select('file_url')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ [DELETE] Fetch error:', fetchError);
      return res.status(500).json({ error: `Fetch failed: ${fetchError.message}` });
    }

    if (!upload) {
      console.warn('⚠️ [DELETE] Upload record not found in DB');
      return res.status(404).json({ error: 'Upload record not found' });
    }

    console.log(` - File URL: ${upload.file_url}`);

    // 2. CRITICAL: Delete all questions associated with this upload
    console.log(` - Purging related questions from 'questions' table...`);
    const { error: qDeleteError, count } = await supabaseAdmin
      .from('questions')
      .delete({ count: 'exact' }) // Using count: exact to know how many were deleted
      .eq('upload_id', id);

    if (qDeleteError) {
      console.error('❌ [DELETE] Question purge failed:', qDeleteError);
      // We stop here if question deletion fails to prevent orphans if upload is deleted
      return res.status(500).json({ error: `Failed to purge related questions: ${qDeleteError.message}` });
    }
    console.log(` ✅ Purged ${count || 0} questions.`);

    // 3. Delete from Storage
    if (upload.file_url) {
      try {
        // Extract storage path from URL (Assuming documents bucket)
        const pathMatch = upload.file_url.split(`/${BUCKET_NAME}/`);
        if (pathMatch.length > 1) {
          const storagePath = pathMatch[1];
          console.log(` - Deleting from storage: ${storagePath}`);
          const { error: storageDeleteError } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .remove([storagePath]);
          
          if (storageDeleteError) {
            console.warn('⚠️ [DELETE] Storage file removal failed (continuing):', storageDeleteError.message);
          } else {
            console.log(' ✅ Storage file deleted.');
          }
        }
      } catch (err) {
        console.warn('⚠️ [DELETE] Error during storage deletion path parsing:', err.message);
      }
    }

    // 4. Delete the upload record itself
    console.log(` - Deleting upload record from 'uploads' table...`);
    const { error: recordDeleteError } = await supabaseAdmin
      .from('uploads')
      .delete()
      .eq('id', id);

    if (recordDeleteError) {
      console.error('❌ [DELETE] Record deletion failed:', recordDeleteError);
      return res.status(500).json({ error: `Failed to delete record: ${recordDeleteError.message}` });
    }

    console.log('🎉 [DELETE] Successfully purged everything related to upload', id);
    res.json({
      success: true,
      message: 'Upload and all associated questions deleted successfully.',
      deletedQuestions: count
    });

  } catch (error) {
    console.error('💥 [DELETE] Fatal error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

export default router;
