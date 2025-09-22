const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  reportId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  reportType: {
    type: String,
    required: true,
    enum: [
      'traffic_flow',
      'congestion_analysis',
      'peak_hours',
      'incident_impact',
      'performance_metrics',
      'predictive_analysis',
      'zone_comparison',
      'custom'
    ]
  },
  title: {
    type: String,
    required: [true, 'Report title is required'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  timeRange: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }
  },
  scope: {
    zones: [{
      type: String,
      enum: ['Central', 'North', 'South', 'East', 'West']
    }],
    intersections: [String],
    includeAll: {
      type: Boolean,
      default: false
    }
  },
  metrics: {
    trafficVolume: {
      total: Number,
      average: Number,
      peak: Number,
      trend: {
        type: String,
        enum: ['increasing', 'decreasing', 'stable']
      }
    },
    congestion: {
      averageLevel: Number, // 0-100
      peakLevel: Number,
      duration: Number, // in minutes
      affectedIntersections: Number
    },
    speed: {
      average: Number,
      minimum: Number,
      maximum: Number,
      standardDeviation: Number
    },
    incidents: {
      total: Number,
      resolved: Number,
      averageResolutionTime: Number, // in minutes
      impactScore: Number // 0-100
    },
    efficiency: {
      signalOptimization: Number, // 0-100
      flowImprovement: Number, // percentage
      delayReduction: Number // percentage
    }
  },
  insights: [{
    type: {
      type: String,
      enum: ['trend', 'anomaly', 'recommendation', 'warning', 'achievement']
    },
    title: String,
    description: String,
    impact: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100
    }
  }],
  recommendations: [{
    category: {
      type: String,
      enum: ['signal_timing', 'traffic_flow', 'infrastructure', 'maintenance', 'emergency_response']
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent']
    },
    title: String,
    description: String,
    expectedImpact: String,
    implementationCost: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    timeline: String
  }],
  visualizations: [{
    type: {
      type: String,
      enum: ['chart', 'graph', 'map', 'table', 'gauge', 'heatmap']
    },
    title: String,
    data: mongoose.Schema.Types.Mixed,
    config: mongoose.Schema.Types.Mixed
  }],
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['generating', 'completed', 'failed', 'archived'],
    default: 'generating'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [String],
  metadata: {
    dataPoints: Number,
    processingTime: Number, // in milliseconds
    algorithm: String,
    version: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
analyticsSchema.index({ reportId: 1 });
analyticsSchema.index({ reportType: 1, createdAt: -1 });
analyticsSchema.index({ 'timeRange.start': 1, 'timeRange.end': 1 });
analyticsSchema.index({ generatedBy: 1, createdAt: -1 });
analyticsSchema.index({ status: 1 });

// Virtual for report duration
analyticsSchema.virtual('duration').get(function() {
  return Math.floor((this.timeRange.end - this.timeRange.start) / (1000 * 60 * 60 * 24)); // in days
});

// Pre-save middleware to generate report ID
analyticsSchema.pre('save', function(next) {
  if (!this.reportId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.reportId = `RPT-${timestamp}-${random}`.toUpperCase();
  }
  next();
});

// Static method to get reports by type
analyticsSchema.statics.getReportsByType = function(reportType, limit = 10) {
  return this.find({ reportType })
    .populate('generatedBy', 'username profile.firstName profile.lastName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get analytics summary
analyticsSchema.statics.getAnalyticsSummary = function(timeRange = 30) {
  const startTime = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    { $match: { createdAt: { $gte: startTime }, status: 'completed' } },
    {
      $group: {
        _id: null,
        totalReports: { $sum: 1 },
        byType: {
          $push: '$reportType'
        },
        avgProcessingTime: { $avg: '$metadata.processingTime' },
        totalDataPoints: { $sum: '$metadata.dataPoints' }
      }
    },
    {
      $project: {
        totalReports: 1,
        avgProcessingTime: { $round: ['$avgProcessingTime', 2] },
        totalDataPoints: 1,
        typeDistribution: {
          traffic_flow: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'traffic_flow'] } } } },
          congestion_analysis: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'congestion_analysis'] } } } },
          peak_hours: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'peak_hours'] } } } },
          incident_impact: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'incident_impact'] } } } },
          performance_metrics: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'performance_metrics'] } } } },
          predictive_analysis: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'predictive_analysis'] } } } }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Analytics', analyticsSchema);
