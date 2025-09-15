# Smart Traffic Management System - Backend API

A comprehensive Node.js/Express backend API for the Smart Traffic Management System, providing real-time traffic monitoring, incident management, analytics, and user management capabilities.

## 🚀 Features

- **Real-time Traffic Monitoring**: Live traffic data collection and broadcasting
- **Incident Management**: Complete incident reporting, tracking, and resolution system
- **Analytics Dashboard**: Advanced traffic analytics and reporting
- **User Management**: Role-based authentication and authorization
- **WebSocket Support**: Real-time updates and notifications
- **RESTful API**: Comprehensive REST API with proper error handling
- **Data Validation**: Input validation and sanitization
- **Rate Limiting**: API rate limiting for security
- **Database Integration**: MongoDB with Mongoose ODM

## 📋 Prerequisites

- Node.js (v14.x or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository and navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp config.env.example .env
   ```
   
   Edit the `.env` file with your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/smart_traffic_management
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRE=7d
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system.

5. **Seed the database (optional)**
   ```bash
   npm run seed
   ```

6. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 📁 Project Structure

```
backend/
├── config/
│   └── database.js          # Database connection configuration
├── middleware/
│   ├── auth.js              # Authentication middleware
│   ├── errorHandler.js      # Global error handling
│   └── rateLimiter.js       # Rate limiting middleware
├── models/
│   ├── User.js              # User model
│   ├── TrafficData.js       # Traffic data model
│   ├── Incident.js          # Incident model
│   └── Analytics.js         # Analytics model
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── traffic.js           # Traffic data routes
│   ├── incidents.js         # Incident management routes
│   ├── analytics.js         # Analytics routes
│   ├── users.js             # User management routes
│   └── dashboard.js         # Dashboard data routes
├── socket/
│   └── socketHandler.js     # WebSocket connection handling
├── scripts/
│   └── seedData.js          # Database seeding script
├── server.js                # Main server file
├── package.json             # Dependencies and scripts
└── README.md               # This file
```

## 🔌 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/me` - Get current user
- `PUT /api/v1/auth/profile` - Update user profile
- `PUT /api/v1/auth/change-password` - Change password

### Traffic Data
- `GET /api/v1/traffic` - Get traffic data with filtering
- `GET /api/v1/traffic/latest` - Get latest traffic data
- `GET /api/v1/traffic/intersection/:id` - Get intersection data
- `GET /api/v1/traffic/stats` - Get traffic statistics
- `GET /api/v1/traffic/zone/:zone` - Get zone traffic data
- `POST /api/v1/traffic` - Create traffic data (Operator/Admin)
- `PUT /api/v1/traffic/:id` - Update traffic data (Operator/Admin)
- `DELETE /api/v1/traffic/:id` - Delete traffic data (Admin)

### Incidents
- `GET /api/v1/incidents` - Get incidents with filtering
- `GET /api/v1/incidents/active` - Get active incidents
- `GET /api/v1/incidents/stats` - Get incident statistics
- `GET /api/v1/incidents/:id` - Get incident by ID
- `POST /api/v1/incidents` - Report new incident
- `PUT /api/v1/incidents/:id` - Update incident (Operator/Admin)
- `PUT /api/v1/incidents/:id/resolve` - Resolve incident (Operator/Admin)
- `DELETE /api/v1/incidents/:id` - Delete incident (Admin)

### Analytics
- `GET /api/v1/analytics` - Get analytics reports (Analyst/Admin)
- `GET /api/v1/analytics/summary` - Get analytics summary (Analyst/Admin)
- `POST /api/v1/analytics/traffic-flow` - Generate traffic flow analysis (Analyst/Admin)
- `GET /api/v1/analytics/:id` - Get specific report (Analyst/Admin)
- `PUT /api/v1/analytics/:id` - Update report (Analyst/Admin)
- `DELETE /api/v1/analytics/:id` - Delete report (Admin)

### Users
- `GET /api/v1/users` - Get all users (Admin)
- `GET /api/v1/users/:id` - Get user by ID (Admin/Owner)
- `POST /api/v1/users` - Create user (Admin)
- `PUT /api/v1/users/:id` - Update user (Admin/Owner)
- `PUT /api/v1/users/:id/activate` - Activate user (Admin)
- `PUT /api/v1/users/:id/deactivate` - Deactivate user (Admin)
- `DELETE /api/v1/users/:id` - Delete user (Admin)
- `GET /api/v1/users/stats/overview` - Get user statistics (Admin)

### Dashboard
- `GET /api/v1/dashboard/overview` - Get dashboard overview
- `GET /api/v1/dashboard/operations` - Get operations center data
- `GET /api/v1/dashboard/analytics` - Get analytics dashboard (Analyst/Admin)
- `GET /api/v1/dashboard/executive` - Get executive dashboard (Admin/Analyst)
- `GET /api/v1/dashboard/emergency` - Get emergency dashboard

## 🔐 Authentication & Authorization

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### User Roles
- **Admin**: Full system access
- **Operator**: Traffic operations and incident management
- **Analyst**: Analytics and reporting access
- **Viewer**: Read-only access

### Permissions
- **read**: View data
- **write**: Create and update data
- **delete**: Delete data
- **admin**: Administrative access

## 🌐 WebSocket Events

### Client to Server
- `join_room` - Join a specific room (zone, intersection, etc.)
- `leave_room` - Leave a room
- `request_traffic_data` - Request traffic data
- `request_incident_data` - Request incident data
- `traffic_control_command` - Send traffic control commands (Operator/Admin)
- `emergency_alert` - Send emergency alerts (Emergency team/Admin)
- `ping` - Health check

### Server to Client
- `connected` - Connection confirmation
- `traffic_update` - Real-time traffic data updates
- `incident_update` - Incident status updates
- `emergency_alert` - Emergency notifications
- `system_alert` - System-wide alerts
- `traffic_broadcast` - Periodic traffic data broadcast
- `incident_broadcast` - Periodic incident data broadcast
- `system_health` - System health status
- `pong` - Health check response

## 📊 Database Models

### User
- Authentication and profile information
- Role-based permissions
- User preferences and settings

### TrafficData
- Real-time traffic information
- Vehicle and pedestrian counts
- Traffic light status
- Congestion levels
- Weather conditions

### Incident
- Incident reporting and tracking
- Assignment and resolution
- Impact assessment
- Media attachments

### Analytics
- Generated reports and insights
- Performance metrics
- Recommendations
- Visualization data

## 🚀 Deployment

### Environment Variables
```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb://your-mongodb-connection-string
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d
API_VERSION=v1
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
WEBSOCKET_PORT=5001
FRONTEND_URL=https://your-frontend-domain.com
```

### Production Considerations
- Use a process manager like PM2
- Set up reverse proxy with Nginx
- Configure SSL/TLS certificates
- Set up monitoring and logging
- Use environment-specific configurations
- Implement database backups

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📝 API Documentation

The API follows RESTful conventions and returns JSON responses. All responses include:
- `status`: "success" or "error"
- `message`: Human-readable message
- `data`: Response data (on success)
- `errors`: Validation errors (on error)

### Example Response
```json
{
  "status": "success",
  "message": "Data retrieved successfully",
  "data": {
    "trafficData": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalCount": 100
    }
  }
}
```

## 🔧 Development

### Adding New Features
1. Create model in `models/` directory
2. Add routes in `routes/` directory
3. Update middleware if needed
4. Add WebSocket events if real-time updates required
5. Update documentation

### Code Style
- Use ESLint for code linting
- Follow JavaScript best practices
- Use async/await for asynchronous operations
- Implement proper error handling
- Add input validation

## 📞 Support

For support and questions:
- Check the API documentation
- Review error logs
- Contact the development team

## 📄 License

This project is licensed under the MIT License.

---

**Smart Traffic Management System** - Intelligent traffic monitoring and management solution.
