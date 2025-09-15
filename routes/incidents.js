const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Incident = require('../models/Incident');
const { protect, authorize, checkPermission } = require('../middleware/auth');
const { generalLimiter, publicLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// @desc    Get all incidents with filtering and pagination
// @route   GET /api/v1/incidents
// @access  Public (with optional auth for enhanced data)
router.get('/', publicLimiter, [
  query('status')
    .optional()
    .isIn(['reported', 'confirmed', 'in_progress', 'resolved', 'cancelled'])
    .withMessage('Invalid status specified'),
  query('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity specified'),
  query('type')
    .optional()
    .isIn(['accident', 'breakdown', 'road_closure', 'construction', 'emergency_vehicle', 'traffic_jam', 'signal_malfunction', 'pedestrian_incident', 'weather_hazard', 'other'])
    .withMessage('Invalid incident type specified'),
  query('zone')
    .optional()
    .isIn(['Central', 'North', 'South', 'East', 'West'])
    .withMessage('Invalid zone specified'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
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
      status,
      severity,
      type,
      zone,
      limit = 20,
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (type) filter.type = type;
    if (zone) filter['location.zone'] = zone;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [incidents, totalCount] = await Promise.all([
      Incident.find(filter)
        .populate('reportedBy', 'username profile.firstName profile.lastName role')
        .populate('assignedTo', 'username profile.firstName profile.lastName role')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Incident.countDocuments(filter)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      status: 'success',
      data: {
        incidents,
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
    console.error('Get incidents error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching incidents'
    });
  }
});

// @desc    Get active incidents
// @route   GET /api/v1/incidents/active
// @access  Public
router.get('/active', publicLimiter, async (req, res) => {
  try {
    const activeIncidents = await Incident.getActiveIncidents();
    
    res.json({
      status: 'success',
      data: {
        incidents: activeIncidents,
        count: activeIncidents.length,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Get active incidents error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching active incidents'
    });
  }
});

// @desc    Get incident statistics
// @route   GET /api/v1/incidents/stats
// @access  Public
router.get('/stats', publicLimiter, async (req, res) => {
  try {
    const { timeRange = 24 } = req.query;
    const stats = await Incident.getIncidentStats(parseInt(timeRange));
    
    res.json({
      status: 'success',
      data: {
        stats: stats[0] || {
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
        timeRange: parseInt(timeRange),
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Get incident stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching incident statistics'
    });
  }
});

// @desc    Get incident by ID
// @route   GET /api/v1/incidents/:id
// @access  Public
router.get('/:id', publicLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    const incident = await Incident.findOne({ incidentId: id })
      .populate('reportedBy', 'username profile.firstName profile.lastName role')
      .populate('assignedTo', 'username profile.firstName profile.lastName role')
      .populate('updates.updatedBy', 'username profile.firstName profile.lastName role')
      .populate('resolution.resolvedBy', 'username profile.firstName profile.lastName role');

    if (!incident) {
      return res.status(404).json({
        status: 'error',
        message: 'Incident not found'
      });
    }

    res.json({
      status: 'success',
      data: {
        incident
      }
    });
  } catch (error) {
    console.error('Get incident error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching incident'
    });
  }
});

// @desc    Create new incident
// @route   POST /api/v1/incidents
// @access  Private (All authenticated users)
router.post('/', protect, generalLimiter, [
  body('type')
    .isIn(['accident', 'breakdown', 'road_closure', 'construction', 'emergency_vehicle', 'traffic_jam', 'signal_malfunction', 'pedestrian_incident', 'weather_hazard', 'other'])
    .withMessage('Invalid incident type'),
  body('severity')
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
  body('description')
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('location.coordinates.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('location.coordinates.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('location.zone')
    .isIn(['Central', 'North', 'South', 'East', 'West'])
    .withMessage('Invalid zone specified')
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

    const incident = await Incident.create({
      ...req.body,
      reportedBy: req.user.id
    });

    // Populate the created incident
    await incident.populate('reportedBy', 'username profile.firstName profile.lastName role');

    res.status(201).json({
      status: 'success',
      message: 'Incident reported successfully',
      data: {
        incident
      }
    });
  } catch (error) {
    console.error('Create incident error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while creating incident'
    });
  }
});

// @desc    Update incident
// @route   PUT /api/v1/incidents/:id
// @access  Private (Operator, Admin)
router.put('/:id', protect, authorize('operator', 'admin'), generalLimiter, [
  body('status')
    .optional()
    .isIn(['reported', 'confirmed', 'in_progress', 'resolved', 'cancelled'])
    .withMessage('Invalid status'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
  body('assignedTo')
    .optional()
    .isMongoId()
    .withMessage('Invalid assigned user ID')
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
    
    const incident = await Incident.findOne({ incidentId: id });

    if (!incident) {
      return res.status(404).json({
        status: 'error',
        message: 'Incident not found'
      });
    }

    // Add update to the updates array
    const update = {
      timestamp: new Date(),
      status: req.body.status || incident.status,
      description: req.body.updateDescription || 'Incident updated',
      updatedBy: req.user.id
    };

    const updatedIncident = await Incident.findOneAndUpdate(
      { incidentId: id },
      { 
        $set: req.body,
        $push: { updates: update }
      },
      { new: true, runValidators: true }
    ).populate('reportedBy assignedTo', 'username profile.firstName profile.lastName role');

    res.json({
      status: 'success',
      message: 'Incident updated successfully',
      data: {
        incident: updatedIncident
      }
    });
  } catch (error) {
    console.error('Update incident error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while updating incident'
    });
  }
});

// @desc    Resolve incident
// @route   PUT /api/v1/incidents/:id/resolve
// @access  Private (Operator, Admin)
router.put('/:id/resolve', protect, authorize('operator', 'admin'), generalLimiter, [
  body('resolutionNotes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Resolution notes cannot exceed 500 characters'),
  body('lessonsLearned')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Lessons learned cannot exceed 500 characters')
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
    const { resolutionNotes, lessonsLearned } = req.body;
    
    const incident = await Incident.findOne({ incidentId: id });

    if (!incident) {
      return res.status(404).json({
        status: 'error',
        message: 'Incident not found'
      });
    }

    if (incident.status === 'resolved') {
      return res.status(400).json({
        status: 'error',
        message: 'Incident is already resolved'
      });
    }

    // Calculate actual duration
    const actualDuration = Math.floor((Date.now() - incident.createdAt) / (1000 * 60));

    const updatedIncident = await Incident.findOneAndUpdate(
      { incidentId: id },
      { 
        status: 'resolved',
        actualDuration,
        resolution: {
          resolvedAt: new Date(),
          resolvedBy: req.user.id,
          resolutionNotes,
          lessonsLearned
        },
        $push: { 
          updates: {
            timestamp: new Date(),
            status: 'resolved',
            description: 'Incident resolved',
            updatedBy: req.user.id
          }
        }
      },
      { new: true, runValidators: true }
    ).populate('reportedBy assignedTo resolution.resolvedBy', 'username profile.firstName profile.lastName role');

    res.json({
      status: 'success',
      message: 'Incident resolved successfully',
      data: {
        incident: updatedIncident
      }
    });
  } catch (error) {
    console.error('Resolve incident error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while resolving incident'
    });
  }
});

// @desc    Delete incident
// @route   DELETE /api/v1/incidents/:id
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('admin'), generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    const incident = await Incident.findOneAndDelete({ incidentId: id });

    if (!incident) {
      return res.status(404).json({
        status: 'error',
        message: 'Incident not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Incident deleted successfully'
    });
  } catch (error) {
    console.error('Delete incident error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while deleting incident'
    });
  }
});

module.exports = router;
