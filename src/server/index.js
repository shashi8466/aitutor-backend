import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUserFromRequest } from './utils/authHelper.js';

// Feature Routes
import aiRoutes from './routes/ai.js';
import uploadRoutes from './routes/upload.js';
import paymentRoutes from './routes/payment.js';
import contactRoutes from './routes/contact.js';
import tutorRoutes from './routes/tutor.js';
import enrollmentRoutes from './routes/enrollment.js';
import invitationsRoutes from './routes/invitations.js';
import gradingRoutes from './routes/grading.js';
import adminGroupsRoutes from './routes/admin-groups.js';
import notificationsRoutes from './routes/notifications.js';
import notificationMiddleware from './middleware/notificationMiddleware.js';
import adminNotificationRoutes from './routes/admin-notifications.js';
import settingsRoutes from './routes/settings.js';
import authRoutes from './routes/auth.js';
import sendEmailRoute from './routes/send-email.js';
import kbQuizRoutes from './routes/kb-quiz.js';

// Background Processors
import WelcomeEmailProcessor from './services/WelcomeEmailProcessor.js';

// 1. Load environment variables FIRST
dotenv.config();

console.log('\n🚀 Starting Educational Platform Backend Server...\n');

// 2. Define paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PATH = path.join(__dirname, '../../dist');

// 3. Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// 4. Robust CORS & Preflight (To fix Render domain-specific issues definitively)
const ALLOWED_ORIGINS = [
  "https://aiprep365.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:3000",
  "http://localhost:3001"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || 
        ALLOWED_ORIGINS.indexOf(origin) !== -1 || 
        origin.includes('firebaseapp.com') || 
        origin.includes('web.app') || 
        origin.includes('aiprep365.com')) {
      callback(null, true);
    } else {
      console.warn(`⚠️ Blocked CORS request from unknown origin: ${origin}`);
      callback(null, false); // Return false instead of throwing an Error to prevent 500 crashes
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  credentials: true,
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization", "X-Content-Range", "Content-Range"]
}));

// Robust Preflight Fix
app.options("*", cors());

// Force headers for specific problematic clients if needed
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.includes('firebaseapp.com') || origin.includes('web.app'))) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Content-Range, Content-Range");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Credentials", "true");
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(compression());

// 5. Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 6. Request logging & Auth Middleware
app.use(async (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  try {
    const user = await getUserFromRequest(req);
    if (user) req.user = user;
  } catch (error) {
    console.warn(`[${timestamp}] Auth middleware warning:`, error.message);
  }
  next();
});

// 7. Static File Serving (Vite Build)
app.use(express.static(DIST_PATH));

// 8. API Routes
app.get('/api/health', (req, res) => {
  try {
    res.status(200).json({
      status: 'ok',
      message: 'Server is active',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});

app.use('/api/ai', aiRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/tutor', tutorRoutes);
app.use('/api/enrollment', enrollmentRoutes);
app.use('/api/invitations', invitationsRoutes);
app.use('/api/grading', gradingRoutes);
app.use('/api/admin', adminGroupsRoutes);
app.use('/api/admin', adminNotificationRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/send-email', sendEmailRoute);
app.use('/api/kb-quiz', kbQuizRoutes);

// 9. Root API Info
app.get('/api', (req, res) => {
  res.json({
    message: 'Educational Platform API',
    status: 'running',
    version: '2.0.0'
  });
});

// 10. Catch-all for SPA Routing (MUST BE AFTER API ROUTES)
app.get('*', (req, res) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(DIST_PATH, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('💥 Server Error:', err);

  const origin = req.headers.origin;
  if (origin) {
    res.header("Access-Control-Allow-Origin", origin);
  } else {
    res.header("Access-Control-Allow-Origin", "https://aiprep365.com");
  }
  
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Content-Range, Content-Range");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Credentials", "true");

  res.status(500).json({ 
    message: 'Internal Server Error',
    error: err.message 
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 SERVER SUCCESSFULLY STARTED');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 API: http://localhost:${PORT}/api`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    notificationMiddleware.initializeScheduler();
    console.log('🔔 Notification scheduler initialized');
  } catch (error) {
    console.error('❌ Notification scheduler failed:', error.message);
  }
  
  try {
    const welcomeEmailProcessor = new WelcomeEmailProcessor();
    welcomeEmailProcessor.start();
    console.log('📧 Welcome email queue processor started');
  } catch (error) {
    console.error('❌ Welcome email processor failed:', error.message);
  }
});