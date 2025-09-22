const mongoose = require('mongoose');

const trafficDataSchema = new mongoose.Schema({
  intersectionId: {
    type: String,
    required: [true, 'Intersection ID is required'],
    index: true
  },
  intersectionName: {
    type: String,
    required: [true, 'Intersection name is required']
  },
  zone: {
    type: String,
    required: [true, 'Zone is required'],
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
  trafficLights: [{
    direction: {
      type: String,
      enum: ['north', 'south', 'east', 'west'],
      required: true
    },
    status: {
      type: String,
      enum: ['red', 'yellow', 'green'],
      required: true
    },
    timer: {
      type: Number,
      default: 0
    }
  }],
  vehicleCount: {
    north: { type: Number, default: 0 },
    south: { type: Number, default: 0 },
    east: { type: Number, default: 0 },
    west: { type: Number, default: 0 }
  },
  pedestrianCount: {
    north: { type: Number, default: 0 },
    south: { type: Number, default: 0 },
    east: { type: Number, default: 0 },
    west: { type: Number, default: 0 }
  },
  averageSpeed: {
    type: Number,
    default: 0,
    min: 0,
    max: 120
  },
  congestionLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'severe'],
    default: 'low'
  },
  weather: {
    condition: {
      type: String,
      enum: ['clear', 'cloudy', 'rainy', 'foggy', 'snowy'],
      default: 'clear'
    },
    temperature: Number,
    humidity: Number,
    visibility: Number
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    cameraId: String,
    sensorId: String,
    dataSource: {
      type: String,
      enum: ['camera', 'sensor', 'manual', 'ai_prediction'],
      default: 'sensor'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 95
    }
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
trafficDataSchema.index({ intersectionId: 1, timestamp: -1 });
trafficDataSchema.index({ zone: 1, timestamp: -1 });
trafficDataSchema.index({ timestamp: -1 });

// Virtual for total vehicle count
trafficDataSchema.virtual('totalVehicles').get(function() {
  return this.vehicleCount.north + this.vehicleCount.south + 
         this.vehicleCount.east + this.vehicleCount.west;
});

// Virtual for total pedestrian count
trafficDataSchema.virtual('totalPedestrians').get(function() {
  return this.pedestrianCount.north + this.pedestrianCount.south + 
         this.pedestrianCount.east + this.pedestrianCount.west;
});

// Static method to get latest data for all intersections
trafficDataSchema.statics.getLatestData = function() {
  return this.aggregate([
    { $sort: { intersectionId: 1, timestamp: -1 } },
    {
      $group: {
        _id: '$intersectionId',
        latestData: { $first: '$$ROOT' }
      }
    },
    { $replaceRoot: { newRoot: '$latestData' } },
    { $sort: { zone: 1, intersectionName: 1 } }
  ]);
};

// Static method to get traffic statistics
trafficDataSchema.statics.getTrafficStats = function(timeRange = 24) {
  const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);
  
  return this.aggregate([
    { $match: { timestamp: { $gte: startTime } } },
    {
      $group: {
        _id: null,
        totalVehicles: { $sum: '$totalVehicles' },
        totalPedestrians: { $sum: '$totalPedestrians' },
        avgSpeed: { $avg: '$averageSpeed' },
        congestionLevels: {
          $push: '$congestionLevel'
        },
        intersections: { $addToSet: '$intersectionId' }
      }
    },
    {
      $project: {
        totalVehicles: 1,
        totalPedestrians: 1,
        avgSpeed: { $round: ['$avgSpeed', 2] },
        totalIntersections: { $size: '$intersections' },
        congestionDistribution: {
          low: { $size: { $filter: { input: '$congestionLevels', cond: { $eq: ['$$this', 'low'] } } } },
          medium: { $size: { $filter: { input: '$congestionLevels', cond: { $eq: ['$$this', 'medium'] } } } },
          high: { $size: { $filter: { input: '$congestionLevels', cond: { $eq: ['$$this', 'high'] } } } },
          severe: { $size: { $filter: { input: '$congestionLevels', cond: { $eq: ['$$this', 'severe'] } } } }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('TrafficData', trafficDataSchema);
