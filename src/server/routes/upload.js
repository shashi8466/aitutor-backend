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
// Helper to get authenticated Supabase client
const getSupabase = (authHeader) => {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_KEY) {
    throw new Error('Supabase client failed: SUPABASE_KEY is required.');
  }

  // If auth header is provided, use it; otherwise use service role key
  const token = authHeader ? authHeader.replace('Bearer ', '') : SERVICE_ROLE_KEY;

  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
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

    // 6. Create initial upload record
    const { data: initialUpload, error: uploadError } = await supabase
      .from('uploads')
      .insert([{
        course_id: parseInt(courseId),
        file_name: req.file.originalname,
        status: (parse === 'true' || category === 'quiz_document') ? 'processing' : 'completed',
        questions_count: 0,
        category: category,
        level: level,
        file_type: fileExt,
        file_url: fileUrl
      }])
      .select()
      .single();

    if (uploadError) throw new Error(`Failed to save file record: ${uploadError.message}`);

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