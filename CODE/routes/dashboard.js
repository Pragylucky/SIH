const express = require('express');
const { query, validationResult } = require('express-validator');
const TrafficData = require('../models/TrafficData');
const Incident = require('../models/Incident');
const Analytics = require('../models/Analytics');
const User = require('../models/User');
const { protect, optionalAuth } = require('../middleware/auth');
const { publicLimiter, generalLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ================= DASHBOARD OVERVIEW =================
router.get('/overview', publicLimiter, optionalAuth, [
  query('timeRange')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('Time range must be between 1 and 168 hours')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
    }

    const { timeRange = 24 } = req.query;
    const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);

    const trafficStats = await TrafficData.getTrafficStats(parseInt(timeRange));
    const incidentStats = await Incident.getIncidentStats(parseInt(timeRange));
    const latestTrafficData = await TrafficData.getLatestData();
    const activeIncidents = await Incident.getActiveIncidents();

    const systemHealth = {
      totalIntersections: latestTrafficData.length,
      activeIntersections: latestTrafficData.filter(d => d.isActive).length,
      signalMalfunctions: activeIncidents.filter(i => i.type === 'signal_malfunction').length,
      averageResponseTime: 0,
      systemUptime: 99.9
    };

    res.json({
      status: 'success',
      data: {
        overview: {
          traffic: trafficStats[0] || { totalVehicles: 0, totalPedestrians: 0, avgSpeed: 0, totalIntersections: 0, congestionDistribution: { low: 0, medium: 0, high: 0, severe: 0 } },
          incidents: incidentStats[0] || { totalIncidents: 0, avgResolutionTime: 0, typeDistribution: { accident: 0, breakdown: 0, road_closure: 0, construction: 0, other: 0 }, severityDistribution: { low: 0, medium: 0, high: 0, critical: 0 }, statusDistribution: { reported: 0, confirmed: 0, in_progress: 0, resolved: 0 } },
          systemHealth,
          latestTrafficData: latestTrafficData.slice(0, 10),
          activeIncidents: activeIncidents.slice(0, 5),
          timeRange: parseInt(timeRange),
          lastUpdated: new Date()
        }
      }
    });

  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({ status: 'error', message: 'Server error while fetching dashboard overview' });
  }
});

// ================= OPERATIONS DASHBOARD =================
router.get('/operations', publicLimiter, async (req, res) => {
  try {
    const { zone } = req.query;
    const filter = { isActive: true };
    if (zone && ['Central', 'North', 'South', 'East', 'West'].includes(zone)) filter.zone = zone;

    const latestTrafficData = await TrafficData.find(filter).sort({ timestamp: -1 }).limit(50);

    const intersectionData = {};
    latestTrafficData.forEach(data => {
      if (!intersectionData[data.intersectionId] || data.timestamp > intersectionData[data.intersectionId].timestamp) {
        intersectionData[data.intersectionId] = data;
      }
    });

    const intersections = Object.values(intersectionData);
    const activeIncidents = await Incident.getActiveIncidents();

    const zoneStats = { Central: { intersections: 0, congestion: 'low', incidents: 0 }, North: { intersections: 0, congestion: 'low', incidents: 0 }, South: { intersections: 0, congestion: 'low', incidents: 0 }, East: { intersections: 0, congestion: 'low', incidents: 0 }, West: { intersections: 0, congestion: 'low', incidents: 0 } };

    intersections.forEach(data => {
      zoneStats[data.zone].intersections++;
      if (data.congestionLevel === 'high' || data.congestionLevel === 'severe') zoneStats[data.zone].congestion = 'high';
      else if (data.congestionLevel === 'medium' && zoneStats[data.zone].congestion !== 'high') zoneStats[data.zone].congestion = 'medium';
    });

    activeIncidents.forEach(incident => {
      if (incident.location.zone && zoneStats[incident.location.zone]) zoneStats[incident.location.zone].incidents++;
    });

    res.json({ status: 'success', data: { operations: { intersections, activeIncidents, zoneStats, totalIntersections: intersections.length, totalActiveIncidents: activeIncidents.length, lastUpdated: new Date() } } });

  } catch (error) {
    console.error('Get operations dashboard error:', error);
    res.status(500).json({ status: 'error', message: 'Server error while fetching operations dashboard data' });
  }
});

// ================= ANALYTICS DASHBOARD =================
router.get('/analytics', protect, generalLimiter, [
  query('timeRange').optional().isInt({ min: 1, max: 168 }).withMessage('Time range must be between 1 and 168 hours')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });

    const { timeRange = 24 } = req.query;
    const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);

    const trafficFlowData = await TrafficData.aggregate([
      { $match: { timestamp: { $gte: startTime }, isActive: true } },
      { $group: {
          _id: { hour: { $hour: '$timestamp' }, zone: '$zone' },
          avgVehicles: { $avg: '$totalVehicles' },
          avgSpeed: { $avg: '$averageSpeed' },
          congestionLevel: {
            $avg: {
              $switch: {
                branches: [
                  { case: { $eq: ['$congestionLevel', 'low'] }, then: 1 },
                  { case: { $eq: ['$congestionLevel', 'medium'] }, then: 2 },
                  { case: { $eq: ['$congestionLevel', 'high'] }, then: 3 }
                ],
                default: 4
              }
            }
          }
        }
      },
      { $sort: { '_id.hour': 1 } }
    ]);

    const incidentTrends = await Incident.aggregate([
      { $match: { createdAt: { $gte: startTime } } },
      { $group: { _id: { hour: { $hour: '$createdAt' }, type: '$type' }, count: { $sum: 1 }, avgResolutionTime: { $avg: '$actualDuration' } } },
      { $sort: { '_id.hour': 1 } }
    ]);

    const performanceMetrics = await TrafficData.aggregate([
      { $match: { timestamp: { $gte: startTime }, isActive: true } },
      { $group: {
          _id: null,
          avgFlowEfficiency: { $avg: { $divide: ['$averageSpeed', 50] } },
          signalOptimization: { 
            $avg: { 
              $switch: {
                branches: [
                  { case: { $eq: ['$congestionLevel', 'low'] }, then: 1 },
                  { case: { $eq: ['$congestionLevel', 'medium'] }, then: 0.7 },
                  { case: { $eq: ['$congestionLevel', 'high'] }, then: 0.4 }
                ],
                default: 0.1
              }
            }
          },
          totalDataPoints: { $sum: 1 }
        }
      }
    ]);

    const recentReports = await Analytics.find({ status: 'completed', $or: [ { isPublic: true }, { generatedBy: req.user.id } ] })
      .populate('generatedBy', 'username profile.firstName profile.lastName')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({ status: 'success', data: { analytics: { trafficFlowData, incidentTrends, performanceMetrics: performanceMetrics[0] || { avgFlowEfficiency: 0, signalOptimization: 0, totalDataPoints: 0 }, recentReports, timeRange: parseInt(timeRange), lastUpdated: new Date() } } });

  } catch (error) {
    console.error('Get analytics dashboard error:', error);
    res.status(500).json({ status: 'error', message: 'Server error while fetching analytics dashboard data' });
  }
});

// ================= EXECUTIVE DASHBOARD =================
// (similar $switch corrections can be applied here if needed)

module.exports = router;
