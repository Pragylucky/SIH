const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/env');
const User = require('../models/User');
const TrafficData = require('../models/TrafficData');
const Incident = require('../models/Incident');

// Store connected users and their rooms
const connectedUsers = new Map();
const userRooms = new Map();

// Socket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      return next(new Error('Authentication error: Invalid or inactive user'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
};

// Room management
const joinRoom = (socket, room) => {
  socket.join(room);
  
  // Track user rooms
  if (!userRooms.has(socket.userId)) {
    userRooms.set(socket.userId, new Set());
  }
  userRooms.get(socket.userId).add(room);
  
  console.log(`User ${socket.user.username} joined room: ${room}`);
};

const leaveRoom = (socket, room) => {
  socket.leave(room);
  
  // Remove from user rooms tracking
  if (userRooms.has(socket.userId)) {
    userRooms.get(socket.userId).delete(room);
    if (userRooms.get(socket.userId).size === 0) {
      userRooms.delete(socket.userId);
    }
  }
  
  console.log(`User ${socket.user.username} left room: ${room}`);
};

// Broadcast traffic data updates
const broadcastTrafficUpdate = (io, trafficData) => {
  // Broadcast to all users in the specific zone
  io.to(`zone:${trafficData.zone}`).emit('traffic_update', {
    type: 'traffic_data',
    data: trafficData,
    timestamp: new Date()
  });
  
  // Broadcast to all users in the specific intersection
  io.to(`intersection:${trafficData.intersectionId}`).emit('traffic_update', {
    type: 'traffic_data',
    data: trafficData,
    timestamp: new Date()
  });
  
  // Broadcast to operations center
  io.to('operations_center').emit('traffic_update', {
    type: 'traffic_data',
    data: trafficData,
    timestamp: new Date()
  });
};

// Broadcast incident updates
const broadcastIncidentUpdate = (io, incident) => {
  // Broadcast to all users
  io.emit('incident_update', {
    type: 'incident_update',
    data: incident,
    timestamp: new Date()
  });
  
  // Broadcast to emergency response team
  if (incident.severity === 'high' || incident.severity === 'critical') {
    io.to('emergency_team').emit('emergency_alert', {
      type: 'emergency_incident',
      data: incident,
      timestamp: new Date(),
      priority: 'high'
    });
  }
  
  // Broadcast to specific zone
  if (incident.location.zone) {
    io.to(`zone:${incident.location.zone}`).emit('incident_update', {
      type: 'incident_update',
      data: incident,
      timestamp: new Date()
    });
  }
};

// Broadcast system alerts
const broadcastSystemAlert = (io, alert) => {
  io.emit('system_alert', {
    type: 'system_alert',
    data: alert,
    timestamp: new Date()
  });
};

// Main socket handler
const socketHandler = (io) => {
  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.username} (${socket.user.role}) connected with socket ID: ${socket.id}`);
    
    // Store connected user
    connectedUsers.set(socket.userId, {
      socketId: socket.id,
      user: socket.user,
      connectedAt: new Date(),
      rooms: new Set()
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Smart Traffic Management System',
      user: {
        id: socket.user._id,
        username: socket.user.username,
        role: socket.user.role,
        department: socket.user.department
      },
      timestamp: new Date()
    });

    // Join default rooms based on user role
    joinRoom(socket, 'general');
    
    if (socket.user.role === 'admin' || socket.user.role === 'operator') {
      joinRoom(socket, 'operations_center');
    }
    
    if (socket.user.role === 'admin' || socket.user.role === 'analyst') {
      joinRoom(socket, 'analytics_center');
    }
    
    if (socket.user.department === 'emergency' || socket.user.role === 'admin') {
      joinRoom(socket, 'emergency_team');
    }

    // Handle joining specific rooms
    socket.on('join_room', (data) => {
      const { room } = data;
      
      if (room.startsWith('zone:')) {
        const zone = room.split(':')[1];
        if (['Central', 'North', 'South', 'East', 'West'].includes(zone)) {
          joinRoom(socket, room);
          socket.emit('room_joined', { room, message: `Joined ${zone} zone room` });
        }
      } else if (room.startsWith('intersection:')) {
        const intersectionId = room.split(':')[1];
        joinRoom(socket, room);
        socket.emit('room_joined', { room, message: `Joined intersection ${intersectionId} room` });
      } else if (['operations_center', 'analytics_center', 'emergency_team', 'general'].includes(room)) {
        joinRoom(socket, room);
        socket.emit('room_joined', { room, message: `Joined ${room}` });
      }
    });

    // Handle leaving rooms
    socket.on('leave_room', (data) => {
      const { room } = data;
      leaveRoom(socket, room);
      socket.emit('room_left', { room, message: `Left ${room}` });
    });

    // Handle traffic data requests
    socket.on('request_traffic_data', async (data) => {
      try {
        const { zone, intersectionId, timeRange = 1 } = data;
        
        let filter = { isActive: true };
        if (zone) filter.zone = zone;
        if (intersectionId) filter.intersectionId = intersectionId;
        
        const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);
        filter.timestamp = { $gte: startTime };

        const trafficData = await TrafficData.find(filter)
          .sort({ timestamp: -1 })
          .limit(50);

        socket.emit('traffic_data_response', {
          type: 'traffic_data',
          data: trafficData,
          requestId: data.requestId,
          timestamp: new Date()
        });
      } catch (error) {
        socket.emit('error', {
          message: 'Failed to fetch traffic data',
          error: error.message
        });
      }
    });

    // Handle incident data requests
    socket.on('request_incident_data', async (data) => {
      try {
        const { status, severity, zone } = data;
        
        let filter = {};
        if (status) filter.status = status;
        if (severity) filter.severity = severity;
        if (zone) filter['location.zone'] = zone;

        const incidents = await Incident.find(filter)
          .populate('reportedBy assignedTo', 'username profile.firstName profile.lastName role')
          .sort({ createdAt: -1 })
          .limit(20);

        socket.emit('incident_data_response', {
          type: 'incident_data',
          data: incidents,
          requestId: data.requestId,
          timestamp: new Date()
        });
      } catch (error) {
        socket.emit('error', {
          message: 'Failed to fetch incident data',
          error: error.message
        });
      }
    });

    // Handle real-time traffic control commands
    socket.on('traffic_control_command', (data) => {
      // Only operators and admins can send traffic control commands
      if (socket.user.role !== 'admin' && socket.user.role !== 'operator') {
        socket.emit('error', {
          message: 'Insufficient permissions for traffic control commands'
        });
        return;
      }

      const { command, intersectionId, parameters } = data;
      
      // Broadcast command to relevant intersections
      if (intersectionId) {
        io.to(`intersection:${intersectionId}`).emit('traffic_control_command', {
          command,
          intersectionId,
          parameters,
          issuedBy: socket.user.username,
          timestamp: new Date()
        });
      } else {
        // Broadcast to all intersections
        io.to('operations_center').emit('traffic_control_command', {
          command,
          parameters,
          issuedBy: socket.user.username,
          timestamp: new Date()
        });
      }
    });

    // Handle emergency alerts
    socket.on('emergency_alert', (data) => {
      // Only emergency team and admins can send emergency alerts
      if (socket.user.department !== 'emergency' && socket.user.role !== 'admin') {
        socket.emit('error', {
          message: 'Insufficient permissions for emergency alerts'
        });
        return;
      }

      const { alertType, message, priority = 'medium', affectedZones = [] } = data;
      
      // Broadcast emergency alert
      io.to('emergency_team').emit('emergency_alert', {
        type: 'emergency_alert',
        alertType,
        message,
        priority,
        affectedZones,
        issuedBy: socket.user.username,
        timestamp: new Date()
      });

      // Also broadcast to affected zones
      affectedZones.forEach(zone => {
        io.to(`zone:${zone}`).emit('emergency_alert', {
          type: 'emergency_alert',
          alertType,
          message,
          priority,
          issuedBy: socket.user.username,
          timestamp: new Date()
        });
      });
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`User ${socket.user.username} disconnected: ${reason}`);
      
      // Remove from connected users
      connectedUsers.delete(socket.userId);
      
      // Clean up user rooms
      if (userRooms.has(socket.userId)) {
        userRooms.delete(socket.userId);
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.user.username}:`, error);
    });
  });

  // Periodic data broadcasting
  setInterval(async () => {
    try {
      // Broadcast latest traffic data every 30 seconds
      const latestTrafficData = await TrafficData.getLatestData();
      
      io.to('operations_center').emit('traffic_broadcast', {
        type: 'traffic_broadcast',
        data: latestTrafficData,
        timestamp: new Date()
      });

      // Broadcast active incidents every minute
      const activeIncidents = await Incident.getActiveIncidents();
      
      io.to('emergency_team').emit('incident_broadcast', {
        type: 'incident_broadcast',
        data: activeIncidents,
        timestamp: new Date()
      });

      // Broadcast system health every 5 minutes
      const systemHealth = {
        connectedUsers: connectedUsers.size,
        activeIncidents: activeIncidents.length,
        systemUptime: 99.9, // Mock data
        lastHealthCheck: new Date()
      };

      io.emit('system_health', {
        type: 'system_health',
        data: systemHealth,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error in periodic broadcasting:', error);
    }
  }, 30000); // 30 seconds

  // Return functions for external use
  return {
    broadcastTrafficUpdate: (trafficData) => broadcastTrafficUpdate(io, trafficData),
    broadcastIncidentUpdate: (incident) => broadcastIncidentUpdate(io, incident),
    broadcastSystemAlert: (alert) => broadcastSystemAlert(io, alert),
    getConnectedUsers: () => Array.from(connectedUsers.values()),
    getConnectedUsersCount: () => connectedUsers.size
  };
};

module.exports = socketHandler;
