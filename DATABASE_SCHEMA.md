# Database Schema

## 1. Overview

The Last-Mile Delivery Tracker uses PostgreSQL through Supabase for persistent data storage.

The database stores:

- Delivery zones and areas
- Customer and delivery-agent profiles
- Orders
- Delivery inventory
- Configurable rate cards
- Order tracking events

The database uses UUID-based identifiers and foreign-key relationships to maintain referential integrity between related entities.

---

## 2. Database Tables

The main application tables are:

1. `profiles`
2. `zones`
3. `areas`
4. `orders`
5. `inventory`
6. `rate_cards`
7. `tracking_events`

---

# 3. Profiles Table

The `profiles` table stores information about customers, delivery agents, and administrators.

| Column | Type | Nullable | Description |
|---|---|---:|---|
| `id` | UUID | No | Unique user/profile identifier |
| `full_name` | TEXT | No | User's full name |
| `phone` | TEXT | Yes | User's phone number |
| `role` | TEXT | No | User role: customer, delivery_agent, or admin |
| `created_at` | TIMESTAMP WITH TIME ZONE | No | Profile creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | No | Last profile update timestamp |
| `zone_id` | UUID | Yes | Zone associated with the user/agent |
| `is_available` | BOOLEAN | No | Delivery-agent availability status |
| `current_latitude` | NUMERIC | Yes | Current latitude of delivery agent |
| `current_longitude` | NUMERIC | Yes | Current longitude of delivery agent |

### Default values

- `role` defaults to `customer`
- `is_available` defaults to `false`
- `created_at` defaults to `now()`
- `updated_at` defaults to `now()`

---

# 4. Zones Table

The `zones` table stores delivery zones configured by administrators.

| Column | Type | Nullable | Description |
|---|---|---:|---|
| `id` | UUID | No | Unique zone identifier |
| `name` | TEXT | No | Zone name |
| `description` | TEXT | Yes | Description of the zone |
| `created_at` | TIMESTAMP WITH TIME ZONE | No | Zone creation timestamp |

### Default values

- `id` is generated automatically using UUID generation
- `created_at` defaults to `now()`

---

# 5. Areas Table

The `areas` table maps individual delivery areas to zones.

| Column | Type | Nullable | Description |
|---|---|---:|---|
| `id` | UUID | No | Unique area identifier |
| `name` | TEXT | No | Area/locality name |
| `zone_id` | UUID | No | Zone to which the area belongs |
| `created_at` | TIMESTAMP WITH TIME ZONE | No | Area creation timestamp |

### Relationship

`areas.zone_id` references:

`zones.id`

This allows administrators to organize multiple delivery areas under a single delivery zone.

---

# 6. Orders Table

The `orders` table is the central table of the delivery-management system.

It stores customer orders, package information, pricing information, delivery zones, agent assignment, coordinates, and delivery status.

| Column | Type | Nullable | Description |
|---|---|---:|---|
| `id` | UUID | No | Unique order identifier |
| `order_number` | TEXT | No | Human-readable order number |
| `customer_id` | UUID | No | Customer who created the order |
| `pickup_address` | TEXT | No | Pickup address |
| `delivery_address` | TEXT | No | Delivery/drop address |
| `package_weight` | NUMERIC | No | Actual package weight |
| `package_type` | TEXT | No | Package type |
| `delivery_type` | TEXT | No | Delivery service type |
| `payment_method` | TEXT | No | Payment method such as prepaid or COD |
| `order_amount` | NUMERIC | No | Total order amount |
| `delivery_fee` | NUMERIC | No | Calculated delivery fee |
| `cod_surcharge` | NUMERIC | No | COD surcharge |
| `status` | TEXT | No | Current delivery status |
| `assigned_agent_id` | UUID | Yes | Delivery agent assigned to the order |
| `expected_delivery_date` | DATE | Yes | Expected delivery date |
| `created_at` | TIMESTAMP WITH TIME ZONE | No | Order creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | No | Last order update timestamp |
| `package_length` | NUMERIC | Yes | Package length |
| `package_width` | NUMERIC | Yes | Package width |
| `package_height` | NUMERIC | Yes | Package height |
| `volumetric_weight` | NUMERIC | Yes | Calculated volumetric weight |
| `chargeable_weight` | NUMERIC | Yes | Higher of actual and volumetric weight |
| `order_type` | TEXT | Yes | B2B or B2C order classification |
| `pickup_zone_id` | UUID | Yes | Pickup zone |
| `delivery_zone_id` | UUID | Yes | Delivery zone |
| `failure_reason` | TEXT | Yes | Reason for failed delivery |
| `failed_at` | TIMESTAMP WITH TIME ZONE | Yes | Time of failed delivery |
| `rescheduled_date` | DATE | Yes | New delivery date after rescheduling |
| `delivery_attempt` | INTEGER | No | Number of delivery attempts |
| `pickup_latitude` | DOUBLE PRECISION | Yes | Pickup latitude |
| `pickup_longitude` | DOUBLE PRECISION | Yes | Pickup longitude |
| `delivery_latitude` | DOUBLE PRECISION | Yes | Delivery latitude |
| `delivery_longitude` | DOUBLE PRECISION | Yes | Delivery longitude |

### Default values

- `id` is generated automatically using UUID generation
- `delivery_type` defaults to `standard`
- `delivery_fee` defaults to `0`
- `cod_surcharge` defaults to `0`
- `status` defaults to `pending`
- `created_at` defaults to `now()`
- `updated_at` defaults to `now()`
- `delivery_attempt` defaults to `1`

---

# 7. Inventory Table

The `inventory` table stores package/inventory information associated with orders.

| Column | Type | Nullable | Description |
|---|---|---:|---|
| `id` | UUID | No | Unique inventory identifier |
| `order_id` | UUID | No | Associated order |
| `package_type` | TEXT | No | Package type |
| `weight` | NUMERIC | No | Package weight |
| `current_location` | TEXT | Yes | Current inventory location |
| `status` | TEXT | No | Inventory status |
| `assigned_agent_id` | UUID | Yes | Delivery agent associated with inventory |
| `received_at` | TIMESTAMP WITH TIME ZONE | Yes | Time inventory was received |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Yes | Last inventory update |

### Default values

- `id` is generated automatically using UUID generation
- `status` defaults to `received`
- `received_at` defaults to `now()`
- `updated_at` defaults to `now()`

---

# 8. Rate Cards Table

The `rate_cards` table stores administrator-configurable delivery pricing.

Rate cards allow the application to calculate delivery charges without hardcoding pricing rules into the frontend.

| Column | Type | Nullable | Description |
|---|---|---:|---|
| `id` | UUID | No | Unique rate-card identifier |
| `rate_type` | TEXT | No | Rate category, such as intra-zone or inter-zone |
| `order_type` | TEXT | No | B2B or B2C |
| `base_rate` | NUMERIC | No | Base delivery charge |
| `per_kg_rate` | NUMERIC | No | Additional charge per kilogram |
| `cod_surcharge` | NUMERIC | No | COD surcharge |
| `is_active` | BOOLEAN | No | Whether the rate card is active |
| `created_at` | TIMESTAMP WITH TIME ZONE | No | Rate-card creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | No | Last rate-card update timestamp |

### Default values

- `base_rate` defaults to `0`
- `per_kg_rate` defaults to `0`
- `cod_surcharge` defaults to `0`
- `is_active` defaults to `true`
- `created_at` defaults to `now()`
- `updated_at` defaults to `now()`

---

# 9. Tracking Events Table

The `tracking_events` table stores the complete delivery-status history of an order.

Each status change creates a separate tracking event instead of overwriting the previous history.

| Column | Type | Nullable | Description |
|---|---|---:|---|
| `id` | UUID | No | Unique tracking-event identifier |
| `order_id` | UUID | No | Associated order |
| `status` | TEXT | No | Status recorded for the event |
| `description` | TEXT | Yes | Additional status information |
| `location` | TEXT | Yes | Location associated with the event |
| `updated_by` | UUID | Yes | User/agent who created the event |
| `created_at` | TIMESTAMP WITH TIME ZONE | No | Event creation timestamp |
| `latitude` | DOUBLE PRECISION | Yes | Event latitude |
| `longitude` | DOUBLE PRECISION | Yes | Event longitude |

### Default values

- `id` is generated automatically using UUID generation
- `created_at` defaults to `now()`

---

# 10. Foreign-Key Relationships

The database uses the following foreign-key relationships:

| Table | Column | References |
|---|---|---|
| `areas` | `zone_id` | `zones.id` |
| `inventory` | `assigned_agent_id` | `profiles.id` |
| `inventory` | `order_id` | `orders.id` |
| `orders` | `assigned_agent_id` | `profiles.id` |
| `orders` | `customer_id` | `profiles.id` |
| `orders` | `delivery_zone_id` | `zones.id` |
| `orders` | `pickup_zone_id` | `zones.id` |
| `profiles` | `zone_id` | `zones.id` |
| `tracking_events` | `order_id` | `orders.id` |
| `tracking_events` | `updated_by` | `profiles.id` |

---

# 11. Entity Relationships

The primary relationships can be represented as:

```text
                    ┌─────────────┐
                    │    ZONES    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
           AREAS        PROFILES      ORDERS
                           │            │
                           │            │
                           │            ├───────────────┐
                           │            │               │
                           ▼            ▼               ▼
                      INVENTORY   TRACKING_EVENTS   RATE_CARDS

More specifically:

zones
 ├── areas
 ├── profiles
 ├── orders.pickup_zone_id
 └── orders.delivery_zone_id

profiles
 ├── orders.customer_id
 ├── orders.assigned_agent_id
 ├── inventory.assigned_agent_id
 └── tracking_events.updated_by

orders
 ├── inventory.order_id
 └── tracking_events.order_id
12. Order and Tracking Relationship

An order maintains its current status in the orders.status column.

Every status transition is additionally recorded in tracking_events.

For example:

orders
  |
  └── status = "in_transit"
          |
          ├── tracking event: assigned
          ├── tracking event: picked_up
          ├── tracking event: in_transit
          └── tracking event: out_for_delivery

This design preserves the historical delivery timeline while allowing the orders table to provide the current state quickly.

13. Agent and Zone Relationship

Delivery agents are stored in the profiles table.

A delivery agent can be associated with a zone through:

profiles.zone_id → zones.id

The profile also stores:

Availability status
Current latitude
Current longitude

These fields support delivery-agent selection and location-aware delivery operations.

14. Order Pricing Data

The orders table stores the calculated pricing results so that the charge applied to an order can be retained after creation.

Important pricing fields include:

package_weight
volumetric_weight
chargeable_weight
order_type
payment_method
delivery_fee
cod_surcharge
order_amount

The rate configuration itself is maintained separately in rate_cards.

15. Failed Delivery Data

Failed deliveries are represented using fields in the orders table:

status
failure_reason
failed_at
rescheduled_date
delivery_attempt

This allows the system to preserve the failed-delivery information while supporting subsequent rescheduling and delivery attempts.

16. Location Data

Location information is stored at multiple levels.

Order locations
pickup_latitude
pickup_longitude
delivery_latitude
delivery_longitude
Agent location
current_latitude
current_longitude
Tracking-event location
latitude
longitude
location

This allows the system to support location-aware delivery tracking and agent assignment.

17. Database Design Principles

The database design follows these principles:

UUID identifiers for application entities
Foreign keys for referential integrity
Separate tables for zones and areas
Separate pricing configuration from orders
Separate current order state from tracking history
Persistent delivery-agent assignment
Persistent package and inventory information
Timestamped records for auditing and tracking
Nullable fields for optional delivery and failure information
18. Summary

The database is structured around the order as the central business entity.

Customer/Profile
       |
       ▼
     Order
       |
       ├── Pickup Zone
       ├── Delivery Zone
       ├── Package Information
       ├── Pricing Information
       ├── Assigned Agent
       ├── Inventory
       └── Tracking Events

This structure supports the major requirements of the Last-Mile Delivery Tracker, including configurable pricing, zone-based delivery operations, agent assignment, delivery tracking, failed deliveries, rescheduling, and customer communication.