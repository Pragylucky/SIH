const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const trafficRoutes = require('./routes/traffic');
const analyticsRoutes = require('./routes/analytics');
const incidentRoutes = require('./routes/incidents');
const userRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');

// Import WebSocket handlers
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const allowedOrigins = (() => {
  if (process.env.NODE_ENV === 'production') {
    const raw = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '';
    const list = raw
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
    if (list.length === 0) {
      return process.env.ALLOW_ANY_ORIGIN === 'true' ? '*' : [];
    }
    return list;
  }
  return ["http://localhost:3000", "http://127.0.0.1:5500", "http://localhost:5500"];
})();

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: Array.isArray(allowedOrigins) && allowedOrigins.length > 0
  }
});

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  credentials: Array.isArray(allowedOrigins) && allowedOrigins.length > 0
}));

// Rate limiting
app.use(generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
// Static files
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Smart Traffic Management API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API routes
const API_VERSION = process.env.API_VERSION || 'v1';
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/traffic`, trafficRoutes);
app.use(`/api/${API_VERSION}/analytics`, analyticsRoutes);
app.use(`/api/${API_VERSION}/incidents`, incidentRoutes);
app.use(`/api/${API_VERSION}/users`, userRoutes);
app.use(`/api/${API_VERSION}/dashboard`, dashboardRoutes);
// WebSocket connection handling
socketHandler(io);
// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚦 Smart Traffic Management Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api/${API_VERSION}`);
  console.log(`🌐 WebSocket Server: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;


