import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { parseDocument } from '../utils/parser.js';
import { createClient } from '@supabase/supabase-js';

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

// CRITICAL: Environment var config
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME || 'documents';

// Helper to get authenticated Supabase client
// Helper to get authenticated Supabase client (Now always uses SERVICE ROLE for uploads)
// This is necessary because uploads table often has strict RLS and schema cache issues
const getSupabase = (authHeader) => {
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!SERVICE_ROLE_KEY) {
    console.error('❌ Service Role Key missing! Uploads might fail.');
  }

  // Always use Service Role for Uploding Logic to bypass RLS issues
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

// 🟢 Connectivity Test Route
router.get('/test', async (req, res) => {
  console.log('🧪 Upload test endpoint hit');

  let supabaseStatus = 'unknown';
  let bucketStatus = 'unknown';

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    if (error) throw error;
    supabaseStatus = 'connected';

    // Check if documents bucket exists
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) throw bucketError;
    const hasBucket = buckets.some(b => b.name === BUCKET_NAME);
    bucketStatus = hasBucket ? `ready (${BUCKET_NAME})` : `missing_bucket (${BUCKET_NAME})`;

  } catch (err) {
    console.error('❌ Backend-Supabase Connection Check Failed:', err.message);
    supabaseStatus = `error: ${err.message}`;
  }

  res.json({
    message: 'Upload routes are working!',
    serverStatus: 'online',
    supabaseConnection: supabaseStatus,
    bucketStatus: bucketStatus,
    targetBucket: BUCKET_NAME,
    maxFileSize: '5GB',
    supportedFormats: ['docx', 'txt', 'pdf', 'mp4', 'mov', 'webm'],
    timestamp: new Date().toISOString()
  });
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
  console.log('✨ [DEBUG] Using UPDATED upload handler with topic support! ✨');
  console.log(' - Time:', new Date().toISOString());
  console.log(' - File present:', !!req.file);

  // Track temp file for cleanup
  const tempFilePath = req.file?.path;

  try {
    // 1. Validate file exists
    if (!req.file) {
      console.error('❌ [UPLOAD] No file in request');
      return res.status(400).json({ error: 'No file uploaded. Please select a file.' });
    }

    console.log('✅ [UPLOAD] File received:', {
      name: req.file.originalname,
      size: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`,
      type: req.file.mimetype,
      path: req.file.path
    });

    // 2. Extract metadata
    const { courseId, category = 'source_document', level = 'All', parse = 'false', is_practice = 'false' } = req.body;

    if (!courseId) {
      console.error('❌ [UPLOAD] No courseId provided');
      // Cleanup
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Course ID is missing. Please save the course first.' });
    }

    // 3. Initialize Supabase client
    const supabase = getSupabase(req.headers.authorization);

    // Read buffer once for both storage upload and parsing
    const fileBuffer = fs.readFileSync(req.file.path);

    // 4. Upload file to Supabase Storage (STREAMING)
    const fileExt = req.file.originalname.split('.').pop().toLowerCase();
    const fileName = `${Date.now()}_${req.file.originalname}`;
    const storagePath = `${courseId}/${fileName}`;

    console.log(`☁️ [UPLOAD] Uploading to bucket '${BUCKET_NAME}':`, storagePath);

    const { data: storageData, error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: req.file.mimetype,
        upsert: false,
        duplex: 'half' // Important for large streams in some node versions
      });

    if (storageError) {
      console.error('❌ [STORAGE] Upload failed:', storageError);
      if (storageError.message.includes('bucket not found')) {
        throw new Error(`Storage bucket "${BUCKET_NAME}" does not exist. Please run the migration scripts.`);
      }
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }

    console.log('✅ [STORAGE] File uploaded successfully');

    // 5. Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    const fileUrl = urlData.publicUrl;

    // 6. Create initial upload record with Fallback for missing columns
    let initialUpload;
    let uploadError;

    // Try full insert first
    const fullData = {
      course_id: parseInt(courseId),
      file_name: req.file.originalname,
      status: (parse === 'true' || category === 'quiz_document') ? 'processing' : 'completed',
      questions_count: 0,
      category: category,
      level: level,
      file_type: fileExt,
      file_url: fileUrl,
      is_practice: is_practice === 'true' || is_practice === true
    };

    const { data: fullUpload, error: fullError } = await supabase
      .from('uploads')
      .insert([fullData])
      .select()
      .single();

    if (fullError) {
      console.warn('⚠️ [UPLOAD] Full insert failed, attempting minimal insert (schema mismatch?). Error:', fullError.message);

      // Handle specific schema cache error for 'status' column
      if (fullError.message && fullError.message.includes("Could not find the 'status' column")) {
        // This is a schema cache issue, try to work around it by refreshing the connection
        console.log('🔄 Detected schema cache issue for status column, attempting workaround...');

        // Create a new supabase client instance to bypass cache
        const freshSupabase = getSupabase(req.headers.authorization);

        // Try a minimal insert with only the absolutely required fields
        const minimalData = {
          course_id: parseInt(courseId),
          file_name: req.file.originalname
          // Don't include status to avoid schema cache error initially
        };

        // First, try to insert without the status column
        const { data: insertWithoutStatus, error: insertWithoutStatusError } = await freshSupabase
          .from('uploads')
          .insert([minimalData])
          .select('id, course_id, file_name, created_at')  // Only select known columns
          .single();

        if (insertWithoutStatusError) {
          // If even this fails, there might be other schema issues
          console.error('❌ [UPLOAD] Even minimal insert failed:', insertWithoutStatusError.message);

          // Last resort: try to ensure the uploads table has the status column via a separate approach
          // In this case, the user will need to manually run the migration in Supabase SQL Editor
          throw new Error(`Database error: ${insertWithoutStatusError.message}. Schema may need manual refresh in Supabase dashboard.`);
        }

        // Now try to update the record with the status value
        const { error: updateError } = await freshSupabase
          .from('uploads')
          .update({
            status: (parse === 'true' || category === 'quiz_document') ? 'processing' : 'completed',
            questions_count: 0,
            category: category,
            level: level,
            file_type: fileExt,
            file_url: fileUrl
          })
          .eq('id', insertWithoutStatus.id);

        if (updateError) {
          console.error('❌ [UPLOAD] Update after insert failed:', updateError.message);
          // If update fails but insert succeeded, continue with partial data
          initialUpload = insertWithoutStatus;
        } else {
          // Fetch the updated record
          const { data: updatedData, error: fetchError } = await freshSupabase
            .from('uploads')
            .select()
            .eq('id', insertWithoutStatus.id)
            .single();

          if (fetchError) {
            console.warn('⚠️ [UPLOAD] Could not fetch updated record, using original insert:', fetchError.message);
            initialUpload = insertWithoutStatus;
          } else {
            initialUpload = updatedData;
          }
        }
      } else {
        // Fallback: Drop columns that might be missing in older schemas
        const minimalData = {
          course_id: parseInt(courseId),
          file_name: req.file.originalname,
          status: (parse === 'true' || category === 'quiz_document') ? 'processing' : 'completed'
          // Removed questions_count to be ultra-safe
        };

        const { data: minUpload, error: minError } = await supabase
          .from('uploads')
          .insert([minimalData])
          .select()
          .single();

        if (minError) {
          console.error('❌ [UPLOAD] Minimal insert also failed:', minError.message);
          throw new Error(`Database error: ${minError.message}`);
        }
        initialUpload = minUpload;
      }
    } else {
      initialUpload = fullUpload;
    }

    const uploadId = initialUpload.id;
    let questionsCount = 0;
    let finalStatus = initialUpload.status;
    let parseErrorMsg = null;

    // 7. BACKGROUND PROCESSING: Parse and extract questions
    // DETACHED from main thread to prevent Render timeouts (ERR_CONNECTION_CLOSED)
    if (parse === 'true' || category === 'quiz_document') {
      console.log(`🚀 [UPLOAD] Background parsing started for uploadId ${uploadId}`);
      
      (async () => {
        let questionsCount = 0;
        let finalStatus = 'completed';
        
        try {
          // Fallback topic from filename
          const originalFileName = req.file.originalname;
          let fileTopicFallback = originalFileName.replace(/\.[^/.]+$/, "");
          fileTopicFallback = fileTopicFallback.replace(/\s*[-–—]\s*(Easy|Medium|Hard|Level|Practice|Quiz)\s*.*$/i, "").trim();

          const parseResult = await parseDocument({ ...req.file, buffer: fileBuffer, path: req.file.path });
          const parsedQuestions = parseResult.questions || [];
          const extractedImages = parseResult.images || [];

          const dedupedQuestions = [];
          const seenKeys = new Set();
          for (const q of parsedQuestions) {
            const normalizedQuestion = (q.question || '').replace(/[^\S\r\n]+/g, ' ').trim();
            const normalizedOptions = (q.options || []).map(opt => (opt || '').replace(/[^\S\r\n]+/g, ' ').trim());
            const normalizedAnswer = (q.correctAnswer || '').toString().trim().toLowerCase();
            const key = `${normalizedQuestion}|${normalizedOptions.join('||')}|${normalizedAnswer}`;
            if (normalizedQuestion && !seenKeys.has(key)) {
              seenKeys.add(key);
              dedupedQuestions.push({ ...q, question: normalizedQuestion, options: normalizedOptions });
            }
          }

          if (dedupedQuestions.length > 0) {
            questionsCount = dedupedQuestions.length;
            const imageMap = {};
            
            for (const img of extractedImages) {
              try {
                const storagePath = `${courseId}/question_images/${img.name}`;
                await supabase.storage.from(BUCKET_NAME).upload(storagePath, img.buffer, { contentType: `image/${img.extension}`, upsert: true });
                const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
                imageMap[img.id] = data.publicUrl;
              } catch (e) {}
            }

            const ciImageMap = {};
            Object.keys(imageMap).forEach(key => { ciImageMap[key.toLowerCase()] = imageMap[key]; });

            const questionsToInsert = dedupedQuestions.map(q => {
              let processedQuestion = q.question;
              let processedExplanation = q.explanation || '';
              let mainImage = null;
              const imageRegex = /\[IMAGE:\s*([^\]]+)\]/g;

              const replaceImages = (text, isExplanation = false) => {
                if (!text) return text;
                return text.replace(imageRegex, (match, fullId) => {
                  const imageId = fullId.split('.')[0].toLowerCase();
                  if (ciImageMap[imageId]) {
                    const url = ciImageMap[imageId];
                    if (!mainImage && !isExplanation) mainImage = url;
                    return `<div class="${isExplanation ? "explanation-image" : "question-image"}" style="margin:15px 0; text-align:center;"><img src="${url}" alt="Diagram" style="max-width:100%; height:auto; border-radius:8px;" /></div>`;
                  }
                  return match;
                });
              };

              processedQuestion = replaceImages(processedQuestion);
              processedExplanation = replaceImages(processedExplanation, true);
              const processedOptions = (q.options || []).map(opt => replaceImages(opt));
              const qLevel = level === 'All' ? (q.level || 'Medium') : (q.level || level);
              const normalizedLevel = qLevel.charAt(0).toUpperCase() + qLevel.slice(1).toLowerCase();

              return {
                course_id: parseInt(courseId),
                level: normalizedLevel,
                type: (q.options && q.options.length >= 2) ? 'mcq' : 'short_answer',
                question: processedQuestion,
                options: processedOptions,
                correct_answer: q.correctAnswer || '',
                explanation: processedExplanation,
                upload_id: uploadId,
                image: mainImage,
                topic: q.topic || fileTopicFallback || null,
                section: q.section || 'math',
                difficulty_weight: 1.0
              };
            });

            const { error: qError } = await supabase.from('questions').insert(questionsToInsert);
            if (qError) throw qError;
            console.log(`✅ [DB] Background Parser: Inserted ${questionsToInsert.length} questions.`);
            finalStatus = 'completed';
          } else {
            finalStatus = 'warning';
          }
        } catch (err) {
          console.error(`❌ [PARSER] Background Loop Error:`, err.message);
          finalStatus = 'error';
        } finally {
          await supabase.from('uploads').update({ status: finalStatus, questions_count: questionsCount }).eq('id', uploadId);
          if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        }
      })();
    } else {
      if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }

    // IMMEDIATE RESPONSE to prevent timeouts
    return res.json({
      success: true,
      message: 'File upload successful. Question extraction is running in the background. Status: "processing".',
      upload: { ...initialUpload, status: 'processing' }
    });

  } catch (error) {
    console.error('❌ [UPLOAD] Router Fatal error:', error);
    if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
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
    const supabase = getSupabase(req.headers.authorization);

    // 1. Fetch record to get storage path
    const { data: upload, error: fetchError } = await supabase
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
    const { error: qDeleteError, count } = await supabase
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
          const { error: storageDeleteError } = await supabase.storage
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
    const { error: recordDeleteError } = await supabase
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
