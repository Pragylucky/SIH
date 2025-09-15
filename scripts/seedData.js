const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const TrafficData = require('../models/TrafficData');
const Incident = require('../models/Incident');
const Analytics = require('../models/Analytics');

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_traffic_management');
    console.log('🗄️  MongoDB Connected for seeding');
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

// Sample intersections data
const intersections = [
  { id: 'INT-001', name: 'Main Street & Central Avenue', zone: 'Central', lat: 40.7128, lng: -74.0060 },
  { id: 'INT-002', name: 'Broadway & 42nd Street', zone: 'Central', lat: 40.7589, lng: -73.9851 },
  { id: 'INT-003', name: 'Park Avenue & 34th Street', zone: 'Central', lat: 40.7505, lng: -73.9934 },
  { id: 'INT-004', name: '5th Avenue & 23rd Street', zone: 'Central', lat: 40.7406, lng: -73.9903 },
  { id: 'INT-005', name: 'Lexington Avenue & 59th Street', zone: 'North', lat: 40.7614, lng: -73.9776 },
  { id: 'INT-006', name: 'Madison Avenue & 72nd Street', zone: 'North', lat: 40.7736, lng: -73.9566 },
  { id: 'INT-007', name: '3rd Avenue & 86th Street', zone: 'North', lat: 40.7794, lng: -73.9542 },
  { id: 'INT-008', name: '1st Avenue & 96th Street', zone: 'North', lat: 40.7855, lng: -73.9442 },
  { id: 'INT-009', name: 'Houston Street & Broadway', zone: 'South', lat: 40.7282, lng: -74.0076 },
  { id: 'INT-010', name: 'Canal Street & Lafayette', zone: 'South', lat: 40.7181, lng: -74.0021 },
  { id: 'INT-011', name: 'Delancey Street & Essex', zone: 'South', lat: 40.7183, lng: -73.9877 },
  { id: 'INT-012', name: 'Grand Street & Bowery', zone: 'South', lat: 40.7158, lng: -73.9969 },
  { id: 'INT-013', name: '14th Street & 1st Avenue', zone: 'East', lat: 40.7328, lng: -73.9857 },
  { id: 'INT-014', name: '23rd Street & 2nd Avenue', zone: 'East', lat: 40.7376, lng: -73.9781 },
  { id: 'INT-015', name: '34th Street & 3rd Avenue', zone: 'East', lat: 40.7489, lng: -73.9857 },
  { id: 'INT-016', name: '42nd Street & 1st Avenue', zone: 'East', lat: 40.7505, lng: -73.9708 },
  { id: 'INT-017', name: '8th Avenue & 14th Street', zone: 'West', lat: 40.7376, lng: -74.0004 },
  { id: 'INT-018', name: '9th Avenue & 23rd Street', zone: 'West', lat: 40.7489, lng: -73.9969 },
  { id: 'INT-019', name: '10th Avenue & 34th Street', zone: 'West', lat: 40.7505, lng: -73.9969 },
  { id: 'INT-020', name: '11th Avenue & 42nd Street', zone: 'West', lat: 40.7589, lng: -73.9969 }
];

// Sample users data
const users = [
  {
    username: 'admin',
    email: 'admin@traffic.com',
    password: 'Admin123!',
    role: 'admin',
    department: 'operations',
    profile: { firstName: 'System', lastName: 'Administrator' }
  },
  {
    username: 'operator1',
    email: 'operator1@traffic.com',
    password: 'Operator123!',
    role: 'operator',
    department: 'operations',
    profile: { firstName: 'John', lastName: 'Smith' }
  },
  {
    username: 'analyst1',
    email: 'analyst1@traffic.com',
    password: 'Analyst123!',
    role: 'analyst',
    department: 'analytics',
    profile: { firstName: 'Sarah', lastName: 'Johnson' }
  },
  {
    username: 'emergency1',
    email: 'emergency1@traffic.com',
    password: 'Emergency123!',
    role: 'operator',
    department: 'emergency',
    profile: { firstName: 'Mike', lastName: 'Davis' }
  },
  {
    username: 'viewer1',
    email: 'viewer1@traffic.com',
    password: 'Viewer123!',
    role: 'viewer',
    department: 'operations',
    profile: { firstName: 'Lisa', lastName: 'Wilson' }
  }
];

// Generate random traffic data
const generateTrafficData = (intersection, timestamp) => {
  const baseHour = timestamp.getHours();
  const isWeekend = timestamp.getDay() === 0 || timestamp.getDay() === 6;
  
  // Traffic patterns based on time of day
  let baseVolume = 50;
  if (baseHour >= 7 && baseHour <= 9) baseVolume = 120; // Morning rush
  else if (baseHour >= 17 && baseHour <= 19) baseVolume = 150; // Evening rush
  else if (baseHour >= 12 && baseHour <= 14) baseVolume = 80; // Lunch time
  else if (baseHour >= 22 || baseHour <= 6) baseVolume = 20; // Night time
  
  if (isWeekend) baseVolume *= 0.7; // Less traffic on weekends
  
  // Add randomness
  const randomFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
  const totalVehicles = Math.round(baseVolume * randomFactor);
  
  // Distribute vehicles across directions
  const north = Math.round(totalVehicles * (0.2 + Math.random() * 0.1));
  const south = Math.round(totalVehicles * (0.2 + Math.random() * 0.1));
  const east = Math.round(totalVehicles * (0.25 + Math.random() * 0.1));
  const west = Math.round(totalVehicles * (0.25 + Math.random() * 0.1));
  
  // Calculate average speed based on traffic volume
  let avgSpeed = 45;
  if (totalVehicles > 100) avgSpeed = 25;
  else if (totalVehicles > 80) avgSpeed = 35;
  else if (totalVehicles > 60) avgSpeed = 40;
  
  // Add some randomness to speed
  avgSpeed += (Math.random() - 0.5) * 10;
  avgSpeed = Math.max(5, Math.min(60, avgSpeed));
  
  // Determine congestion level
  let congestionLevel = 'low';
  if (totalVehicles > 120) congestionLevel = 'severe';
  else if (totalVehicles > 100) congestionLevel = 'high';
  else if (totalVehicles > 80) congestionLevel = 'medium';
  
  // Generate traffic light status
  const directions = ['north', 'south', 'east', 'west'];
  const trafficLights = directions.map(direction => {
    const statuses = ['red', 'yellow', 'green'];
    const weights = direction === 'north' ? [0.3, 0.1, 0.6] : [0.4, 0.1, 0.5]; // North gets more green time
    const random = Math.random();
    let status = 'red';
    if (random < weights[2]) status = 'green';
    else if (random < weights[2] + weights[1]) status = 'yellow';
    
    return {
      direction,
      status,
      timer: Math.floor(Math.random() * 30) + 10
    };
  });
  
  return {
    intersectionId: intersection.id,
    intersectionName: intersection.name,
    zone: intersection.zone,
    coordinates: {
      latitude: intersection.lat + (Math.random() - 0.5) * 0.001,
      longitude: intersection.lng + (Math.random() - 0.5) * 0.001
    },
    trafficLights,
    vehicleCount: { north, south, east, west },
    pedestrianCount: {
      north: Math.round(north * 0.1),
      south: Math.round(south * 0.1),
      east: Math.round(east * 0.1),
      west: Math.round(west * 0.1)
    },
    averageSpeed: Math.round(avgSpeed * 100) / 100,
    congestionLevel,
    weather: {
      condition: ['clear', 'cloudy', 'rainy', 'foggy'][Math.floor(Math.random() * 4)],
      temperature: 20 + Math.random() * 20,
      humidity: 40 + Math.random() * 40,
      visibility: 8 + Math.random() * 2
    },
    timestamp,
    isActive: true,
    metadata: {
      cameraId: `CAM-${intersection.id}`,
      sensorId: `SENSOR-${intersection.id}`,
      dataSource: 'sensor',
      confidence: 95 + Math.random() * 5
    }
  };
};

// Generate sample incidents
const generateIncidents = (users) => {
  const incidentTypes = ['accident', 'breakdown', 'road_closure', 'construction', 'signal_malfunction'];
  const severities = ['low', 'medium', 'high', 'critical'];
  const statuses = ['reported', 'confirmed', 'in_progress', 'resolved'];
  
  const incidents = [];
  const now = new Date();
  
  // Generate 20 incidents over the last 7 days
  for (let i = 0; i < 20; i++) {
    const incidentTime = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const intersection = intersections[Math.floor(Math.random() * intersections.length)];
    const type = incidentTypes[Math.floor(Math.random() * incidentTypes.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const reportedBy = users[Math.floor(Math.random() * users.length)];
    
    const incident = {
      type,
      severity,
      status,
      location: {
        intersectionId: intersection.id,
        intersectionName: intersection.name,
        zone: intersection.zone,
        coordinates: {
          latitude: intersection.lat + (Math.random() - 0.5) * 0.001,
          longitude: intersection.lng + (Math.random() - 0.5) * 0.001
        },
        address: `${intersection.name}, New York, NY`
      },
      description: `Sample ${type} incident at ${intersection.name}`,
      reportedBy: reportedBy._id,
      estimatedDuration: 30 + Math.random() * 120,
      affectedLanes: [
        {
          direction: ['north', 'south', 'east', 'west'][Math.floor(Math.random() * 4)],
          laneType: 'main',
          closureType: severity === 'critical' ? 'full' : 'partial'
        }
      ],
      impact: {
        trafficDelay: Math.floor(Math.random() * 60),
        vehiclesAffected: Math.floor(Math.random() * 200),
        alternativeRoutes: ['Route A', 'Route B']
      },
      priority: Math.floor(Math.random() * 10) + 1,
      tags: [type, intersection.zone.toLowerCase()],
      isPublic: Math.random() > 0.5
    };
    
    // Add resolution data if status is resolved
    if (status === 'resolved') {
      const resolvedTime = new Date(incidentTime.getTime() + Math.random() * 4 * 60 * 60 * 1000);
      incident.actualDuration = Math.floor((resolvedTime - incidentTime) / (1000 * 60));
      incident.resolution = {
        resolvedAt: resolvedTime,
        resolvedBy: users[Math.floor(Math.random() * users.length)]._id,
        resolutionNotes: `Incident resolved successfully`,
        lessonsLearned: `Improved response time for ${type} incidents`
      };
    }
    
    incidents.push(incident);
  }
  
  return incidents;
};

// Main seeding function
const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Clear existing data
    await User.deleteMany({});
    await TrafficData.deleteMany({});
    await Incident.deleteMany({});
    await Analytics.deleteMany({});
    console.log('🗑️  Cleared existing data');
    
    // Create users
    console.log('👥 Creating users...');
    const createdUsers = [];
    for (const userData of users) {
      const user = await User.create(userData);
      createdUsers.push(user);
    }
    console.log(`✅ Created ${createdUsers.length} users`);
    
    // Create traffic data for the last 7 days
    console.log('🚦 Creating traffic data...');
    const trafficDataEntries = [];
    const now = new Date();
    
    // Generate data for each hour for the last 7 days
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const timestamp = new Date(now.getTime() - (day * 24 + (23 - hour)) * 60 * 60 * 1000);
        
        for (const intersection of intersections) {
          const trafficData = generateTrafficData(intersection, timestamp);
          trafficDataEntries.push(trafficData);
        }
      }
    }
    
    // Insert traffic data in batches
    const batchSize = 100;
    for (let i = 0; i < trafficDataEntries.length; i += batchSize) {
      const batch = trafficDataEntries.slice(i, i + batchSize);
      await TrafficData.insertMany(batch);
    }
    console.log(`✅ Created ${trafficDataEntries.length} traffic data entries`);
    
    // Create incidents
    console.log('🚨 Creating incidents...');
    const incidents = generateIncidents(createdUsers);
    await Incident.insertMany(incidents);
    console.log(`✅ Created ${incidents.length} incidents`);
    
    // Create sample analytics reports
    console.log('📊 Creating analytics reports...');
    const analyticsReports = [
      {
        reportType: 'traffic_flow',
        title: 'Weekly Traffic Flow Analysis',
        description: 'Comprehensive analysis of traffic flow patterns for the past week',
        timeRange: {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now
        },
        scope: { includeAll: true },
        generatedBy: createdUsers.find(u => u.role === 'analyst')._id,
        status: 'completed',
        metrics: {
          trafficVolume: {
            total: 150000,
            average: 7500,
            peak: 12000,
            trend: 'increasing'
          },
          congestion: {
            averageLevel: 35,
            peakLevel: 75,
            duration: 120,
            affectedIntersections: 8
          },
          speed: {
            average: 32.5,
            minimum: 15,
            maximum: 55,
            standardDeviation: 8.2
          }
        },
        insights: [
          {
            type: 'trend',
            title: 'Peak Hour Analysis',
            description: 'Traffic volume increased by 15% during morning rush hours',
            impact: 'medium',
            confidence: 95
          }
        ],
        recommendations: [
          {
            category: 'signal_timing',
            priority: 'high',
            title: 'Optimize Signal Timing',
            description: 'Adjust signal timing for Main Street intersections',
            expectedImpact: 'Reduce congestion by 20%',
            implementationCost: 'medium',
            timeline: '2-3 weeks'
          }
        ],
        isPublic: true,
        tags: ['weekly', 'traffic-flow', 'optimization']
      }
    ];
    
    await Analytics.insertMany(analyticsReports);
    console.log(`✅ Created ${analyticsReports.length} analytics reports`);
    
    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`- Users: ${createdUsers.length}`);
    console.log(`- Traffic Data Entries: ${trafficDataEntries.length}`);
    console.log(`- Incidents: ${incidents.length}`);
    console.log(`- Analytics Reports: ${analyticsReports.length}`);
    console.log('\n🔑 Default Login Credentials:');
    console.log('Admin: admin@traffic.com / Admin123!');
    console.log('Operator: operator1@traffic.com / Operator123!');
    console.log('Analyst: analyst1@traffic.com / Analyst123!');
    console.log('Emergency: emergency1@traffic.com / Emergency123!');
    console.log('Viewer: viewer1@traffic.com / Viewer123!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run seeding
connectDB().then(() => {
  seedDatabase();
});
