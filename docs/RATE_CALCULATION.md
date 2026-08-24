# Rate Calculation Logic

## Last-Mile Delivery Tracker

This document explains the server-side rate calculation engine used by
the Last-Mile Delivery Tracker.

The pricing calculation is performed during order creation. Rate values
are loaded from the admin-configured `rate_cards` table rather than
being hardcoded in the order creation request.

---

# 1. Pricing Overview

The final delivery charge is determined using:

1. Pickup and delivery zones
2. Order type (B2B or B2C)
3. Package dimensions
4. Actual package weight
5. Volumetric weight
6. Chargeable weight
7. Intra-zone or inter-zone rate
8. COD payment method
9. Admin-configured rate card

The overall flow is:

```text
Pickup Address
      |
      v
Pickup Zone Detection
      |
      v
Delivery Address
      |
      v
Delivery Zone Detection
      |
      v
Determine Rate Type
(Intra / Inter)
      |
      v
Calculate Volumetric Weight
      |
      v
Calculate Chargeable Weight
      |
      v
Select B2B / B2C Rate Card
      |
      v
Calculate Delivery Fee
      |
      v
Add COD Surcharge if applicable
      |
      v
Final Delivery Charge
2. Zone Detection

The application maintains configurable delivery areas and zones.

An area belongs to a particular delivery zone. During order creation,
the system determines the zone associated with the pickup and delivery
addresses.

The zone detection logic uses the configured delivery areas and matches
the supplied address against the configured area information.

The resulting zone identifiers are stored with the order as:

pickup_zone_id
delivery_zone_id

This allows the pricing engine to determine whether the shipment is
within the same zone or between different zones.

3. Intra-Zone and Inter-Zone Pricing

The system determines the rate type by comparing the pickup and delivery
zone IDs.

If pickup_zone_id == delivery_zone_id
        |
        v
      INTRA

If pickup_zone_id != delivery_zone_id
        |
        v
      INTER

Therefore:

Same Zone       -> intra
Different Zones -> inter

This selection is performed server-side during order creation.

4. Order Type

The pricing engine supports two order types:

B2B
B2C

The selected order type is used together with the rate type to identify
the applicable rate card.

The rate-card lookup therefore uses:

Rate Type + Order Type

Possible combinations are:

Rate Type	Order Type
intra	B2B
intra	B2C
inter	B2B
inter	B2C

Only an active rate card is used for pricing.

5. Volumetric Weight

Volumetric weight represents the weight calculated from the physical
dimensions of the package.

The application uses the required formula:

Volumetric Weight
= (Length × Width × Height) / 5000

The package dimensions are supplied during order creation.

For example:

Length = 50 cm
Width  = 40 cm
Height = 30 cm

Volumetric Weight
= (50 × 40 × 30) / 5000
= 12 kg

The calculated volumetric weight is stored with the order.

6. Chargeable Weight

The system does not automatically use actual weight for billing.

Instead, it compares actual weight and volumetric weight.

Chargeable Weight
= max(Actual Weight, Volumetric Weight)

For example:

Actual Weight     = 8 kg
Volumetric Weight = 12 kg

Chargeable Weight = 12 kg

If:

Actual Weight     = 15 kg
Volumetric Weight = 12 kg

then:

Chargeable Weight = 15 kg

This ensures that the higher of the physical and volumetric weights is
used for pricing.

7. Rate Card Configuration

Rate cards are configured by an administrator.

Each rate card contains:

rate_type
order_type
base_rate
per_kg_rate
cod_surcharge
is_active

The supported rate types are:

intra
inter

The supported order types are:

B2B
B2C

Administrators can create and update these values through the rate-card
management functionality.

The server validates that rates are non-negative numbers and that the
rate type and order type are valid.

8. Rate Card Selection

After calculating the rate type and chargeable weight, the server loads
the applicable active rate card.

The lookup criteria are:

rate_type = intra/inter
AND
order_type = B2B/B2C
AND
is_active = true

The rate card provides:

Base Rate
Per KG Rate
COD Surcharge

Pricing therefore remains configurable by the administrator instead of
requiring changes to application code.

9. Delivery Fee Calculation

The delivery fee is calculated using:

Delivery Fee
= Base Rate
+ (Chargeable Weight × Per KG Rate)

For example, assume:

Base Rate       = ₹50
Per KG Rate     = ₹20
Chargeable      = 5 kg

Then:

Delivery Fee
= 50 + (5 × 20)
= ₹150
10. COD Surcharge

The COD surcharge is applied only when the payment method is:

cod

For prepaid orders:

COD Surcharge = ₹0

For COD orders:

COD Surcharge = configured rate-card COD surcharge

The surcharge is added to the delivery fee.

Total Delivery Charge
= Delivery Fee + COD Surcharge

For example:

Delivery Fee   = ₹150
COD Surcharge  = ₹30

Total Delivery Charge
= ₹150 + ₹30
= ₹180
11. Complete Example

Consider the following shipment:

Order Type        = B2C
Payment Method    = COD

Package:
Length            = 50 cm
Width             = 40 cm
Height            = 30 cm
Actual Weight     = 8 kg

Assume:

Pickup Zone       = Zone A
Delivery Zone     = Zone B

Base Rate         = ₹60
Per KG Rate       = ₹25
COD Surcharge     = ₹30
Step 1: Determine Rate Type

The zones are different:

Zone A != Zone B

Therefore:

Rate Type = inter
Step 2: Calculate Volumetric Weight
(50 × 40 × 30) / 5000
= 12 kg
Step 3: Calculate Chargeable Weight
max(8, 12)
= 12 kg
Step 4: Calculate Delivery Fee
₹60 + (12 × ₹25)
= ₹60 + ₹300
= ₹360
Step 5: Add COD Surcharge
₹360 + ₹30
= ₹390

Therefore:

Final Delivery Charge = ₹390
12. Server-Side Calculation

The rate calculation is performed on the server during order creation.

The client supplies the package and order information, but the server
performs the important pricing operations.

The server:

1. Geocodes pickup and delivery addresses
2. Detects pickup and delivery zones
3. Calculates volumetric weight
4. Calculates chargeable weight
5. Determines intra/inter rate type
6. Loads the active B2B/B2C rate card
7. Calculates delivery fee
8. Applies COD surcharge when required
9. Stores the calculated pricing information with the order

This prevents the browser from being the authoritative source for the
final delivery charge.

13. Stored Pricing Information

The order stores the calculated pricing-related values, including:

package_weight
volumetric_weight
chargeable_weight
delivery_fee
cod_surcharge
order_amount
pickup_zone_id
delivery_zone_id

The API response also exposes a pricing summary containing values such
as:

actualWeight
volumetricWeight
chargeableWeight
rateType
orderType
baseRate
perKgRate
deliveryFee

This allows the frontend to display how the final charge was determined.

14. Design Advantages

The pricing engine has the following characteristics:

Admin configurable

Base rates, per-kg rates and COD surcharges are stored in the database
and managed through the admin rate-card functionality.

B2B/B2C separation

Different pricing can be configured independently for B2B and B2C
orders.

Intra/inter separation

Shipments within the same zone use the intra rate card, while shipments
between different zones use the inter rate card.

Weight-aware pricing

The higher of actual and volumetric weight is used as the chargeable
weight.

COD-aware pricing

COD surcharge is applied only to COD orders.

Server-side authority

The final pricing calculation is performed by the backend rather than
trusting a client-provided delivery charge.

15. Formula Summary

The complete calculation can be summarized as:

Volumetric Weight
= (L × B × H) / 5000
Chargeable Weight
= max(Actual Weight, Volumetric Weight)
Delivery Fee
= Base Rate + (Chargeable Weight × Per KG Rate)
COD Surcharge
= Configured COD Surcharge, if payment method = COD
= 0, otherwise
Total Delivery Charge
= Delivery Fee + COD Surcharge

The rate card is selected using:

Rate Type + Order Type + Active Rate Card

where:

Same pickup and delivery zone -> intra
Different pickup and delivery zones -> inter