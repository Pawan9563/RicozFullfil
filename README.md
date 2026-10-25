# RicozFulfil - Enterprise Fulfillment Management Platform

RicozFulfil is an enterprise fulfillment management platform built with the MERN stack (MongoDB, Express, React, Node.js), conceptually inspired by Zoho Inventory's fulfillment module.

---

## Order Lifecycle

```
Primary Path:
ORDER CREATED → CONFIRMED → INVENTORY CHECK → WAREHOUSE ALLOCATION → 
PICK LIST CREATED → PICKING → PICKED → PACKING → PACKED → 
SHIPMENT CREATED → CARRIER ASSIGNED → DISPATCHED → IN TRANSIT → 
OUT FOR DELIVERY → DELIVERED

Alternate Paths:
- CANCELLED (allowed from early lifecycle stages)
- FAILED DELIVERY (allowed from OUT FOR DELIVERY)
- RETURN REQUESTED → APPROVED → PICKUP SCHEDULED → RETURN IN TRANSIT → 
  RECEIVED → INSPECTED → REFUNDED / REPLACED
```

---

## User Roles & Permissions

- **Super Admin**: System-wide administrative access, user management, global configuration.
- **Admin**: Fulfillment operations supervision, warehouse setup, operational analytics.
- **Operations Manager**: Order lifecycle governance, carrier management, return approval.
- **Warehouse Manager**: Inventory control, stock transfers, pick list dispatch, packaging oversight.
- **Picker**: Picking terminal, item scanning, pick list completion (`PICKING` → `PICKED`).
- **Packer**: Packing bench, package dimension/weight entry (`PACKING` → `PACKED`).

---

## Non-Negotiable Architectural Rules

1. **Order State Machine**: Every order status transition MUST validate against `backend/src/utils/orderStateMachine.js`. Direct status jumps are strictly prohibited.
2. **Atomic Inventory Operations**: All inventory quantity updates (available, reserved, damaged, returned) MUST use atomic MongoDB operations (`findOneAndUpdate` with `$inc` and guard conditions) to prevent race conditions.
3. **Embedded Documents**:
   - `Order` embeds `orderItems` and `statusHistory`.
   - `PickList` embeds `pickListItems`.
   - `Return` embeds `returnItems`.
4. **Audit Trails**: Orders maintain a `statusHistory` array. Shipments maintain granular timeline events in the `trackingEvents` collection.
5. **Chai aur Code Pattern**: `controllers/` + `models/` + `routes/` + `middlewares/` + `utils/` with `ApiError`, `ApiResponse`, and `asyncHandler` wrappers.

---

## 50/50 Implementation Division

### What is Implemented (Scaffolding & Architecture)
- Complete directory structure and ES module architecture.
- 14 Mongoose models with validation, embedded schemas, and indexes.
- Utility layer: `ApiError`, `ApiResponse`, `asyncHandler`, `orderStateMachine`, `inventoryHelpers`.
- Middleware: JWT `auth.middleware`, RBAC `role.middleware`, `multer.middleware`, and centralized `error.middleware`.
- Route wiring for 11 sub-modules with role guards.
- Controller boilerplate wrapped in `asyncHandler` with input extraction, validation checks, and descriptive `TODO(rico)` blocks with implementation hints.
- Frontend architecture: Vite + React, React Router with `ProtectedRoute` and `RoleRoute`, `AuthContext`, centralized Axios service stubs (`services/api.js`), layout and UI design system, and all 13 page skeletons.

### What is Left for Rico (Business Logic & Frontend Interactivity)
- Implementing atomic inventory queries in `utils/inventoryHelpers.js` and controllers.
- Implementing state transition checks using `orderStateMachine.js` inside `order.controller.js`.
- Implementing pick list generation and assignment logic in `pickList.controller.js`.
- Implementing return inspection and stock disposition in `return.controller.js`.
- Connecting frontend form submit handlers and API calls in page components.
- Providing actual credentials in `.env` (copied from `.env.sample`).

---

## Getting Started

### 1. Backend Setup

```bash
cd RicozFulfil/backend
npm install
cp .env.sample .env
# Edit .env and supply your local MongoDB URI and JWT secrets
npm run dev
```

### 2. Frontend Setup

```bash
cd RicozFulfil/frontend
npm install
cp .env.sample .env
# Verify VITE_API_BASE_URL (defaults to http://localhost:8000/api/v1)
npm run dev
```
