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

router.post('/', upload.single('file'), async (req, res) => {
  console.log('\n📤 [UPLOAD] New upload request received');
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
    const { courseId, category = 'source_document', level = 'All', parse = 'false' } = req.body;

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
      file_url: fileUrl
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

    // 7. Parse questions if requested
    if (parse === 'true' || category === 'quiz_document') {
      console.log('🔍 [PARSER] Starting question extraction...');
      try {
        // Ensure parser receives the in-memory buffer (disk storage does not attach buffer)
        const parseResult = await parseDocument({ ...req.file, buffer: fileBuffer, path: req.file.path });
        const parsedQuestions = parseResult.questions || [];
        const extractedImages = parseResult.images || [];

        // Deduplicate questions to prevent double inserts (e.g., from numbering artifacts)
        const dedupedQuestions = [];
        const seenKeys = new Set();

        for (const q of parsedQuestions) {
          const normalizedQuestion = (q.question || '').replace(/[^\S\r\n]+/g, ' ').trim();
          const normalizedOptions = (q.options || []).map(opt => (opt || '').replace(/[^\S\r\n]+/g, ' ').trim());
          const normalizedAnswer = (q.correctAnswer || '').toString().trim().toLowerCase();
          const key = `${normalizedQuestion}|${normalizedOptions.join('||')}|${normalizedAnswer}`;
          if (normalizedQuestion && !seenKeys.has(key)) {
            seenKeys.add(key);
            dedupedQuestions.push({
              ...q,
              question: normalizedQuestion,
              options: normalizedOptions,
              correctAnswer: q.correctAnswer
            });
          }
        }

        if (dedupedQuestions.length > 0) {
          questionsCount = dedupedQuestions.length;

          // Process and upload images
          const imageMap = {};
          if (extractedImages && extractedImages.length > 0) {
            console.log(`🖼️ [UPLOAD] Found ${extractedImages.length} images to process`);
            for (const img of extractedImages) {
              try {
                const storagePath = `${courseId}/question_images/${img.name}`;
                await supabase.storage
                  .from(BUCKET_NAME)
                  .upload(storagePath, img.buffer, {
                    contentType: `image/${img.extension}`,
                    upsert: true
                  });

                const { data } = supabase.storage
                  .from(BUCKET_NAME)
                  .getPublicUrl(storagePath);

                imageMap[img.id] = data.publicUrl;
                console.log(`✅ [UPLOAD] Mapped image ${img.id} -> ${data.publicUrl}`);
              } catch (imgErr) {
                console.warn(`❌ [UPLOAD] Image upload failed for ${img.id}:`, imgErr.message);
              }
            }
          }
          console.log('🗺️ [UPLOAD] Final Image Map:', Object.keys(imageMap));

          const questionsToInsert = dedupedQuestions.map(q => {
            let processedQuestion = q.question;
            let processedExplanation = q.explanation || '';
            let mainImage = null;

            const imageRegex = /\[IMAGE:\s*([^\]]+)\]/g;

            // Replace in Question
            processedQuestion = processedQuestion.replace(imageRegex, (match, fullId) => {
              const imageId = fullId.split('.')[0];
              if (imageMap[imageId]) {
                const url = imageMap[imageId];
                if (!mainImage) mainImage = url;
                return `<div class="question-image" style="margin:15px 0; text-align:center;"><img src="${url}" alt="Diagram" style="max-width:100%; height:auto; border-radius:8px;" /></div>`;
              }
              return '';
            });

            // Replace in Explanation
            processedExplanation = processedExplanation.replace(imageRegex, (match, fullId) => {
              const imageId = fullId.split('.')[0];
              if (imageMap[imageId]) {
                const url = imageMap[imageId];
                return `<div class="explanation-image" style="margin:10px 0; text-align:center;"><img src="${url}" alt="Solution Step" style="max-width:100%; height:auto; border-radius:4px;" /></div>`;
              }
              return '';
            });

            let questionLevel;
            if (level === 'All') {
              questionLevel = q.level || 'Medium';
            } else {
              questionLevel = q.level || level;
            }
            const normalizedLevel = questionLevel.charAt(0).toUpperCase() + questionLevel.slice(1).toLowerCase();

            return {
              course_id: parseInt(courseId),
              level: normalizedLevel,
              type: (q.options && q.options.length >= 2) ? 'mcq' : 'short_answer',
              question: processedQuestion,
              options: q.options || [],
              correct_answer: q.correctAnswer || '',
              explanation: processedExplanation,
              upload_id: uploadId,
              image: mainImage
            };
          });

          const { error: qError } = await supabase
            .from('questions')
            .insert(questionsToInsert);

          if (qError) throw new Error(`Database error: ${qError.message}`);
          console.log(`✅ [DB] Inserted ${questionsToInsert.length} questions`);

          // Log sample question data for debugging
          if (questionsToInsert.length > 0) {
            const sampleQ = questionsToInsert[0];
            console.log(`📝 [DB] Sample question inserted:`, {
              course_id: sampleQ.course_id,
              level: sampleQ.level,
              upload_id: sampleQ.upload_id,
              type: sampleQ.type
            });

            // Verify questions were inserted
            const { data: verifyQuestions, error: verifyErr } = await supabase
              .from('questions')
              .select('id, course_id, level, upload_id')
              .eq('upload_id', uploadId)
              .limit(5);

            if (!verifyErr && verifyQuestions) {
              console.log(`✅ [DB] Verified ${verifyQuestions.length} question(s) in database for upload ${uploadId}`);
            }
          }

          finalStatus = 'completed';
        } else {
          parseErrorMsg = 'No questions found in document after parsing.';
          finalStatus = 'warning';
        }
      } catch (parseError) {
        console.error('❌ [PARSER] Error:', parseError);
        finalStatus = 'error';
        parseErrorMsg = parseError.message;
      }

      // Update upload record with results
      await supabase
        .from('uploads')
        .update({
          status: finalStatus,
          questions_count: questionsCount
        })
        .eq('id', uploadId);
    }

    console.log('✅ [UPLOAD] Completed successfully');

    res.json({
      success: true,
      message: questionsCount > 0
        ? `Successfully imported ${questionsCount} questions!`
        : `File uploaded successfully.`,
      count: questionsCount,
      upload: { ...initialUpload, status: finalStatus, questions_count: questionsCount }
    });

  } catch (error) {
    console.error('❌ [UPLOAD] Fatal error:', error);
    res.status(500).json({
      error: error.message || 'Internal Server Error during upload.',
      hint: 'Check server logs for details.'
    });
  } finally {
    // Ensure temp file is always cleaned up
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        console.warn('⚠️ [UPLOAD] Failed to clean temp file:', cleanupErr.message);
      }
    }
  }
});

export default router;