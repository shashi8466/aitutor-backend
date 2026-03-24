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

console.log('⚙️ Server Configuration:');
console.log(`  - Port: ${PORT}`);
console.log(`  - Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`  - OpenAI Key: ${process.env.OPENAI_API_KEY ? '✅ Present' : '❌ Missing'}`);
console.log('');

// 4. CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://aitutor-4431c.web.app',
  'https://aitutor-4431c.firebaseapp.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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
  res.json({
    status: 'ok',
    message: 'Server is active',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
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
  // If requesting something in /api that doesn't exist, don't serve index.html
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(DIST_PATH, 'index.html'));
});

// 11. Error handling
app.use((err, req, res, next) => {
  console.error('💥 Server Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 12. Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 SERVER SUCCESSFULLY STARTED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`🌐 API: http://localhost:${PORT}/api`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    notificationMiddleware.initializeScheduler();
    console.log('🔔 Notification scheduler initialized');
  } catch (error) {
    console.error('❌ Notification scheduler failed:', error.message);
  }
});