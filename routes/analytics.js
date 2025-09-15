const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Analytics = require('../models/Analytics');
const TrafficData = require('../models/TrafficData');
const Incident = require('../models/Incident');
const { protect, authorize, checkPermission } = require('../middleware/auth');
const { analyticsLimiter, generalLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// @desc    Get all analytics reports
// @route   GET /api/v1/analytics
// @access  Private (Analyst, Admin)
router.get('/', protect, authorize('analyst', 'admin'), analyticsLimiter, [
  query('reportType')
    .optional()
    .isIn(['traffic_flow', 'congestion_analysis', 'peak_hours', 'incident_impact', 'performance_metrics', 'predictive_analysis', 'zone_comparison', 'custom'])
    .withMessage('Invalid report type specified'),
  query('status')
    .optional()
    .isIn(['generating', 'completed', 'failed', 'archived'])
    .withMessage('Invalid status specified'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
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
      reportType,
      status,
      limit = 20,
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (reportType) filter.reportType = reportType;
    if (status) filter.status = status;
    
    // Non-admin users can only see public reports or their own reports
    if (req.user.role !== 'admin') {
      filter.$or = [
        { isPublic: true },
        { generatedBy: req.user.id }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [reports, totalCount] = await Promise.all([
      Analytics.find(filter)
        .populate('generatedBy', 'username profile.firstName profile.lastName role')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Analytics.countDocuments(filter)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      status: 'success',
      data: {
        reports,
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
    console.error('Get analytics reports error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching analytics reports'
    });
  }
});

// @desc    Get analytics summary
// @route   GET /api/v1/analytics/summary
// @access  Private (Analyst, Admin)
router.get('/summary', protect, authorize('analyst', 'admin'), analyticsLimiter, async (req, res) => {
  try {
    const { timeRange = 30 } = req.query;
    const summary = await Analytics.getAnalyticsSummary(parseInt(timeRange));
    
    res.json({
      status: 'success',
      data: {
        summary: summary[0] || {
          totalReports: 0,
          avgProcessingTime: 0,
          totalDataPoints: 0,
          typeDistribution: {
            traffic_flow: 0,
            congestion_analysis: 0,
            peak_hours: 0,
            incident_impact: 0,
            performance_metrics: 0,
            predictive_analysis: 0
          }
        },
        timeRange: parseInt(timeRange),
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Get analytics summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching analytics summary'
    });
  }
});

// @desc    Generate traffic flow analysis
// @route   POST /api/v1/analytics/traffic-flow
// @access  Private (Analyst, Admin)
router.post('/traffic-flow', protect, authorize('analyst', 'admin'), analyticsLimiter, [
  body('timeRange.start')
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  body('timeRange.end')
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date'),
  body('scope.zones')
    .optional()
    .isArray()
    .withMessage('Zones must be an array'),
  body('scope.intersections')
    .optional()
    .isArray()
    .withMessage('Intersections must be an array')
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

    const { timeRange, scope = { includeAll: true } } = req.body;

    // Create analytics report
    const report = await Analytics.create({
      reportType: 'traffic_flow',
      title: 'Traffic Flow Analysis',
      description: `Traffic flow analysis for ${new Date(timeRange.start).toLocaleDateString()} to ${new Date(timeRange.end).toLocaleDateString()}`,
      timeRange,
      scope,
      generatedBy: req.user.id,
      status: 'generating'
    });

    // Start analysis in background (simplified version)
    setTimeout(async () => {
      try {
        // Build filter for traffic data
        const filter = {
          timestamp: { $gte: new Date(timeRange.start), $lte: new Date(timeRange.end) },
          isActive: true
        };

        if (!scope.includeAll) {
          if (scope.zones && scope.zones.length > 0) {
            filter.zone = { $in: scope.zones };
          }
          if (scope.intersections && scope.intersections.length > 0) {
            filter.intersectionId = { $in: scope.intersections };
          }
        }

        // Get traffic data
        const trafficData = await TrafficData.find(filter);
        
        // Calculate metrics
        const totalVehicles = trafficData.reduce((sum, data) => sum + data.totalVehicles, 0);
        const avgSpeed = trafficData.reduce((sum, data) => sum + data.averageSpeed, 0) / trafficData.length || 0;
        
        // Calculate congestion levels
        const congestionLevels = trafficData.map(data => data.congestionLevel);
        const congestionDistribution = {
          low: congestionLevels.filter(level => level === 'low').length,
          medium: congestionLevels.filter(level => level === 'medium').length,
          high: congestionLevels.filter(level => level === 'high').length,
          severe: congestionLevels.filter(level => level === 'severe').length
        };

        // Update report with results
        await Analytics.findByIdAndUpdate(report._id, {
          status: 'completed',
          metrics: {
            trafficVolume: {
              total: totalVehicles,
              average: Math.round(totalVehicles / trafficData.length) || 0,
              peak: Math.max(...trafficData.map(data => data.totalVehicles)),
              trend: 'stable' // Simplified
            },
            congestion: {
              averageLevel: Math.round((congestionDistribution.medium * 25 + congestionDistribution.high * 50 + congestionDistribution.severe * 75) / trafficData.length) || 0,
              peakLevel: congestionDistribution.severe > 0 ? 100 : congestionDistribution.high > 0 ? 75 : congestionDistribution.medium > 0 ? 50 : 25,
              duration: 0, // Would need more complex calculation
              affectedIntersections: trafficData.filter(data => data.congestionLevel !== 'low').length
            },
            speed: {
              average: Math.round(avgSpeed * 100) / 100,
              minimum: Math.min(...trafficData.map(data => data.averageSpeed)),
              maximum: Math.max(...trafficData.map(data => data.averageSpeed)),
              standardDeviation: 0 // Simplified
            }
          },
          insights: [
            {
              type: 'trend',
              title: 'Traffic Volume Analysis',
              description: `Total traffic volume: ${totalVehicles.toLocaleString()} vehicles`,
              impact: totalVehicles > 10000 ? 'high' : totalVehicles > 5000 ? 'medium' : 'low',
              confidence: 95
            }
          ],
          recommendations: [
            {
              category: 'signal_timing',
              priority: 'medium',
              title: 'Optimize Signal Timing',
              description: 'Consider adjusting signal timing during peak hours',
              expectedImpact: 'Reduce congestion by 10-15%',
              implementationCost: 'medium',
              timeline: '2-4 weeks'
            }
          ],
          metadata: {
            dataPoints: trafficData.length,
            processingTime: Date.now() - report.createdAt.getTime(),
            algorithm: 'basic_analysis',
            version: '1.0'
          }
        });
      } catch (error) {
        console.error('Traffic flow analysis error:', error);
        await Analytics.findByIdAndUpdate(report._id, {
          status: 'failed'
        });
      }
    }, 1000);

    res.status(201).json({
      status: 'success',
      message: 'Traffic flow analysis started',
      data: {
        report: {
          id: report._id,
          reportId: report.reportId,
          status: report.status,
          estimatedCompletion: new Date(Date.now() + 30000) // 30 seconds
        }
      }
    });
  } catch (error) {
    console.error('Generate traffic flow analysis error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while generating traffic flow analysis'
    });
  }
});

// @desc    Get report by ID
// @route   GET /api/v1/analytics/:id
// @access  Private (Analyst, Admin)
router.get('/:id', protect, authorize('analyst', 'admin'), analyticsLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    const report = await Analytics.findById(id)
      .populate('generatedBy', 'username profile.firstName profile.lastName role');

    if (!report) {
      return res.status(404).json({
        status: 'error',
        message: 'Analytics report not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && !report.isPublic && report.generatedBy._id.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied to this report'
      });
    }

    res.json({
      status: 'success',
      data: {
        report
      }
    });
  } catch (error) {
    console.error('Get analytics report error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching analytics report'
    });
  }
});

// @desc    Update report (make public/private, add tags)
// @route   PUT /api/v1/analytics/:id
// @access  Private (Analyst, Admin)
router.put('/:id', protect, authorize('analyst', 'admin'), generalLimiter, [
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
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
    
    const report = await Analytics.findById(id);

    if (!report) {
      return res.status(404).json({
        status: 'error',
        message: 'Analytics report not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && report.generatedBy.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied to modify this report'
      });
    }

    const updatedReport = await Analytics.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('generatedBy', 'username profile.firstName profile.lastName role');

    res.json({
      status: 'success',
      message: 'Analytics report updated successfully',
      data: {
        report: updatedReport
      }
    });
  } catch (error) {
    console.error('Update analytics report error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while updating analytics report'
    });
  }
});

// @desc    Delete analytics report
// @route   DELETE /api/v1/analytics/:id
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('admin'), generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    const report = await Analytics.findByIdAndDelete(id);

    if (!report) {
      return res.status(404).json({
        status: 'error',
        message: 'Analytics report not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Analytics report deleted successfully'
    });
  } catch (error) {
    console.error('Delete analytics report error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while deleting analytics report'
    });
  }
});

module.exports = router;
