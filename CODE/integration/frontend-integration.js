// Frontend Integration Helper
// This file provides JavaScript functions to integrate the frontend with the backend API

class TrafficAPI {
  constructor(baseURL = 'http://localhost:5000/api/v1') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('authToken');
  }

  // Set authentication token
  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  // Remove authentication token
  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  // Make API request
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Authentication methods
  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (response.data.token) {
      this.setToken(response.data.token);
    }
    
    return response;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.clearToken();
    }
  }

  async getCurrentUser() {
    return await this.request('/auth/me');
  }

  // Traffic data methods
  async getTrafficData(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/traffic?${queryString}`);
  }

  async getLatestTrafficData() {
    return await this.request('/traffic/latest');
  }

  async getTrafficStats(timeRange = 24) {
    return await this.request(`/traffic/stats?timeRange=${timeRange}`);
  }

  async getTrafficByZone(zone) {
    return await this.request(`/traffic/zone/${zone}`);
  }

  // Incident methods
  async getIncidents(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/incidents?${queryString}`);
  }

  async getActiveIncidents() {
    return await this.request('/incidents/active');
  }

  async getIncidentStats(timeRange = 24) {
    return await this.request(`/incidents/stats?timeRange=${timeRange}`);
  }

  async getIncidentById(id) {
    return await this.request(`/incidents/${id}`);
  }

  async createIncident(incidentData) {
    return await this.request('/incidents', {
      method: 'POST',
      body: JSON.stringify(incidentData)
    });
  }

  async updateIncident(id, updateData) {
    return await this.request(`/incidents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  async resolveIncident(id, resolutionData) {
    return await this.request(`/incidents/${id}/resolve`, {
      method: 'PUT',
      body: JSON.stringify(resolutionData)
    });
  }

  // Dashboard methods
  async getDashboardOverview(timeRange = 24) {
    return await this.request(`/dashboard/overview?timeRange=${timeRange}`);
  }

  async getOperationsData(zone = null) {
    const params = zone ? `?zone=${zone}` : '';
    return await this.request(`/dashboard/operations${params}`);
  }

  async getAnalyticsData(timeRange = 24) {
    return await this.request(`/dashboard/analytics?timeRange=${timeRange}`);
  }

  async getExecutiveData(timeRange = 24) {
    return await this.request(`/dashboard/executive?timeRange=${timeRange}`);
  }

  async getEmergencyData() {
    return await this.request('/dashboard/emergency');
  }

  // Analytics methods
  async getAnalyticsReports(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/analytics?${queryString}`);
  }

  async generateTrafficFlowAnalysis(analysisData) {
    return await this.request('/analytics/traffic-flow', {
      method: 'POST',
      body: JSON.stringify(analysisData)
    });
  }

  async getAnalyticsReport(id) {
    return await this.request(`/analytics/${id}`);
  }
}

// WebSocket connection helper
class TrafficWebSocket {
  constructor(url = 'http://localhost:5000') {
    this.url = url;
    this.socket = null;
    this.token = localStorage.getItem('authToken');
    this.eventHandlers = {};
  }

  connect() {
    if (this.socket) {
      return;
    }

    this.socket = io(this.url, {
      auth: {
        token: this.token
      }
    });

    this.socket.on('connect', () => {
      console.log('Connected to Smart Traffic Management WebSocket');
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
      this.emit('disconnected');
    });

    this.socket.on('traffic_update', (data) => {
      this.emit('traffic_update', data);
    });

    this.socket.on('incident_update', (data) => {
      this.emit('incident_update', data);
    });

    this.socket.on('emergency_alert', (data) => {
      this.emit('emergency_alert', data);
    });

    this.socket.on('system_alert', (data) => {
      this.emit('system_alert', data);
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket Error:', error);
      this.emit('error', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Event handling
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  off(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
    }
  }

  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }

  // WebSocket methods
  joinRoom(room) {
    if (this.socket) {
      this.socket.emit('join_room', { room });
    }
  }

  leaveRoom(room) {
    if (this.socket) {
      this.socket.emit('leave_room', { room });
    }
  }

  requestTrafficData(params) {
    if (this.socket) {
      this.socket.emit('request_traffic_data', params);
    }
  }

  requestIncidentData(params) {
    if (this.socket) {
      this.socket.emit('request_incident_data', params);
    }
  }

  sendTrafficControlCommand(command) {
    if (this.socket) {
      this.socket.emit('traffic_control_command', command);
    }
  }

  sendEmergencyAlert(alert) {
    if (this.socket) {
      this.socket.emit('emergency_alert', alert);
    }
  }
}

// Utility functions
const TrafficUtils = {
  // Format time for display
  formatTime(date) {
    return new Date(date).toLocaleTimeString();
  },

  // Format date for display
  formatDate(date) {
    return new Date(date).toLocaleDateString();
  },

  // Get congestion level color
  getCongestionColor(level) {
    const colors = {
      low: '#10B981',      // Green
      medium: '#F59E0B',   // Yellow
      high: '#EF4444',     // Red
      severe: '#7C2D12'    // Dark Red
    };
    return colors[level] || '#6B7280';
  },

  // Get severity color
  getSeverityColor(severity) {
    const colors = {
      low: '#10B981',      // Green
      medium: '#F59E0B',   // Yellow
      high: '#EF4444',     // Red
      critical: '#7C2D12'  // Dark Red
    };
    return colors[severity] || '#6B7280';
  },

  // Calculate traffic efficiency percentage
  calculateEfficiency(trafficData) {
    const congestionWeights = {
      low: 100,
      medium: 75,
      high: 50,
      severe: 25
    };
    
    const avgCongestion = trafficData.reduce((sum, data) => {
      return sum + (congestionWeights[data.congestionLevel] || 0);
    }, 0) / trafficData.length;
    
    return Math.round(avgCongestion);
  },

  // Generate traffic flow chart data
  generateTrafficFlowData(trafficData) {
    return trafficData.map(data => ({
      time: new Date(data.timestamp).toLocaleTimeString(),
      vehicles: data.totalVehicles,
      speed: data.averageSpeed,
      congestion: data.congestionLevel
    }));
  }
};

// Export for use in frontend
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TrafficAPI, TrafficWebSocket, TrafficUtils };
} else {
  window.TrafficAPI = TrafficAPI;
  window.TrafficWebSocket = TrafficWebSocket;
  window.TrafficUtils = TrafficUtils;
}
