const express = require('express');
const { query, validationResult } = require('express-validator');
const TrafficData = require('../models/TrafficData');
const Incident = require('../models/Incident');
const Analytics = require('../models/Analytics');
const User = require('../models/User');
const { protect, optionalAuth } = require('../middleware/auth');
const { publicLimiter, generalLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// @desc    Get dashboard overview data
// @route   GET /api/v1/dashboard/overview
// @access  Public (with optional auth for enhanced data)
router.get('/overview', publicLimiter, optionalAuth, [
  query('timeRange')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('Time range must be between 1 and 168 hours')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { timeRange = 24 } = req.query;
    const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);

    // Get traffic statistics
    const trafficStats = await TrafficData.getTrafficStats(parseInt(timeRange));
    
    // Get incident statistics
    const incidentStats = await Incident.getIncidentStats(parseInt(timeRange));
    
    // Get latest traffic data
    const latestTrafficData = await TrafficData.getLatestData();
    
    // Get active incidents
    const activeIncidents = await Incident.getActiveIncidents();

    // Get system health metrics
    const systemHealth = {
      totalIntersections: latestTrafficData.length,
      activeIntersections: latestTrafficData.filter(data => data.isActive).length,
      signalMalfunctions: activeIncidents.filter(incident => incident.type === 'signal_malfunction').length,
      averageResponseTime: 0, // Would be calculated from incident data
      systemUptime: 99.9 // Mock data
    };

    res.json({
      status: 'success',
      data: {
        overview: {
          traffic: trafficStats[0] || {
            totalVehicles: 0,
            totalPedestrians: 0,
            avgSpeed: 0,
            totalIntersections: 0,
            congestionDistribution: {
              low: 0,
              medium: 0,
              high: 0,
              severe: 0
            }
          },
          incidents: incidentStats[0] || {
            totalIncidents: 0,
            avgResolutionTime: 0,
            typeDistribution: {
              accident: 0,
              breakdown: 0,
              road_closure: 0,
              construction: 0,
              other: 0
            },
            severityDistribution: {
              low: 0,
              medium: 0,
              high: 0,
              critical: 0
            },
            statusDistribution: {
              reported: 0,
              confirmed: 0,
              in_progress: 0,
              resolved: 0
            }
          },
          systemHealth,
          latestTrafficData: latestTrafficData.slice(0, 10), // Latest 10 intersections
          activeIncidents: activeIncidents.slice(0, 5), // Latest 5 incidents
          timeRange: parseInt(timeRange),
          lastUpdated: new Date()
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching dashboard overview'
    });
  }
});

// @desc    Get real-time operations center data
// @route   GET /api/v1/dashboard/operations
// @access  Public
router.get('/operations', publicLimiter, async (req, res) => {
  try {
    const { zone } = req.query;

    // Get latest traffic data for all intersections or specific zone
    const filter = { isActive: true };
    if (zone && ['Central', 'North', 'South', 'East', 'West'].includes(zone)) {
      filter.zone = zone;
    }

    const latestTrafficData = await TrafficData.find(filter)
      .sort({ timestamp: -1 })
      .limit(50);

    // Group by intersection for latest data
    const intersectionData = {};
    latestTrafficData.forEach(data => {
      if (!intersectionData[data.intersectionId] || 
          data.timestamp > intersectionData[data.intersectionId].timestamp) {
        intersectionData[data.intersectionId] = data;
      }
    });

    const intersections = Object.values(intersectionData);

    // Get active incidents
    const activeIncidents = await Incident.getActiveIncidents();

    // Calculate zone statistics
    const zoneStats = {
      Central: { intersections: 0, congestion: 'low', incidents: 0 },
      North: { intersections: 0, congestion: 'low', incidents: 0 },
      South: { intersections: 0, congestion: 'low', incidents: 0 },
      East: { intersections: 0, congestion: 'low', incidents: 0 },
      West: { intersections: 0, congestion: 'low', incidents: 0 }
    };

    intersections.forEach(data => {
      zoneStats[data.zone].intersections++;
      if (data.congestionLevel === 'high' || data.congestionLevel === 'severe') {
        zoneStats[data.zone].congestion = 'high';
      } else if (data.congestionLevel === 'medium' && zoneStats[data.zone].congestion !== 'high') {
        zoneStats[data.zone].congestion = 'medium';
      }
    });

    activeIncidents.forEach(incident => {
      if (incident.location.zone && zoneStats[incident.location.zone]) {
        zoneStats[incident.location.zone].incidents++;
      }
    });

    res.json({
      status: 'success',
      data: {
        operations: {
          intersections,
          activeIncidents,
          zoneStats,
          totalIntersections: intersections.length,
          totalActiveIncidents: activeIncidents.length,
          lastUpdated: new Date()
        }
      }
    });
  } catch (error) {
    console.error('Get operations dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching operations dashboard data'
    });
  }
});

// @desc    Get analytics dashboard data
// @route   GET /api/v1/dashboard/analytics
// @access  Private (Analyst, Admin)
router.get('/analytics', protect, generalLimiter, [
  query('timeRange')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('Time range must be between 1 and 168 hours')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { timeRange = 24 } = req.query;
    const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);

    // Get traffic flow trends
    const trafficFlowData = await TrafficData.aggregate([
      { $match: { timestamp: { $gte: startTime }, isActive: true } },
      {
        $group: {
          _id: {
            hour: { $hour: '$timestamp' },
            zone: '$zone'
          },
          avgVehicles: { $avg: '$totalVehicles' },
          avgSpeed: { $avg: '$averageSpeed' },
          congestionLevel: { $avg: { $cond: [
            { $eq: ['$congestionLevel', 'low'] }, 1,
            { $cond: [
              { $eq: ['$congestionLevel', 'medium'] }, 2,
              { $cond: [
                { $eq: ['$congestionLevel', 'high'] }, 3, 4
              ]}
            ]}
          ]}
        }
      },
      { $sort: { '_id.hour': 1 } }
    ]);

    // Get incident trends
    const incidentTrends = await Incident.aggregate([
      { $match: { createdAt: { $gte: startTime } } },
      {
        $group: {
          _id: {
            hour: { $hour: '$createdAt' },
            type: '$type'
          },
          count: { $sum: 1 },
          avgResolutionTime: { $avg: '$actualDuration' }
        }
      },
      { $sort: { '_id.hour': 1 } }
    ]);

    // Get performance metrics
    const performanceMetrics = await TrafficData.aggregate([
      { $match: { timestamp: { $gte: startTime }, isActive: true } },
      {
        $group: {
          _id: null,
          avgFlowEfficiency: { $avg: { $divide: ['$averageSpeed', 50] } }, // Normalized to 0-1
          signalOptimization: { $avg: { $cond: [
            { $eq: ['$congestionLevel', 'low'] }, 1,
            { $cond: [
              { $eq: ['$congestionLevel', 'medium'] }, 0.7,
              { $cond: [
                { $eq: ['$congestionLevel', 'high'] }, 0.4, 0.1
              ]}
            ]}
          ]},
          totalDataPoints: { $sum: 1 }
        }
      }
    ]);

    // Get recent analytics reports
    const recentReports = await Analytics.find({
      status: 'completed',
      $or: [
        { isPublic: true },
        { generatedBy: req.user.id }
      ]
    })
    .populate('generatedBy', 'username profile.firstName profile.lastName')
    .sort({ createdAt: -1 })
    .limit(5);

    res.json({
      status: 'success',
      data: {
        analytics: {
          trafficFlowData,
          incidentTrends,
          performanceMetrics: performanceMetrics[0] || {
            avgFlowEfficiency: 0,
            signalOptimization: 0,
            totalDataPoints: 0
          },
          recentReports,
          timeRange: parseInt(timeRange),
          lastUpdated: new Date()
        }
      }
    });
  } catch (error) {
    console.error('Get analytics dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching analytics dashboard data'
    });
  }
});

// @desc    Get executive dashboard data
// @route   GET /api/v1/dashboard/executive
// @access  Private (Admin, Analyst)
router.get('/executive', protect, generalLimiter, [
  query('timeRange')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('Time range must be between 1 and 168 hours')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { timeRange = 24 } = req.query;
    const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);

    // Get KPI metrics
    const kpiMetrics = await TrafficData.aggregate([
      { $match: { timestamp: { $gte: startTime }, isActive: true } },
      {
        $group: {
          _id: null,
          totalTrafficVolume: { $sum: '$totalVehicles' },
          avgTrafficSpeed: { $avg: '$averageSpeed' },
          congestionIndex: { $avg: { $cond: [
            { $eq: ['$congestionLevel', 'low'] }, 1,
            { $cond: [
              { $eq: ['$congestionLevel', 'medium'] }, 2,
              { $cond: [
                { $eq: ['$congestionLevel', 'high'] }, 3, 4
              ]}
            ]}
          ]},
          systemEfficiency: { $avg: { $cond: [
            { $eq: ['$congestionLevel', 'low'] }, 100,
            { $cond: [
              { $eq: ['$congestionLevel', 'medium'] }, 75,
              { $cond: [
                { $eq: ['$congestionLevel', 'high'] }, 50, 25
              ]}
            ]}
          ]}
        }
      }
    ]);

    // Get incident impact analysis
    const incidentImpact = await Incident.aggregate([
      { $match: { createdAt: { $gte: startTime } } },
      {
        $group: {
          _id: null,
          totalIncidents: { $sum: 1 },
          avgResolutionTime: { $avg: '$actualDuration' },
          criticalIncidents: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          totalTrafficDelay: { $sum: '$impact.trafficDelay' },
          totalVehiclesAffected: { $sum: '$impact.vehiclesAffected' }
        }
      }
    ]);

    // Get zone performance comparison
    const zonePerformance = await TrafficData.aggregate([
      { $match: { timestamp: { $gte: startTime }, isActive: true } },
      {
        $group: {
          _id: '$zone',
          avgSpeed: { $avg: '$averageSpeed' },
          totalVehicles: { $sum: '$totalVehicles' },
          congestionScore: { $avg: { $cond: [
            { $eq: ['$congestionLevel', 'low'] }, 1,
            { $cond: [
              { $eq: ['$congestionLevel', 'medium'] }, 2,
              { $cond: [
                { $eq: ['$congestionLevel', 'high'] }, 3, 4
              ]}
            ]}
          ]},
          intersectionCount: { $addToSet: '$intersectionId' }
        }
      },
      {
        $project: {
          zone: '$_id',
          avgSpeed: { $round: ['$avgSpeed', 2] },
          totalVehicles: 1,
          congestionScore: { $round: ['$congestionScore', 2] },
          intersectionCount: { $size: '$intersectionCount' }
        }
      },
      { $sort: { congestionScore: 1 } }
    ]);

    // Get trend analysis (comparing with previous period)
    const previousStartTime = new Date(startTime.getTime() - (timeRange * 60 * 60 * 1000));
    const previousMetrics = await TrafficData.aggregate([
      { $match: { timestamp: { $gte: previousStartTime, $lt: startTime }, isActive: true } },
      {
        $group: {
          _id: null,
          totalTrafficVolume: { $sum: '$totalVehicles' },
          avgTrafficSpeed: { $avg: '$averageSpeed' }
        }
      }
    ]);

    const currentMetrics = kpiMetrics[0] || {
      totalTrafficVolume: 0,
      avgTrafficSpeed: 0,
      congestionIndex: 0,
      systemEfficiency: 0
    };

    const previousMetricsData = previousMetrics[0] || {
      totalTrafficVolume: 0,
      avgTrafficSpeed: 0
    };

    const trends = {
      trafficVolumeChange: previousMetricsData.totalTrafficVolume > 0 
        ? ((currentMetrics.totalTrafficVolume - previousMetricsData.totalTrafficVolume) / previousMetricsData.totalTrafficVolume * 100)
        : 0,
      speedChange: previousMetricsData.avgTrafficSpeed > 0
        ? ((currentMetrics.avgTrafficSpeed - previousMetricsData.avgTrafficSpeed) / previousMetricsData.avgTrafficSpeed * 100)
        : 0
    };

    res.json({
      status: 'success',
      data: {
        executive: {
          kpiMetrics: currentMetrics,
          incidentImpact: incidentImpact[0] || {
            totalIncidents: 0,
            avgResolutionTime: 0,
            criticalIncidents: 0,
            totalTrafficDelay: 0,
            totalVehiclesAffected: 0
          },
          zonePerformance,
          trends,
          timeRange: parseInt(timeRange),
          lastUpdated: new Date()
        }
      }
    });
  } catch (error) {
    console.error('Get executive dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching executive dashboard data'
    });
  }
});

// @desc    Get emergency management dashboard data
// @route   GET /api/v1/dashboard/emergency
// @access  Public
router.get('/emergency', publicLimiter, async (req, res) => {
  try {
    // Get critical and high severity incidents
    const emergencyIncidents = await Incident.find({
      severity: { $in: ['high', 'critical'] },
      status: { $in: ['reported', 'confirmed', 'in_progress'] }
    })
    .populate('reportedBy assignedTo', 'username profile.firstName profile.lastName role')
    .sort({ priority: -1, createdAt: -1 });

    // Get incidents by type for emergency response planning
    const incidentTypes = await Incident.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgResolutionTime: { $avg: '$actualDuration' },
          criticalCount: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get emergency services status (mock data)
    const emergencyServices = {
      police: { available: 8, dispatched: 2, responseTime: 5 },
      ambulance: { available: 6, dispatched: 1, responseTime: 7 },
      fire: { available: 4, dispatched: 0, responseTime: 8 },
      towTruck: { available: 12, dispatched: 3, responseTime: 15 },
      trafficControl: { available: 20, dispatched: 5, responseTime: 10 }
    };

    // Get affected intersections
    const affectedIntersections = await TrafficData.find({
      intersectionId: { $in: emergencyIncidents.map(incident => incident.location.intersectionId) },
      isActive: true
    })
    .sort({ timestamp: -1 });

    res.json({
      status: 'success',
      data: {
        emergency: {
          emergencyIncidents,
          incidentTypes,
          emergencyServices,
          affectedIntersections,
          totalEmergencyIncidents: emergencyIncidents.length,
          criticalIncidents: emergencyIncidents.filter(incident => incident.severity === 'critical').length,
          lastUpdated: new Date()
        }
      }
    });
  } catch (error) {
    console.error('Get emergency dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching emergency dashboard data'
    });
  }
});

module.exports = router;
