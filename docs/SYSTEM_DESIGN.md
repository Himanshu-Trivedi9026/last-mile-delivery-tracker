# Last-Mile Delivery Tracker — System Design

## 1. Rate Calculation Engine

The platform uses an admin-configurable rate calculation engine to determine the delivery charge for every order. When an order is created, the system receives the pickup and delivery addresses, package dimensions (length, breadth and height), actual weight, order type (B2B/B2C), and payment type (Prepaid/COD).

The system determines the pickup and delivery zones and identifies whether the shipment is intra-zone or inter-zone. Volumetric weight is calculated using:

**Volumetric Weight = L × B × H ÷ 5000**

The billable weight is the higher of actual weight and volumetric weight. The appropriate rate card is then selected according to the order type and zone relationship. B2B and B2C rates are maintained separately, while intra-zone and inter-zone rates are configured independently by the administrator.

For COD orders, the applicable COD surcharge configured by the administrator is added to the delivery charge. The resulting charge is calculated before order confirmation so that the customer can review the amount before placing the order. Rate values are stored in the database and are not hardcoded in the frontend.

## 2. Zone Detection

Zones are managed by the administrator. Areas can be assigned to specific delivery zones, allowing the system to determine the operational zone associated with an order.

During order creation, the pickup and delivery locations are resolved to their corresponding zones. The two zones are then compared to determine whether the shipment is intra-zone or inter-zone. This classification is passed to the rate calculation engine so that the correct B2B/B2C rate card is selected.

The system also stores delivery coordinates with orders. These coordinates are used for delivery tracking and for location-based agent assignment.

## 3. Automatic Agent Assignment

The system supports both manual and automatic delivery-agent assignment. For automatic assignment, the system considers delivery agents who are currently available.

Agents periodically send their GPS coordinates from the agent dashboard. Their current latitude and longitude are stored in the database. When an order requires automatic assignment, the system uses the available agents' current locations and the order's delivery location to identify the nearest suitable agent.

Once an agent is assigned to an order, the agent is marked unavailable so that the same agent is not incorrectly assigned to another delivery. The availability model also checks whether an agent has other active orders. An agent is released and marked available again only when they no longer have active deliveries.

This approach combines real-time GPS information with database-based availability state, allowing assignments to reflect the agent's current operational status.

## 4. Order Status and Tracking

The delivery lifecycle is represented through order statuses such as Assigned, Picked Up, In Transit, Out for Delivery, Delivered and Failed.

Every status transition creates a tracking event containing information such as the order, status, description, timestamp and actor. The tracking history is retained so that customers and administrators can view the complete delivery timeline.

The customer can view the current order status and tracking history. The platform also provides live agent tracking using the delivery agent's most recently reported GPS coordinates. The customer and administrator can see the agent's position, delivery destination and route on an interactive map.

## 5. Failed Delivery and Rescheduling

If a delivery attempt fails, the order is marked as failed and the failure information is recorded. The customer is notified and can request a new delivery date.

During rescheduling, the previous delivery attempt is preserved in the tracking history. The system searches for an available delivery agent for the new attempt and assigns the new agent according to the assignment logic.

The previous agent is released only when they have no other active deliveries, while the newly assigned agent is marked unavailable. The delivery attempt information and tracking events allow the system to maintain a history of previous attempts instead of overwriting the delivery journey.

## 6. Notifications and Architecture

The application follows a role-based architecture with separate customer, delivery-agent and administrator capabilities. Backend APIs handle authentication, orders, assignments, tracking, inventory and agent-location updates, while the frontend provides role-specific dashboards.

Email notifications are generated for customer-facing order status changes. The backend and database enforce the core business rules, while the frontend is primarily responsible for displaying information and collecting user input.

The resulting architecture separates rate calculation, order management, agent assignment, tracking, notifications and role-based access control into dedicated application components, making the platform easier to maintain and extend.
