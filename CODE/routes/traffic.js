const express = require('express');
const { body, query, validationResult } = require('express-validator');
const TrafficData = require('../models/TrafficData');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { generalLimiter, publicLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// @desc    Get all traffic data with filtering and pagination
// @route   GET /api/v1/traffic
// @access  Public (with optional auth for enhanced data)
router.get('/', publicLimiter, optionalAuth, [
  query('zone')
    .optional()
    .isIn(['Central', 'North', 'South', 'East', 'West'])
    .withMessage('Invalid zone specified'),
  query('intersectionId')
    .optional()
    .isString()
    .withMessage('Intersection ID must be a string'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
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

    const {
      zone,
      intersectionId,
      limit = 50,
      page = 1,
      timeRange = 24,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { isActive: true };
    
    if (zone) filter.zone = zone;
    if (intersectionId) filter.intersectionId = intersectionId;
    
    // Time range filter
    const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    filter.timestamp = { $gte: startTime };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [trafficData, totalCount] = await Promise.all([
      TrafficData.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      TrafficData.countDocuments(filter)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      status: 'success',
      data: {
        trafficData,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get traffic data error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching traffic data'
    });
  }
});

// @desc    Get latest traffic data for all intersections
// @route   GET /api/v1/traffic/latest
// @access  Public
router.get('/latest', publicLimiter, async (req, res) => {
  try {
    const latestData = await TrafficData.getLatestData();
    
    res.json({
      status: 'success',
      data: {
        intersections: latestData,
        count: latestData.length,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Get latest traffic data error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching latest traffic data'
    });
  }
});

// @desc    Get traffic data for specific intersection
// @route   GET /api/v1/traffic/intersection/:id
// @access  Public
router.get('/intersection/:id', publicLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { timeRange = 24, limit = 100 } = req.query;

    const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);

    const trafficData = await TrafficData.find({
      intersectionId: id,
      timestamp: { $gte: startTime },
      isActive: true
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit));

    if (!trafficData.length) {
      return res.status(404).json({
        status: 'error',
        message: 'No traffic data found for this intersection'
      });
    }

    res.json({
      status: 'success',
      data: {
        intersectionId: id,
        intersectionName: trafficData[0].intersectionName,
        zone: trafficData[0].zone,
        trafficData,
        count: trafficData.length
      }
    });
  } catch (error) {
    console.error('Get intersection traffic data error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching intersection traffic data'
    });
  }
});

// @desc    Get traffic statistics
// @route   GET /api/v1/traffic/stats
// @access  Public
router.get('/stats', publicLimiter, async (req, res) => {
  try {
    const { timeRange = 24 } = req.query;
    const stats = await TrafficData.getTrafficStats(parseInt(timeRange));
    
    res.json({
      status: 'success',
      data: {
        stats: stats[0] || {
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
        timeRange: parseInt(timeRange),
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Get traffic stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching traffic statistics'
    });
  }
});

// @desc    Create new traffic data entry
// @route   POST /api/v1/traffic
// @access  Private (Operator, Admin)
router.post('/', protect, authorize('operator', 'admin'), generalLimiter, [
  body('intersectionId')
    .notEmpty()
    .withMessage('Intersection ID is required'),
  body('intersectionName')
    .notEmpty()
    .withMessage('Intersection name is required'),
  body('zone')
    .isIn(['Central', 'North', 'South', 'East', 'West'])
    .withMessage('Invalid zone specified'),
  body('coordinates.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('coordinates.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('trafficLights')
    .isArray({ min: 1 })
    .withMessage('At least one traffic light status is required'),
  body('vehicleCount')
    .isObject()
    .withMessage('Vehicle count must be an object'),
  body('congestionLevel')
    .isIn(['low', 'medium', 'high', 'severe'])
    .withMessage('Invalid congestion level')
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

    const trafficData = await TrafficData.create({
      ...req.body,
      metadata: {
        ...req.body.metadata,
        dataSource: req.body.metadata?.dataSource || 'manual',
        confidence: req.body.metadata?.confidence || 95
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Traffic data created successfully',
      data: {
        trafficData
      }
    });
  } catch (error) {
    console.error('Create traffic data error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while creating traffic data'
    });
  }
});

// @desc    Update traffic data
// @route   PUT /api/v1/traffic/:id
// @access  Private (Operator, Admin)
router.put('/:id', protect, authorize('operator', 'admin'), generalLimiter, [
  body('trafficLights')
    .optional()
    .isArray()
    .withMessage('Traffic lights must be an array'),
  body('vehicleCount')
    .optional()
    .isObject()
    .withMessage('Vehicle count must be an object'),
  body('congestionLevel')
    .optional()
    .isIn(['low', 'medium', 'high', 'severe'])
    .withMessage('Invalid congestion level')
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

    const { id } = req.params;
    
    const trafficData = await TrafficData.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!trafficData) {
      return res.status(404).json({
        status: 'error',
        message: 'Traffic data not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Traffic data updated successfully',
      data: {
        trafficData
      }
    });
  } catch (error) {
    console.error('Update traffic data error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while updating traffic data'
    });
  }
});

// @desc    Delete traffic data
// @route   DELETE /api/v1/traffic/:id
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('admin'), generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    const trafficData = await TrafficData.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!trafficData) {
      return res.status(404).json({
        status: 'error',
        message: 'Traffic data not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Traffic data deleted successfully'
    });
  } catch (error) {
    console.error('Delete traffic data error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while deleting traffic data'
    });
  }
});

// @desc    Get traffic data by zone
// @route   GET /api/v1/traffic/zone/:zone
// @access  Public
router.get('/zone/:zone', publicLimiter, async (req, res) => {
  try {
    const { zone } = req.params;
    const { timeRange = 24 } = req.query;

    if (!['Central', 'North', 'South', 'East', 'West'].includes(zone)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid zone specified'
      });
    }

    const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);

    const trafficData = await TrafficData.find({
      zone,
      timestamp: { $gte: startTime },
      isActive: true
    })
    .sort({ timestamp: -1 });

    res.json({
      status: 'success',
      data: {
        zone,
        trafficData,
        count: trafficData.length,
        timeRange: parseInt(timeRange)
      }
    });
  } catch (error) {
    console.error('Get zone traffic data error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching zone traffic data'
    });
  }
});

module.exports = router;
