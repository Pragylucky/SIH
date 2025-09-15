const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  incidentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: [true, 'Incident type is required'],
    enum: [
      'accident',
      'breakdown',
      'road_closure',
      'construction',
      'emergency_vehicle',
      'traffic_jam',
      'signal_malfunction',
      'pedestrian_incident',
      'weather_hazard',
      'other'
    ]
  },
  severity: {
    type: String,
    required: [true, 'Severity is required'],
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['reported', 'confirmed', 'in_progress', 'resolved', 'cancelled'],
    default: 'reported'
  },
  location: {
    intersectionId: String,
    intersectionName: String,
    zone: {
      type: String,
      enum: ['Central', 'North', 'South', 'East', 'West']
    },
    coordinates: {
      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180
      }
    },
    address: String,
    landmark: String
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  estimatedDuration: {
    type: Number, // in minutes
    default: 30
  },
  actualDuration: {
    type: Number // in minutes
  },
  affectedLanes: [{
    direction: {
      type: String,
      enum: ['north', 'south', 'east', 'west']
    },
    laneType: {
      type: String,
      enum: ['main', 'turning', 'pedestrian']
    },
    closureType: {
      type: String,
      enum: ['full', 'partial', 'restricted']
    }
  }],
  emergencyServices: [{
    service: {
      type: String,
      enum: ['police', 'ambulance', 'fire', 'tow_truck', 'traffic_control']
    },
    status: {
      type: String,
      enum: ['requested', 'dispatched', 'arrived', 'completed'],
      default: 'requested'
    },
    contactInfo: String,
    estimatedArrival: Date
  }],
  impact: {
    trafficDelay: {
      type: Number, // in minutes
      default: 0
    },
    vehiclesAffected: {
      type: Number,
      default: 0
    },
    alternativeRoutes: [String]
  },
  media: [{
    type: {
      type: String,
      enum: ['image', 'video', 'document']
    },
    url: String,
    filename: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  updates: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    status: String,
    description: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  resolution: {
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolutionNotes: String,
    lessonsLearned: String
  },
  tags: [String],
  isPublic: {
    type: Boolean,
    default: false
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  }
}, {
  timestamps: true
});

// Indexes for better query performance
incidentSchema.index({ incidentId: 1 });
incidentSchema.index({ status: 1, severity: 1 });
incidentSchema.index({ 'location.zone': 1, createdAt: -1 });
incidentSchema.index({ type: 1, createdAt: -1 });
incidentSchema.index({ createdAt: -1 });

// Virtual for incident age
incidentSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60)); // in minutes
});

// Virtual for is resolved
incidentSchema.virtual('isResolved').get(function() {
  return this.status === 'resolved';
});

// Virtual for is active
incidentSchema.virtual('isActive').get(function() {
  return ['reported', 'confirmed', 'in_progress'].includes(this.status);
});

// Pre-save middleware to generate incident ID
incidentSchema.pre('save', function(next) {
  if (!this.incidentId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.incidentId = `INC-${timestamp}-${random}`.toUpperCase();
  }
  next();
});

// Static method to get active incidents
incidentSchema.statics.getActiveIncidents = function() {
  return this.find({
    status: { $in: ['reported', 'confirmed', 'in_progress'] }
  }).populate('reportedBy assignedTo', 'username profile.firstName profile.lastName role');
};

// Static method to get incident statistics
incidentSchema.statics.getIncidentStats = function(timeRange = 24) {
  const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);
  
  return this.aggregate([
    { $match: { createdAt: { $gte: startTime } } },
    {
      $group: {
        _id: null,
        totalIncidents: { $sum: 1 },
        byType: {
          $push: '$type'
        },
        bySeverity: {
          $push: '$severity'
        },
        byStatus: {
          $push: '$status'
        },
        avgResolutionTime: {
          $avg: {
            $cond: [
              { $ne: ['$resolution.resolvedAt', null] },
              {
                $divide: [
                  { $subtract: ['$resolution.resolvedAt', '$createdAt'] },
                  60000 // convert to minutes
                ]
              },
              null
            ]
          }
        }
      }
    },
    {
      $project: {
        totalIncidents: 1,
        avgResolutionTime: { $round: ['$avgResolutionTime', 2] },
        typeDistribution: {
          accident: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'accident'] } } } },
          breakdown: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'breakdown'] } } } },
          road_closure: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'road_closure'] } } } },
          construction: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'construction'] } } } },
          other: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'other'] } } } }
        },
        severityDistribution: {
          low: { $size: { $filter: { input: '$bySeverity', cond: { $eq: ['$$this', 'low'] } } } },
          medium: { $size: { $filter: { input: '$bySeverity', cond: { $eq: ['$$this', 'medium'] } } } },
          high: { $size: { $filter: { input: '$bySeverity', cond: { $eq: ['$$this', 'high'] } } } },
          critical: { $size: { $filter: { input: '$bySeverity', cond: { $eq: ['$$this', 'critical'] } } } }
        },
        statusDistribution: {
          reported: { $size: { $filter: { input: '$byStatus', cond: { $eq: ['$$this', 'reported'] } } } },
          confirmed: { $size: { $filter: { input: '$byStatus', cond: { $eq: ['$$this', 'confirmed'] } } } },
          in_progress: { $size: { $filter: { input: '$byStatus', cond: { $eq: ['$$this', 'in_progress'] } } } },
          resolved: { $size: { $filter: { input: '$byStatus', cond: { $eq: ['$$this', 'resolved'] } } } }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Incident', incidentSchema);
