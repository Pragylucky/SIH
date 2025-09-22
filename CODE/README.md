# 🚦 Smart Traffic Management System

A comprehensive, modern solution for **real-time traffic monitoring**, **incident management**, analytics, and user management.

---

## ✨ Overview

This project features:
- **Node.js/Express backend API**
- **Modern HTML frontend** powered by Tailwind CSS
- **Real-time updates & alerts** via WebSockets

---

## ✅ Tasks Accomplished

- **Scalable Backend API**  
  Built with Express and MongoDB for managing traffic, incidents, users, and analytics.

- **Real-Time Updates**  
  Integrated WebSocket (Socket.IO) for live traffic and incident alerts.

- **Responsive Frontend**  
  Tailwind CSS dashboards with analytics visualizations.

---

## 🛠️ Technology Stack

| Technology         | Why?                                               |
|--------------------|---------------------------------------------------|
| Node.js + Express  | Fast, scalable REST API & WebSocket support       |
| MongoDB + Mongoose | Flexible NoSQL for dynamic traffic/incident data  |
| Tailwind CSS       | Rapid, responsive UI design (utility-first)       |
| JWT                | Secure authentication & role-based access         |
| Socket.IO          | Real-time communication between backend/frontend  |

---

## ✨ Key Features

- **Real-time Traffic Monitoring**  
  Live congestion, traffic lights & incident updates

- **Incident Management**  
  Report, track, resolve accidents/blockages

- **Analytics Dashboard**  
  Insights into flow, bottlenecks, trends

- **User Management**  
  Role-based access (Admin, Operator, Analyst, Viewer)

- **Responsive UI**  
  Smooth cross-device experience

---

## ⚡ Local Setup Instructions

### 🔹 Prerequisites

- Node.js (**v14.x+**)
- MongoDB (**v4.4+**)
- npm / yarn

---

### 🔹 Backend Setup (Windows & macOS)

```shell
# Clone the repository
git clone https://github.com/Pragylucky/smart-traffic-system.git
cd smart-traffic-system/backend

# Install dependencies
npm install

# Configure environment
cp config.env.example .env
# Edit .env with your MongoDB URI and JWT secret

# Start MongoDB locally

# Run the server
npm run dev       # Development mode
npm start         # Production mode
```

---

### 🔹 Frontend Setup (Windows & macOS)

```shell
cd ../html_app

npm install

# Start development server
npm run dev

# Build for production
npm run build:css
```

---

## 📂 Project Structure

```plaintext
smart-traffic-system/
├── backend/                # Node.js API
│   ├── config/             # DB config
│   ├── middleware/         # Auth, error handling, rate limiting
│   ├── models/             # Mongoose models
│   ├── routes/             # API routes
│   ├── socket/             # WebSocket handler
│   ├── server.js           # Entry point
│   └── package.json
└── html_app/               # Tailwind frontend
    ├── css/
    ├── pages/
    ├── index.html
    ├── tailwind.config.js
    └── package.json
```

---

## 📊 API Overview

- `POST /api/v1/auth/login`  
  User login

- `GET /api/v1/traffic/latest`  
  Latest traffic data

- `POST /api/v1/incidents`  
  Report new incident

- `GET /api/v1/analytics/summary`  
  Analytics summary

- `GET /api/v1/dashboard/overview`  
  Dashboard overview

> _Full API details in `/backend/README.md`_

---

## 🚀 Deployment

- Use **PM2** for backend process management
- Use **Nginx** as reverse proxy
- Configure **SSL/TLS certificates** for secure access
- Set up **database backups & monitoring tools**

---

## 🧪 Testing

```shell
# Run backend tests
npm test

# With coverage
npm run test:coverage
```

---

## 📄 License

This project is licensed under the **MIT License**.

---

> ✨ Built for SIH Project Demo – Smart & Scalable Traffic Management Solution 🚦
