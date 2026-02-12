import express from 'express';
import cors from 'cors';
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
import authDebugRoutes from './routes/auth-debug.js';

// 1. Load environment variables FIRST
dotenv.config();

console.log('\n🚀 Starting Educational Platform Backend Server...\n');

// 2. Define paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 3. Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

console.log('⚙️ Server Configuration:');
console.log(`  - Port: ${PORT}`);
console.log(`  - Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`  - OpenAI Key: ${process.env.OPENAI_API_KEY ? '✅ Present' : '❌ Missing'}`);
console.log('');

// 4. CRITICAL: CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://aitutor-4431c.web.app',
  'https://aitutor-4431c.firebaseapp.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
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

console.log('✅ CORS configured for production and local development');

// 5. Body parsing with increased limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

console.log('✅ Body parsing configured (50MB limit)');

// 6. Request logging & Auth Middleware
app.use(async (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);

  try {
    const user = await getUserFromRequest(req);
    if (user) {
      req.user = user;
    }
  } catch (error) {
    console.warn(`[${timestamp}] Auth middleware warning:`, error.message);
  }

  next();
});

// 7. Root test route
app.get('/', (req, res) => {
  res.json({
    message: 'Educational Platform Backend',
    status: 'running',
    version: '2.0.0',
    endpoints: {
      health: '/api/health',
      debug: '/api/debug/routes',
      ai: '/api/ai/*',
      upload: '/api/upload',
      payment: '/api/payment/*'
    }
  });
});

// 8. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is active',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 🟢 Debug: Verify Env Vars (Redacted)
app.get('/api/debug/env', (req, res) => {
  const redact = (str) => {
    if (!str) return '❌ MISSING';
    if (str.length < 8) return '✅ PRESENT (Short)';
    return `✅ ${str.substring(0, 4)}...${str.substring(str.length - 4)}`;
  };

  res.json({
    OPENAI_API_KEY: redact(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY),
    SUPABASE_URL: redact(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    SUPABASE_KEY: redact(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env['anon-public']),
    SUPABASE_SERVICE_KEY: redact(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || process.env['service_role']),
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT
  });
});

console.log('✅ Core routes registered\n');


console.log('🔗 Mounting Feature Routes...');

app.use('/api/ai', aiRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/tutor', tutorRoutes);
app.use('/api/enrollment', enrollmentRoutes);
app.use('/api/invitations', invitationsRoutes);
app.use('/api/grading', gradingRoutes);
app.use('/api/admin', adminGroupsRoutes);
app.use('/api/auth-debug', authDebugRoutes);

console.log('✅ All routes mounted successfully');

console.log('');

// 10. Debug routes endpoint
app.get('/api/debug/routes', (req, res) => {
  const routes = [];

  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const basePath = middleware.regexp.source
            .replace('\\/?', '')
            .replace('(?=\\/|$)', '')
            .replace(/\\\//g, '/');
          routes.push({
            path: basePath + handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });

  res.json({
    message: 'Registered API Routes',
    status: 'all_mounted_statically',
    routes,
    totalRoutes: routes.length
  });
});

// 11. 404 Handler
app.use('/api/*', (req, res) => {
  console.warn(`⚠️ 404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: `API endpoint not found: ${req.originalUrl}`,
    method: req.method,
    hint: 'Visit /api/debug/routes to see all registered routes'
  });
});

// 12. Global error handler
app.use((err, req, res, next) => {
  console.error('💥 Server Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    path: req.path
  });
});

// 13. Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 SERVER SUCCESSFULLY STARTED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📡 Server Address: http://0.0.0.0:' + PORT);
  console.log('🌐 API Base URL: http://localhost:' + PORT + '/api');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});