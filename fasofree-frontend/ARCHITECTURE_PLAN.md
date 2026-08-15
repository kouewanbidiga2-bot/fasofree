# FasoFree Architecture Refactoring Plan

## 📁 File Structure Plan

### Current Structure
```
src/
├── dashboard/
│   ├── AdminDashboard.jsx
│   ├── BusinessAdminDashboard.jsx
│   ├── DashboardRouter.jsx
│   └── SuperAdminDashboard.jsx
├── services/
├── store/
├── types/
└── ...
```

### Target Structure
```
src/
├── dashboard/
│   ├── components/               # Shared dashboard components
│   │   ├── StatCard.jsx
│   │   ├── StatusBadge.jsx
│   │   ├── LoadingSkeleton.jsx
│   │   ├── OrderStatusStepper.jsx
│   │   ├── StockAlertCard.jsx
│   │   └── FinancialChart.jsx
│   ├── super-admin/              # Super Admin Dashboard
│   │   ├── SuperAdminDashboard.jsx
│   │   ├── components/
│   │   │   ├── FinancialOverview.jsx
│   │   │   ├── PlatformSettings.jsx
│   │   │   ├── MerchantValidation.jsx
│   │   │   └── AdminManagement.jsx
│   │   └── index.js
│   ├── admin/                    # Regional Admin Dashboard
│   │   ├── AdminDashboard.jsx
│   │   ├── components/
│   │   │   ├── RegionalOperations.jsx
│   │   │   ├── DisputeResolution.jsx
│   │   │   ├── MerchantValidation.jsx
│   │   │   └── PerformanceMetrics.jsx
│   │   └── index.js
│   ├── business/                 # Business Admin Dashboard
│   │   ├── BusinessAdminDashboard.jsx
│   │   ├── components/
│   │   │   ├── SalesOverview.jsx
│   │   │   ├── OrderManagement.jsx
│   │   │   ├── InventoryManager.jsx
│   │   │   ├── ProductEditor.jsx
│   │   │   ├── StockAlerts.jsx
│   │   │   └── BusinessSettings.jsx
│   │   └── index.js
│   ├── driver/                   # Driver Dashboard
│   │   ├── DriverDashboard.jsx
│   │   ├── components/
│   │   │   ├── DriverStatusToggle.jsx
│   │   │   ├── JobQueue.jsx
│   │   │   ├── DeliveryDetails.jsx
│   │   │   ├── EarningsOverview.jsx
│   │   │   └── DeliveryHistory.jsx
│   │   └── index.js
│   ├── client/                   # Client Dashboard
│   │   ├── ClientDashboard.jsx
│   │   ├── components/
│   │   │   ├── OrderTracking.jsx
│   │   │   ├── OrderHistory.jsx
│   │   │   ├── ReorderButton.jsx
│   │   │   ├── ProfileSettings.jsx
│   │   │   ├── SavedAddresses.jsx
│   │   │   └── WalletOverview.jsx
│   │   └── index.js
│   ├── DashboardRouter.jsx       # Main router with role-based logic
│   └── index.js
├── guards/                       # Route protection
│   ├── ProtectedRoute.jsx
│   └── index.js
├── services/
│   ├── inventoryService.js       # Inventory management
│   ├── orderService.js           # Enhanced order management
│   └── ...
├── store/
│   ├── authStore.js              # Enhanced with auto-routing
│   └── ...
├── types/
│   ├── inventory.js              # Inventory & product types
│   ├── roles.js                  # User roles
│   └── index.js
└── ...
```

## 🎯 Implementation Priority

### Phase 1: Core Infrastructure (Current)
1. ✅ Comprehensive type system
2. ⏳ ProtectedRoute guard
3. ⏳ Enhanced authStore with auto-routing
4. ⏳ DashboardRouter refactor

### Phase 2: Super Admin Dashboard
1. Financial overview with real-time metrics
2. Platform settings management
3. Merchant validation system
4. Admin management interface

### Phase 3: Regional Admin Dashboard
1. Regional operations overview
2. Dispute resolution system
3. Local merchant validation
4. Performance metrics

### Phase 4: Business Admin Dashboard (Refactor)
1. Sales analytics dashboard
2. Real-time order management with FSM
3. Advanced inventory management with SKU/variants
4. Stock alerts and reorder system
5. Business settings and wallet

### Phase 5: Driver Dashboard
1. Online/offline status toggle
2. Job queue with filtering
3. Delivery workflow management
4. Earnings tracking
5. Delivery history

### Phase 6: Client Dashboard
1. Real-time order tracking with stepper
2. Order history with reordering
3. Profile management
4. Saved addresses
5. Wallet overview

## 🔧 Technical Specifications

### Authentication Flow
```
1. User submits credentials at /auth
2. Backend validates and returns JWT with role claim
3. Frontend updates authStore
4. Auto-redirect to /dashboard
5. DashboardRouter analyzes role
6. ProtectedRoute validates authentication
7. Render appropriate dashboard component
```

### Inventory Management
- SKU-based product identification
- Multi-variant support (size, color, etc.)
- Automatic stock decrements on order confirmation
- Low stock alerts based on thresholds
- Reorder point notifications

### Order State Machine
```
CREATED → CONFIRMED → PREPARING → READY_FOR_PICKUP → IN_TRANSIT → DELIVERED
                     ↓               ↓                  ↓              ↓
                  CANCELLED     CANCELLED         CANCELLED     CANCELLED
```

### Component Architecture
- Functional components with hooks
- Error boundaries for resilience
- Loading states with skeletons
- TypeScript-like type checking via JSDoc
- TailwindCSS for styling
- Lucide-React for icons