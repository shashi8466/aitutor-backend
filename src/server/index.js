import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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
app.use(cors({
  origin: true,  // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

console.log('✅ CORS enabled for all origins');

// 5. Body parsing with increased limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

console.log('✅ Body parsing configured (50MB limit)');

// 6. Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
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

console.log('✅ Core routes registered\n');

// 9. Load feature routes
console.log('🔗 Loading Feature Routes...\n');

let routesLoaded = {
  ai: false,
  upload: false,
  payment: false
};

// AI Routes
try {
  const aiModule = await import('./routes/ai.js');
  app.use('/api/ai', aiModule.default);
  routesLoaded.ai = true;
  console.log('✅ AI Routes mounted at /api/ai');
} catch (error) {
  console.error('❌ Failed to load AI Routes:', error.message);
  app.use('/api/ai', (req, res) => {
    res.status(503).json({
      error: 'AI service unavailable',
      details: error.message
    });
  });
}

// Upload Routes
try {
  const uploadModule = await import('./routes/upload.js');
  app.use('/api/upload', uploadModule.default);
  routesLoaded.upload = true;
  console.log('✅ Upload Routes mounted at /api/upload');
} catch (error) {
  console.error('❌ Failed to load Upload Routes:', error.message);
  app.use('/api/upload', (req, res) => {
    res.status(503).json({
      error: 'Upload service unavailable',
      details: error.message
    });
  });
}

// Payment Routes
try {
  const paymentModule = await import('./routes/payment.js');
  app.use('/api/payment', paymentModule.default);
  routesLoaded.payment = true;
  console.log('✅ Payment Routes mounted at /api/payment');
} catch (error) {
  console.error('❌ Failed to load Payment Routes:', error.message);
  app.use('/api/payment', (req, res) => {
    res.status(503).json({
      error: 'Payment service unavailable',
      details: error.message
    });
  });
}

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
    routesLoaded,
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
  console.log('📊 Service Status:');
  console.log(`  - AI Routes: ${routesLoaded.ai ? '✅' : '❌'}`);
  console.log(`  - Upload Routes: ${routesLoaded.upload ? '✅' : '❌'}`);
  console.log(`  - Payment Routes: ${routesLoaded.payment ? '✅' : '❌'}`);
  console.log('');
  console.log('🔍 Debug Tools:');
  console.log(`  - Health Check: http://localhost:${PORT}/api/health`);
  console.log(`  - Route List: http://localhost:${PORT}/api/debug/routes`);
  console.log(`  - Upload Test: http://localhost:${PORT}/api/upload/test`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!routesLoaded.ai || !routesLoaded.upload) {
    console.error('⚠️⚠️⚠️ WARNING ⚠️⚠️⚠️');
    console.error('Some routes failed to load. Check errors above.');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
});