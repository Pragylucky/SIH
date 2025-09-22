# Smart Traffic Management System - Complete Setup Guide

This guide will help you set up the complete Smart Traffic Management System with both frontend and backend components.

## 🏗️ System Architecture

```
Smart Traffic Management System
├── Frontend (SIH/)
│   ├── HTML Dashboard Pages
│   ├── Tailwind CSS Styling
│   └── JavaScript Integration
└── Backend (backend/)
    ├── Node.js/Express API
    ├── MongoDB Database
    ├── WebSocket Real-time Updates
    └── JWT Authentication
```

## 📋 Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (v14.x or higher) - [Download here](https://nodejs.org/)
- **MongoDB** (v4.4 or higher) - [Download here](https://www.mongodb.com/try/download/community)
- **Git** - [Download here](https://git-scm.com/)

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Navigate to your project directory
cd "C:\Users\Rupinder Kaur\Downloads\Sih folder\Smart-traffic-management-1"

# The project structure should already be in place
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
copy config.env.example .env

# Edit .env file with your configuration (optional - defaults work for local development)
# PORT=5000
# MONGODB_URI=mongodb://localhost:27017/smart_traffic_management
# JWT_SECRET=your_super_secret_jwt_key_here

# Start MongoDB (make sure MongoDB service is running)
# On Windows: Start MongoDB service from Services
# On macOS: brew services start mongodb-community
# On Linux: sudo systemctl start mongod

# Seed the database with sample data
npm run seed

# Start the backend server
npm run dev
```

The backend will start on `http://localhost:5000`

### 3. Frontend Setup

```bash
# Navigate to frontend directory (in a new terminal)
cd SIH

# Install dependencies
npm install

# Build CSS (if needed)
npm run build:css

# Start CSS watcher for development
npm run dev
```

The frontend will be available at `http://localhost:5500` (if using Live Server) or open `index.html` directly.

## 🔧 Detailed Configuration

### Backend Configuration

#### Environment Variables (.env)
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/smart_traffic_management

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_EXPIRE=7d

# API Configuration
API_VERSION=v1
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# WebSocket Configuration
WEBSOCKET_PORT=5001

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

#### Database Seeding
The seeding script creates:
- 5 sample users with different roles
- 20 intersections across 5 zones
- 7 days of realistic traffic data
- Sample incidents and analytics reports

### Frontend Integration

#### Adding Backend Integration to Frontend

1. **Include the integration script** in your HTML files:
```html
<script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
<script src="../backend/integration/frontend-integration.js"></script>
```

2. **Initialize the API client**:
```javascript
// Initialize API client
const api = new TrafficAPI('http://localhost:5000/api/v1');

// Initialize WebSocket connection
const ws = new TrafficWebSocket('http://localhost:5000');
ws.connect();

// Login example
async function login() {
  try {
    const response = await api.login('admin@traffic.com', 'Admin123!');
    console.log('Login successful:', response.data.user);
  } catch (error) {
    console.error('Login failed:', error.message);
  }
}
```

3. **Fetch and display data**:
```javascript
// Fetch dashboard data
async function loadDashboard() {
  try {
    const overview = await api.getDashboardOverview();
    const operations = await api.getOperationsData();
    
    // Update your dashboard with the data
    updateDashboard(overview.data.overview, operations.data.operations);
  } catch (error) {
    console.error('Failed to load dashboard:', error);
  }
}

// Real-time updates
ws.on('traffic_update', (data) => {
  console.log('Traffic update received:', data);
  // Update your UI with new traffic data
});

ws.on('incident_update', (data) => {
  console.log('Incident update received:', data);
  // Update your UI with new incident data
});
```

## 🔐 Default Login Credentials

After seeding the database, you can use these credentials:

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| Admin | admin@traffic.com | Admin123! | Full system access |
| Operator | operator1@traffic.com | Operator123! | Traffic operations |
| Analyst | analyst1@traffic.com | Analyst123! | Analytics and reports |
| Emergency | emergency1@traffic.com | Emergency123! | Emergency management |
| Viewer | viewer1@traffic.com | Viewer123! | Read-only access |

## 📊 API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/me` - Get current user

### Traffic Data
- `GET /api/v1/traffic/latest` - Latest traffic data
- `GET /api/v1/traffic/stats` - Traffic statistics
- `GET /api/v1/traffic/zone/:zone` - Zone-specific data

### Incidents
- `GET /api/v1/incidents/active` - Active incidents
- `POST /api/v1/incidents` - Report incident
- `PUT /api/v1/incidents/:id/resolve` - Resolve incident

### Dashboard
- `GET /api/v1/dashboard/overview` - Dashboard overview
- `GET /api/v1/dashboard/operations` - Operations center
- `GET /api/v1/dashboard/analytics` - Analytics dashboard
- `GET /api/v1/dashboard/executive` - Executive dashboard
- `GET /api/v1/dashboard/emergency` - Emergency dashboard

## 🌐 WebSocket Events

### Real-time Updates
- `traffic_update` - Traffic data changes
- `incident_update` - Incident status changes
- `emergency_alert` - Emergency notifications
- `system_alert` - System-wide alerts

### Commands
- `join_room` - Join specific room (zone, intersection)
- `request_traffic_data` - Request traffic data
- `traffic_control_command` - Send control commands

## 🧪 Testing the System

### 1. Backend Health Check
```bash
curl http://localhost:5000/health
```

### 2. API Authentication Test
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@traffic.com","password":"Admin123!"}'
```

### 3. Traffic Data Test
```bash
curl http://localhost:5000/api/v1/traffic/latest
```

### 4. WebSocket Test
Open browser console and run:
```javascript
const ws = new TrafficWebSocket('http://localhost:5000');
ws.connect();
ws.on('connected', () => console.log('WebSocket connected!'));
```

## 🚨 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check connection string in .env file
   - Verify MongoDB service is started

2. **Port Already in Use**
   - Change PORT in .env file
   - Kill existing processes on port 5000

3. **CORS Errors**
   - Check CORS configuration in server.js
   - Ensure frontend URL is in allowed origins

4. **Authentication Errors**
   - Verify JWT_SECRET is set
   - Check token expiration
   - Ensure user account is active

5. **WebSocket Connection Failed**
   - Check if WebSocket server is running
   - Verify authentication token
   - Check browser console for errors

### Logs and Debugging

- Backend logs: Check terminal where `npm run dev` is running
- Frontend logs: Check browser developer console
- Database logs: Check MongoDB logs
- WebSocket logs: Check browser Network tab

## 📈 Performance Optimization

### Backend
- Use MongoDB indexes for better query performance
- Implement caching for frequently accessed data
- Use connection pooling for database connections
- Monitor memory usage and optimize queries

### Frontend
- Implement data pagination for large datasets
- Use WebSocket for real-time updates instead of polling
- Cache API responses where appropriate
- Optimize image and asset loading

## 🔒 Security Considerations

### Production Deployment
- Change default JWT secret
- Use HTTPS for all communications
- Implement proper CORS policies
- Set up rate limiting
- Use environment-specific configurations
- Implement proper error handling
- Set up monitoring and logging

### Database Security
- Use authentication for MongoDB
- Implement proper backup strategies
- Use connection encryption
- Regular security updates

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [JWT Documentation](https://jwt.io/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 🆘 Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Review the logs for error messages
3. Ensure all prerequisites are installed
4. Verify configuration files are correct
5. Check network connectivity and firewall settings

---

**Smart Traffic Management System** - Complete setup guide for intelligent traffic monitoring and management.
