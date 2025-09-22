🚦 Smart Traffic Management System

A comprehensive solution for real-time traffic monitoring, incident management, analytics, and user management. This project includes a Node.js/Express backend API and a modern HTML frontend built with Tailwind CSS.

✅ Tasks Accomplished

Task 1: Developed a scalable backend API with Express and MongoDB for handling traffic, incidents, users, and analytics.

Task 2: Integrated WebSocket support for real-time traffic updates and incident alerts.

Task 3: Built a responsive HTML frontend with Tailwind CSS for dashboards and analytics visualization.

🛠️ Technology Stack
Technology	Why We Chose It
Node.js + Express	For building a fast, scalable REST API with real-time WebSocket support.
MongoDB + Mongoose	Flexible NoSQL database for handling dynamic traffic and incident data.
Tailwind CSS	Utility-first CSS framework for rapid, responsive UI design.
JWT (JSON Web Token)	Secure authentication and role-based access control.
Socket.IO	Real-time communication between backend and frontend.
✨ Key Features

Real-time Traffic Monitoring – Live updates on congestion, traffic lights, and incidents.

Incident Management – Reporting, tracking, and resolving accidents or blockages.

Analytics Dashboard – Insights into traffic flow, bottlenecks, and trends.

User Management – Role-based access (Admin, Operator, Analyst, Viewer).

Responsive UI – Tailwind-powered frontend for smooth cross-device experience.

⚡ Local Setup Instructions
🔹 Prerequisites

Node.js (v14.x or higher)

MongoDB (v4.4 or higher)

npm / yarn

🔹 Backend Setup (Windows & macOS)

Clone the repository

git clone https://github.com/YOUR_USERNAME/smart-traffic-system.git
cd smart-traffic-system/backend


Install dependencies

npm install


Configure environment

cp config.env.example .env


Update .env with your MongoDB URI and JWT secret.

Start MongoDB (make sure it’s running locally).

Run the server

# Development mode
npm run dev

# Production mode
npm start

🔹 Frontend Setup (Windows & macOS)

Navigate to frontend folder

cd ../html_app


Install dependencies

npm install


Start the development server

npm run dev


Build for production

npm run build:css

📂 Project Structure
smart-traffic-system/
├── backend/                # Node.js API
│   ├── config/             # DB config
│   ├── middleware/         # Auth, error handling, rate limiting
│   ├── models/             # Mongoose models
│   ├── routes/             # API routes
│   ├── socket/             # WebSocket handler
│   ├── server.js           # Entry point
│   └── package.json
│
└── html_app/               # Tailwind frontend
    ├── css/
    ├── pages/
    ├── index.html
    ├── tailwind.config.js
    └── package.json

📊 API Overview

POST /api/v1/auth/login → User login

GET /api/v1/traffic/latest → Get latest traffic data

POST /api/v1/incidents → Report new incident

GET /api/v1/analytics/summary → Get analytics summary

GET /api/v1/dashboard/overview → Dashboard overview

(Full API details in /backend/README.md)

🚀 Deployment

Use PM2 for backend process management.

Use Nginx as reverse proxy.

Configure SSL/TLS certificates for secure access.

Set up database backups & monitoring tools.

🧪 Testing

Run backend tests:

npm test


With coverage:

npm run test:coverage

📄 License

This project is licensed under the MIT License.

✨ Built for SIH Project Demo – Smart & Scalable Traffic Management Solution 🚦
