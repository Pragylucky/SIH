const mongoose = require('mongoose');

const getMongoUri = () => {
  // Support common managed env var names used by Railway/Render/Atlas
  const managedVars = [
    'MONGODB_URI',
    'MONGODB_URL',
    'MONGO_URI',
    'MONGO_URL',
    'DATABASE_URL'
  ];
  for (const key of managedVars) {
    if (process.env[key] && process.env[key].trim().length > 0) return process.env[key];
  }
  return 'mongodb://localhost:27017/smart_traffic_management';
};

const connectDB = async () => {
  try {
    const mongoUri = getMongoUri();
    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // KeepAlive helps prevent idle disconnects on hosted platforms
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });

    console.log(`🗄️  MongoDB Connected: ${conn.connection.host}`);

    // Connection event listeners
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('Database connection failed:', error.message);
    // Do not crash immediately on production boot when DB is not ready.
    if (process.env.NODE_ENV === 'production') {
      console.error('Continuing startup; routes should handle DB unavailability gracefully.');
    } else {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
