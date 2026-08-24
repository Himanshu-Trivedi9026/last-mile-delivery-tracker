# API Documentation

## Last-Mile Delivery Tracker

This document describes the backend REST API implemented by the
Last-Mile Delivery Tracker application.

The backend is implemented using Next.js App Router API routes.
Authentication and role-based authorization are handled on the
server, with Supabase used for authentication and database access.

---

# 1. Base URL

For local development:

```text
http://localhost:3000

Production

The production base URL is the deployed application URL.

All API paths below are relative to the base URL.

Example:

GET /api/auth/me
2. Authentication

Authentication is handled through Supabase authentication.

Protected endpoints identify the authenticated user from the
server-side session.

Role-based access is enforced by the API.

Roles
Role	Purpose
customer	Create and track personal orders
delivery_agent	Update delivery location, view assigned deliveries and update statuses
admin	Manage agents, zones, areas, rate cards and all orders
3. Authentication APIs
POST /api/auth/register

Registers a new user account.

Request
{
  "full_name": "Test User",
  "email": "user@example.com",
  "phone": "9876543210",
  "password": "password"
}
Purpose

Creates a user account and associated profile.

The application supports customer registration through this authentication
flow.

Response

Returns a success or error response depending on account creation.

POST /api/auth/login

Authenticates an existing user.

Request
{
  "email": "user@example.com",
  "password": "password"
}
Purpose

Authenticates the user and establishes the application session.

POST /api/auth/logout

Logs out the currently authenticated user.

Authentication

Authenticated session.

GET /api/auth/me

Returns information about the currently authenticated user.

Response

The API returns the authenticated user's profile information including
fields such as:

{
  "id": "user-id",
  "full_name": "Test User",
  "phone": "9876543210",
  "role": "customer"
}
4. Admin Agent APIs
GET /api/admin/agents

Returns delivery agents managed by the administrator.

Authentication

admin

Purpose

Used by the admin dashboard to view available delivery agents and
their assignment information.

POST /api/admin/agents

Creates/configures a delivery agent from the admin interface.

Authentication

admin

Purpose

Creates or updates the agent's operational information, including
availability and zone-related assignment information.

GET /api/admin/agents/{agentId}

Returns detailed information about a specific delivery agent.

Authentication

admin

GET /api/admin/agents/{agentId}/orders

Returns orders assigned to a specific delivery agent.

Authentication

admin

Purpose

Allows administrators to inspect the delivery workload and order
history of an agent.

5. Admin Area APIs

Areas represent locations that can be assigned to delivery zones.

GET /api/admin/areas

Returns all configured areas.

Authentication

admin

POST /api/admin/areas

Creates a new delivery area.

Authentication

admin

Purpose

Creates an area and associates it with a configured zone.

PATCH /api/admin/areas/{areaId}

Updates an existing area.

Authentication

admin

DELETE /api/admin/areas/{areaId}

Deletes an existing area.

Authentication

admin

6. Admin Zone APIs

Zones are used by the rate calculation and delivery assignment
logic.

GET /api/admin/zones

Returns all configured delivery zones.

Authentication

admin

POST /api/admin/zones

Creates a new delivery zone.

Authentication

admin

PATCH /api/admin/zones/{zoneId}

Updates an existing delivery zone.

Authentication

admin

7. Admin Customer API
GET /api/admin/customers

Returns customer accounts available to administrators.

Authentication

admin

Purpose

Used when an administrator creates an order on behalf of a customer.

8. Rate Card APIs

Rate cards control the configurable pricing used during order creation.

The application supports different rate types and order types, including
B2B/B2C pricing and intra/inter-zone rates.

GET /api/admin/rate-cards

Returns configured rate cards.

Authentication

admin

POST /api/admin/rate-cards

Creates a new rate card.

Authentication

admin

Purpose

Allows administrators to configure delivery pricing without
hardcoding rates in the application.

PATCH /api/admin/rate-cards/{rateCardId}

Updates an existing rate card.

Authentication

admin

DELETE /api/admin/rate-cards/{rateCardId}

Deletes a rate card.

Authentication

admin

9. Agent Location API
POST /api/agent/location

Updates the authenticated delivery agent's current GPS location.

Authentication

delivery_agent

Purpose

The endpoint updates the agent's current latitude and longitude.

The stored location is subsequently used by the live tracking system
and agent-assignment logic.

Data

The location payload contains GPS information for the agent, including
latitude and longitude.

The endpoint also maintains the timestamp associated with the latest
location update.

10. Inventory APIs
GET /api/inventory

Returns inventory records.

Authentication

Authenticated user.

Agent Behavior

When accessed by a delivery agent, the API restricts inventory records
to the relevant assigned agent.

POST /api/inventory

Creates an inventory record.

Authentication

Authenticated user with the appropriate operational role.

Purpose

Associates inventory information with an order and delivery operation.

11. Order APIs
POST /api/orders

Creates a new delivery order.

Authentication

customer or admin

Purpose

The order creation API performs the application's core delivery
processing, including:

Pickup and delivery information
Zone detection
Package dimensions
Actual package weight
Volumetric-weight calculation
Billable-weight selection
B2B/B2C rate selection
Intra/inter-zone rate selection
COD surcharge calculation
Final delivery charge calculation
Order creation
Assignment-related processing

The calculated amount is returned before customer confirmation through
the order creation workflow.

GET /api/orders

Returns orders available to the authenticated user.

Authentication

Authenticated user.

Behavior

Customers see their relevant orders.

Administrators can retrieve the broader order dataset used by the
admin dashboard.

GET /api/orders/{orderId}

Returns details for a specific order.

Authentication

Authenticated user with access to the order.

Purpose

Used by customer, agent and admin order-detail interfaces.

12. Agent Assignment API
POST /api/orders/{orderId}/assign

Assigns a delivery agent to an order.

Authentication

admin

Assignment Modes

The endpoint supports the application's assignment workflow, including
automatic assignment to an appropriate available delivery agent.

The assignment logic considers available delivery agents and their
current operational/location information.

Purpose

Used for:

Manual agent assignment
Automatic agent assignment
Updating assignment information
Managing agent availability after assignment
13. Order Tracking APIs
GET /api/orders/{orderId}/tracking

Returns the complete tracking information for an order.

Authentication

One of:

customer owning the order
assigned delivery_agent
admin
Response Information

The tracking response includes:

Order information
Current order status
Tracking events
Tracking event timestamps
Tracking event information
Assigned delivery agent
Live delivery-agent GPS location
Delivery destination coordinates

The live location is obtained from the delivery agent's current GPS
information.

POST /api/orders/{orderId}/tracking

Creates a tracking/status event for an order.

Authentication

Authorized delivery agent or administrator according to the order
operation.

Supported Delivery Lifecycle
Pending
   ↓
Picked Up
   ↓
In Transit
   ↓
Out for Delivery
   ↓
Delivered

A delivery may also enter:

Failed

When a delivery fails, the application records the failure information
and supports the rescheduling workflow.

Tracking History

Each status change is recorded as a tracking event with information
such as:

order
status
description
location
actor
timestamp

This provides the customer with a complete delivery timeline.

14. Route Calculation API
POST /api/routes

Calculates a road route between two GPS coordinates.

Request
{
  "start": {
    "lat": 23.2599,
    "lng": 77.4126
  },
  "end": {
    "lat": 23.2500,
    "lng": 77.4300
  }
}
Response
{
  "success": true,
  "route": {
    "coordinates": [
      [23.2599, 77.4126],
      [23.2500, 77.4300]
    ],
    "distanceMeters": 2500,
    "durationSeconds": 600
  }
}

The route API uses OpenStreetMap/OSRM road-routing data.

The returned coordinates are converted to the latitude/longitude format
used by Leaflet.

15. Live Tracking Flow

The live tracking system works as follows:

Delivery Agent
      │
      │ GPS coordinates
      ▼
POST /api/agent/location
      │
      ▼
Agent Profile
(current latitude/longitude)
      │
      ▼
GET /api/orders/{orderId}/tracking
      │
      ├── Order status
      ├── Tracking timeline
      ├── Agent location
      └── Delivery coordinates
              │
              ▼
       Live Tracking Map
              │
              ▼
       Customer / Admin

The customer and administrator tracking pages periodically refresh
tracking information so the displayed agent position can update while
the delivery is active.

16. Authorization Summary
Endpoint Group	Customer	Agent	Admin
Authentication	✓	✓	✓
Own Orders	✓	—	✓
Agent Location	—	✓	—
Inventory	—	✓	✓
Agent Management	—	—	✓
Area Management	—	—	✓
Zone Management	—	—	✓
Rate Cards	—	—	✓
Order Assignment	—	—	✓
Order Tracking	Own	Assigned	All
Route Calculation	Application	Application	Application
17. Common HTTP Status Codes

The API uses standard HTTP status codes.

Status	Meaning
200	Request completed successfully
201	Resource created successfully where applicable
400	Invalid request or missing required data
401	User is not authenticated
403	User does not have permission
404	Requested resource was not found
409	Conflict with existing data/state where applicable
500	Unexpected server-side error
502	External routing service failure
18. Error Response Format

API errors generally return a JSON response containing a success flag
and an error message.

Example:

{
  "success": false,
  "error": "Order not found."
}

The exact error message depends on the failed operation.

19. External Routing Service

The route calculation endpoint communicates with the OSRM routing
service using OpenStreetMap road data.

The routing service is used to calculate:

Road route
Distance
Estimated travel duration
Route geometry

The resulting route is displayed on the application's Leaflet maps.

20. API Architecture

The API follows this architecture:

Frontend
   │
   ▼
Next.js API Route
   │
   ├── Authentication
   │
   ├── Role Authorization
   │
   ├── Input Validation
   │
   ├── Business Logic
   │
   ▼
Supabase Database
   │
   ├── Users / Profiles
   ├── Orders
   ├── Zones
   ├── Areas
   ├── Rate Cards
   ├── Inventory
   └── Tracking Events

