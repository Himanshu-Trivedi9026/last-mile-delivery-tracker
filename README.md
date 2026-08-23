# Last-Mile Delivery Tracker

A full-stack logistics and delivery management platform for managing orders, rate calculation, delivery-agent assignment, order tracking, failed deliveries, rescheduling, and customer notifications.

## Technology Stack

- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL
- Supabase
- Supabase Auth
- Vercel

## User Roles

- Customer
- Delivery Agent
- Admin

## Core Modules

- Authentication and Role-Based Access Control
- Zone and Area Management
- Configurable Rate Cards
- Delivery Rate Calculation
- COD Surcharge Calculation
- Order Management
- Delivery Agent Assignment
- Order Tracking
- Immutable Tracking History
- Failed Delivery and Rescheduling
- Email/SMS Notifications

## Architecture

The application follows a layered architecture:

UI
↓
API Layer
↓
Service / Business Logic
↓
Database

Business rules such as rate calculation, zone detection, agent assignment, status transitions, and notifications are implemented as reusable services rather than being tightly coupled to UI components.

## Development

Install dependencies:

```bash
npm install