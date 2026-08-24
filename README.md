Last-Mile Delivery Tracker

A full-stack logistics and delivery management platform designed to manage customer orders, configurable delivery pricing, delivery-agent assignment, order tracking, failed deliveries, rescheduling, and customer notifications.

1. Project Objective

The Last-Mile Delivery Tracker provides a centralized platform for customers, delivery agents, and administrators to manage the complete last-mile delivery process.

The system supports:

Customer registration and authentication
Role-based access control
Customer order creation
Admin order management
Automatic delivery-charge calculation
Pickup and delivery zone detection
Configurable B2B and B2C rate cards
Intra-zone and inter-zone pricing
COD surcharge calculation
Delivery-agent management
Manual agent assignment
Automatic nearest-agent assignment
Agent availability management
Agent location tracking
Order status tracking
Immutable tracking history
Failed-delivery handling
Delivery rescheduling
Agent reassignment after rescheduling
Email notifications
SMS notifications
Administrative order monitoring
2. User Roles

The application provides three major user roles.

Customer

Customers can:

Register an account
Log in
Create delivery orders
Enter pickup and delivery addresses
Enter package dimensions and weight
Select B2B/B2C order type
Select Prepaid/COD payment type
View calculated delivery charges
View order details
Track delivery status
View the complete tracking timeline
Receive email and SMS notifications
Reschedule failed deliveries
Delivery Agent

Delivery agents can:

Log in to the delivery dashboard
View assigned deliveries
View order and customer information required for delivery
Update delivery status
Mark orders as picked up
Mark orders as in transit
Mark orders as out for delivery
Mark orders as delivered
Mark deliveries as failed
Provide current location information
Manage assigned deliveries
Administrator

Administrators can:

View all orders
Manage delivery agents
Create delivery agents
View agent details
Configure agent availability
Assign agents to zones
View agent locations
View assigned delivery counts
Manually assign agents
Trigger automatic agent assignment
Manage delivery zones
Manage areas assigned to zones
Configure rate cards
Configure COD surcharge
Filter and monitor orders
View tracking history
Override order status
3. Core Features
3.1 Authentication and Authorization

The system uses Supabase Authentication and role-based authorization.

Supported roles:

Customer
Delivery Agent
Admin

Protected API routes verify the authenticated user and their role before performing privileged operations.

3.2 Order Management

An order contains information including:

Pickup address
Delivery address
Pickup coordinates
Delivery coordinates
Package dimensions
Actual package weight
Volumetric weight
Chargeable weight
Order type
Payment method
Pickup zone
Delivery zone
Delivery charge
COD surcharge
Assigned delivery agent
Current status
Delivery attempt
Failure information
Rescheduled date
4. Delivery Pricing Engine

The delivery pricing engine calculates the delivery charge automatically when an order is created.

The calculation is based on administrator-configured rate cards rather than hardcoded prices.

4.1 Volumetric Weight

The system calculates volumetric weight using:

Volumetric Weight = (L × B × H) / 5000

Where:

L = Package Length
B = Package Width
H = Package Height
4.2 Chargeable Weight

The system compares actual weight with volumetric weight.

Chargeable Weight = MAX(Actual Weight, Volumetric Weight)

The higher value becomes the chargeable weight.

4.3 Zone Detection

The system determines:

Pickup zone
Delivery zone

The detected zones are used to select the appropriate rate.

4.4 Rate Card Selection

The rate card is selected based on:

Order type
B2B or B2C
Pickup zone
Delivery zone
Intra-zone or inter-zone movement
Chargeable weight

Rate values are administrator-configurable.

4.5 COD Surcharge

If the payment type is COD, the configured COD surcharge is added according to the applicable order type.

For prepaid orders, the COD surcharge is not applied.

The final delivery charge is calculated as:

Final Delivery Charge = Base Delivery Charge + COD Surcharge
5. Delivery Agent Assignment

The system supports both manual and automatic delivery-agent assignment.

5.1 Manual Assignment

An administrator can manually assign an order to a delivery agent.

The assignment verifies that the selected agent is eligible for the delivery.

5.2 Automatic Assignment

The system can automatically select a suitable delivery agent.

The assignment logic considers:

Agent role
Agent availability
Delivery zone
Current agent location
Distance from the delivery destination

The nearest suitable available agent is selected.

5.3 Agent Location

Delivery agents can provide their current:

Latitude
Longitude

This information is used by the assignment system to determine the nearest suitable agent.

5.4 Agent Availability

Agents have an availability state.

Available
    |
    v
Eligible for Assignment

Unavailable
    |
    v
Not Eligible for Assignment

Only suitable available delivery agents are considered for automatic assignment.

6. Order Status Lifecycle

The normal delivery lifecycle is:

Assigned
    |
    v
Picked Up
    |
    v
In Transit
    |
    v
Out for Delivery
    |
    v
Delivered

A delivery can also enter the failed-delivery flow.

Assigned
    |
    v
Delivery Attempt
    |
    v
Failed
    |
    v
Customer Reschedules
    |
    v
New Delivery Attempt
    |
    v
Agent Reassigned
7. Tracking History

The application maintains a tracking history for every order.

Each tracking event can contain:

Order ID
Status
Description
Location
Latitude
Longitude
Timestamp
Actor/User who created the event

The tracking timeline allows customers and administrators to view the complete delivery journey.

Tracking events are recorded independently from the current order status.

8. Failed Delivery Handling

If a delivery attempt fails, the system records:

Failed status
Failure reason
Failure timestamp
Delivery attempt number

The customer can then reschedule the delivery.

Rescheduling Process

When a customer reschedules a failed delivery:

The new delivery date is captured.
The delivery attempt number is incremented.
The previous failure information is cleared for the new attempt.
Available delivery agents are searched.
The previous agent is avoided when another suitable agent exists.
A new agent is assigned where possible.
The customer receives notification of the rescheduled delivery.

If no suitable agent is available, the order can remain unassigned for later manual assignment by the administrator.

9. Email Notifications

The application uses Resend for email notifications.

Customers receive email notifications when delivery-status changes occur.

Notification information can include:

Customer name
Order number
Current status
Status description
Delivery address
Rescheduled date
Delivery attempt

Email notification failures are handled independently from the order-status update.

Therefore, a temporary email-service failure does not invalidate an otherwise successful tracking update.

10. SMS Notifications

The application uses Twilio for SMS notifications.

Customers receive SMS notifications for delivery-status changes.

SMS messages can contain:

Customer name
Order number
Current delivery status
Status description
Rescheduled delivery date
Delivery attempt
Delivery address

The application uses Twilio credentials stored in environment variables.

SMS credentials are never committed to the source-code repository.

11. Technology Stack
Frontend
Next.js 16
React 19
TypeScript
Tailwind CSS
Backend
Next.js App Router
Next.js API Routes
TypeScript
Zod validation
Database
Supabase
PostgreSQL
Authentication
Supabase Auth
Supabase SSR
Mapping
Leaflet
React Leaflet
Email
Resend
SMS
Twilio
12. System Architecture

The application follows a layered architecture:

+--------------------------------------+
|             Frontend                 |
|     Next.js + React + TypeScript     |
+------------------+-------------------+
                   |
                   v
+--------------------------------------+
|              API Layer               |
|        Next.js API Routes            |
+------------------+-------------------+
                   |
                   v
+--------------------------------------+
|        Business Logic Layer          |
|                                      |
| Pricing                              |
| Zone Detection                       |
| Agent Assignment                     |
| Tracking                             |
| Rescheduling                         |
| Notifications                        |
+------------------+-------------------+
                   |
                   v
+--------------------------------------+
|             Supabase                 |
|     PostgreSQL + Supabase Auth       |
+--------------------------------------+

External Services

Resend  ---> Email Notifications
Twilio  ---> SMS Notifications
Leaflet ---> Map Visualization
13. Project Structure
src/
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── agents/
│   │   │   │   ├── [agentId]/
│   │   │   │   ├── route.ts
│   │   │   │   └── orders/
│   │   │   ├── rate-cards/
│   │   │   └── zones/
│   │   │
│   │   ├── agent/
│   │   │   └── location/
│   │   │
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   ├── logout/
│   │   │   ├── me/
│   │   │   └── register/
│   │   │
│   │   ├── inventory/
│   │   │
│   │   ├── orders/
│   │   │   ├── [orderId]/
│   │   │   │   ├── assign/
│   │   │   │   ├── tracking/
│   │   │   │   └── route.ts
│   │   │   └── route.ts
│   │   │
│   │   └── routes/
│   │
│   ├── dashboard/
│   │   ├── admin/
│   │   ├── agent/
│   │   └── customer/
│   │
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── LiveRoutingMap.tsx
│   └── admin/
│       └── DeliveryMap.tsx
│
├── lib/
│   ├── email/
│   │   └── resend.ts
│   ├── sms/
│   │   └── twilio.ts
│   └── supabase/
│       ├── admin.ts
│       ├── client.ts
│       └── server.ts
│
└── validations/
    ├── auth.ts
    ├── order.ts
    └── tracking.ts
14. Environment Variables

Create a local environment file:

cp .env.example .env.local

Required environment variables include:

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email
RESEND_API_KEY=
EMAIL_FROM=

# SMS
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Optional
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
Security

The following files must never be committed:

.env
.env.local
.env.production

Only .env.example should be included in the public repository.

15. Installation
Prerequisites

Install:

Node.js
npm
Supabase account/project
Resend account
Twilio account
Install Dependencies
npm install
Configure Environment
cp .env.example .env.local

Fill in the required environment variables.

16. Running the Application
Development
npm run dev

The application will be available at:

http://localhost:3000
Production Build
npm run build
Production Server
npm run start
17. API Documentation
Authentication APIs
Register
POST /api/auth/register

Registers a new customer account.

Login
POST /api/auth/login

Authenticates a user.

Logout
POST /api/auth/logout

Logs out the current user.

Current User
GET /api/auth/me

Returns information about the authenticated user.

18. Order APIs
List Orders
GET /api/orders

Retrieves orders according to the authenticated user's permissions.

Create Order
POST /api/orders

Creates a new delivery order and calculates the applicable delivery charge.

Get Order
GET /api/orders/[orderId]

Retrieves a specific order.

19. Assignment API
Assign Delivery Agent
POST /api/orders/[orderId]/assign

Assigns an eligible delivery agent to an order.

The assignment system supports administrative assignment and automatic assignment workflows according to authorization rules.

20. Tracking APIs
Get Tracking History
GET /api/orders/[orderId]/tracking

Returns the tracking timeline of an order.

Create Tracking Event
POST /api/orders/[orderId]/tracking

Creates a new tracking event and updates the order status according to the delivery workflow.

The endpoint also handles:

Failed delivery
Rescheduling
Agent reassignment
Email notification
SMS notification
21. Admin APIs
Delivery Agents
GET /api/admin/agents
GET /api/admin/agents/[agentId]
GET /api/admin/agents/[agentId]/orders

These endpoints provide delivery-agent information and assigned-order information.

Zones
GET /api/admin/zones
POST /api/admin/zones
PATCH /api/admin/zones/[zoneId]

These endpoints allow administrators to list, create, and update delivery zones.

Rate Cards
GET /api/admin/rate-cards
POST /api/admin/rate-cards
PATCH /api/admin/rate-cards/[rateCardId]
DELETE /api/admin/rate-cards/[rateCardId]

These endpoints allow administrators to create, update, delete, and manage configurable delivery rates.

22. Delivery Agent API
Update Agent Location
POST /api/agent/location

Stores the current delivery-agent location.

The stored coordinates can be used by the automatic assignment system.

23. Database

The application uses:

Supabase PostgreSQL

Core data concepts include:

User profiles
Orders
Delivery zones
Rate cards
Tracking events
Delivery-agent information
Agent location
Order assignment information

The detailed database schema is documented separately in the project documentation.

24. Data Flow
Order Creation
Customer
   |
   v
Enter Order Details
   |
   v
Validate Input
   |
   v
Detect Pickup/Delivery Zones
   |
   v
Calculate Volumetric Weight
   |
   v
Determine Chargeable Weight
   |
   v
Select Rate Card
   |
   v
Apply COD Surcharge
   |
   v
Calculate Final Charge
   |
   v
Create Order
   |
   v
Assign Delivery Agent
Delivery Status Update
Delivery Agent
      |
      v
Update Status
      |
      v
Validate Status Transition
      |
      v
Create Tracking Event
      |
      v
Update Order Status
      |
      +------------------+
      |                  |
      v                  v
   Resend              Twilio
   Email                 SMS
      |                  |
      +--------+---------+
               |
               v
           Customer
25. Security Considerations

The application implements:

Supabase authentication
Role-based authorization
Server-side authentication checks
Zod request validation
Protected administrative APIs
Server-side Supabase service-role operations where privileged access is required
Environment-based secret management

Sensitive credentials must never be included in source code.

26. Deployment

The application can be deployed to a Next.js-compatible platform such as Vercel.

Production deployment requires:

A public GitHub repository
main branch
Production environment variables
Supabase configuration
Resend configuration
Twilio configuration
Successful production build
Production testing

The final hosted application URL should be added here after deployment:

Production URL:
<TO_BE_ADDED_AFTER_DEPLOYMENT>
27. Submission Requirements

The project submission should contain:

1. Source Code

Complete project source code without:

node_modules/
.next/
.env
.env.local
dist/
out/
.vscode/
.idea/
2. README

This README provides:

Project overview
Setup instructions
Environment configuration
Architecture
API overview
Rate calculation logic
Deployment information
3. Hosted Application

The final deployed application URL should be provided with the submission.

4. System Design Write-up

The Last-Mile Delivery Tracker is designed as a role-based delivery management platform using Next.js API routes, a PostgreSQL database through Supabase, and separate customer, delivery-agent, and administrator workflows.

### Rate Calculation Engine

The rate calculation engine performs all pricing calculations on the server side using administrator-configured rate cards. When an order is created, the system first determines the pickup and delivery zones from the configured delivery areas. It then calculates volumetric weight using:

Volumetric Weight = (Length × Breadth × Height) / 5000

The chargeable weight is the greater of actual weight and volumetric weight:

Chargeable Weight = MAX(Actual Weight, Volumetric Weight)

The system determines whether the shipment is intra-zone or inter-zone and selects the corresponding rate card for the order type, either B2B or B2C. The delivery charge is calculated from the configured base rate and per-kilogram rate. For COD orders, the configured COD surcharge is added. Because the values are stored in the database as rate cards, administrators can modify pricing without changing application code.

### Zone Detection

Delivery areas are mapped to delivery zones by administrators. During order creation, the system loads the configured areas and compares their names against the normalized pickup and delivery addresses. When multiple areas match, the longest matching area is selected so that a more specific locality takes precedence over a generic one. The selected area's zone determines the pickup or delivery zone used for pricing and agent assignment.

### Automatic Agent Assignment

The assignment system considers delivery-agent availability and location. Available agents are loaded from the profiles table using the delivery-agent role and availability flag. When the order contains a delivery destination with valid GPS coordinates, the system calculates the geographical distance between the destination and each available agent using the Haversine formula. The nearest agent is selected.

If GPS information cannot be used, the system first prefers an available agent belonging to the delivery zone. If no same-zone agent is available, it falls back to another available agent. Administrators can also manually assign an agent. Agent location updates are stored through the agent-location API and can therefore improve future GPS-based assignment decisions.

### Delivery Status and Immutable Tracking

Delivery progress follows a controlled lifecycle beginning with assignment and continuing through pickup, transit, out-for-delivery, and delivery completion. Status transitions are validated by the backend so that statuses cannot move backwards or skip required stages. Each successful status change creates a separate tracking event containing the order, status, description, location information, timestamp, and actor. This provides an auditable tracking timeline rather than overwriting historical delivery information.

### Failed Delivery and Rescheduling

A delivery can be marked as failed only after it has entered an eligible delivery stage, and a failure reason is required. The order stores the failure reason and failure timestamp while the tracking event records the failed status.

After a failed delivery, the customer can request a new delivery date. The system validates that the date is not in the past, increments the delivery attempt number, clears the previous failure information, and searches for another available delivery agent. The previous agent is excluded when possible. If another agent is available, the order is reassigned automatically; otherwise, it remains available for administrative assignment. The rescheduled order then restarts the normal delivery workflow from the pickup stage.

### Customer Notifications

After a successful tracking update, the system attempts to notify the customer through email and SMS. Notification failures are intentionally non-blocking: a communication-provider failure does not undo a successfully recorded delivery-status update. This keeps the tracking database authoritative while still providing reliable customer communication.

28. Repository Submission Checklist

Before submission:

 Application runs without errors
 npm run build succeeds
 Repository is public
 Repository uses main branch
 .env.local is not committed
 Sensitive credentials are not committed
 node_modules is not committed
 .next is not committed
 Temporary backup files are removed
 README is complete
 Database schema documentation is included
 API documentation is included
 System design document is included
 Hosted application URL is available
 Production application has been tested
 Email notifications work
 SMS notifications work
 Agent assignment works
 Rescheduling and agent reassignment work
29. Current Project Status

The implemented application currently includes:

Customer authentication
Delivery-agent authentication
Admin functionality
Order creation
Configurable rate cards
Zone management
Delivery-charge calculation
Volumetric-weight calculation
Chargeable-weight calculation
COD surcharge
Delivery-agent management
Agent availability
Agent location
Manual assignment
Automatic nearest-agent assignment
Delivery tracking
Tracking history
Failed delivery handling
Delivery rescheduling
Agent reassignment
Email notifications
SMS notifications
Map/location functionality

Final preparation activities include:

Database schema documentation
Complete API documentation
System-design write-up
Production deployment
Production testing
Repository cleanup
Final GitHub submission
30. License

This project is developed as an academic/project assignment.