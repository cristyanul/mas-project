🚀 Intelligent Delivery Coordination Network (IDCN)

A sophisticated Mesa-based Python multi-agent system for package management and delivery coordination, featuring a real-time Flask web interface. IDCN demonstrates agent-based modeling, live dashboard updates, and distributed system coordination through five specialized agents managing the complete delivery lifecycle.

✨ Key Features

🤖 Multi-Agent Architecture

OrderAgent: Handles incoming orders and communicates with the warehouse

WarehouseAgent: Manages inventory, stock levels, and order fulfillment

DeliveryAgent: Simulates delivery times (40–65 seconds) with status tracking

CustomerAgent: Queues and displays customer notifications in real time

MonitorAgent: Logs delivery events and provides performance summaries

🌐 Real-Time Web Interface

Live Dashboard: Automatic data refresh every 2 seconds for metrics and inventory

Bootstrap 5 UI: Responsive design with modern CSS animations

Inventory Management: Inline add/edit/delete of items with low-stock warnings

Delivery Tracking: Progress bars and countdown timers updating every second

Notification Feed: Instant alerts for shipment events and delivery confirmations

📊 Analytics & Monitoring

Delivery History: Detailed log of completed shipments with timestamps

Performance Metrics: Orders delivered today, pending and completed deliveries, notification count

Inventory History: Internal tracking of stock changes over time (for future extension)

🚀 Quick Start

One-Command Setup

# Clone or download the project, then:
./setup.sh

This script will:

✅ Verify Python 3.8+ and pip3 availability

📦 Install dependencies (mesa==2.3.2, flask)

🌐 Launch the Flask application on http://127.0.0.1:5000/

Manual Setup

# 1. Ensure Python 3.8+ is installed:
python3 --version

# 2. Install dependencies:
pip3 install mesa==2.3.2 flask

# 3. Start the web application:
python3 app.py

# 4. Open your browser to http://127.0.0.1:5000/

🛠 How It Works

Agent Workflow

Order Placement → via web form (OrderAgent)

Inventory Check → deduct stock if available (WarehouseAgent)

Dispatch Delivery → simulate shipment timing (DeliveryAgent)

Progress Updates → real-time countdown and progress bar

Customer Notifications → push delivery events to UI (CustomerAgent)

Monitoring → aggregate logs and daily summaries (MonitorAgent)

API Endpoints

GET /api/status → current inventory, pending orders, active deliveries, notifications, delivered count

GET /api/dashboard → full dashboard data for metrics, inventory, deliveries, history

🏗 Project Structure

IDCN/
├── setup.sh                # Installation and startup script
├── app.py                  # Flask application with Mesa model integration
├── templates/
│   └── index.html          # Dashboard UI (Bootstrap 5)
├── static/
│   ├── css/style.css       # Custom styles and animations
│   └── js/utils.js         # Frontend logic for live updates & interactions
└── README.md               # Project documentation

🎯 Usage Guide

Placing an Order

Select an item and quantity in the Place an Order panel

Insert the quantity you want to order

Click Place Order to submit

Watch the order flow through inventory check, dispatch, and delivery tracking

Managing Inventory

Add Items: Use the Inventory Management form

Edit Quantities: Click the pencil icon beside an item, adjust value, then save

Remove Items: Click the trash icon and confirm deletion

Low Stock: Items with fewer than 3 units are highlighted

Tracking Deliveries

Active Deliveries: View live progress bars and remaining time

Delivery History: Check completed shipments under Delivery Monitor

Customer Notifications: See messages appear instantly when status changes

🔧 Configuration

Delivery Time Range: Adjust in app.py (line with randint(40, 65)).

Dashboard Refresh: Modify intervals in static/js/utils.js:

Data fetch every 2000 ms

Progress update every 1000 ms

📄 License & Contributing

Open-source under the MIT License. Contributions, issues, and enhancements are welcome!

Last updated: June 2025

