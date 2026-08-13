# Marthington BMS - API Documentation

## Expense Module - Phase 3 Endpoints

Complete reference for advanced expense management features implemented in Phase 3.

---

## Table of Contents
1. [Expense Trends Analysis](#expense-trends-analysis)
2. [Expense Reconciliation Report](#expense-reconciliation-report)
3. [Budget vs. Actual Analysis](#budget-vs-actual-analysis)
4. [Link Invoice to Expense](#link-invoice-to-expense)
5. [Expense Approval Workflow](#expense-approval-workflow)
6. [Error Codes & Troubleshooting](#error-codes--troubleshooting)

---

## Expense Trends Analysis

### Endpoint
```
GET /api/expenses/trends/analysis
```

### Description
Retrieves monthly expense trends and category breakdown for the specified period. Useful for identifying spending patterns, seasonal variations, and which categories consume the most budget.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `months` | number | 6 | Number of months to analyze (3, 6, 12) |
| `category` | string | all | Filter by expense category (optional) |

### Authorization
- **Required Permission**: `canViewExpenses`
- **Required Role**: Staff, Admin, Manager
- **Access**: Business-scoped (users only see their business data)

### Request Example
```bash
curl -X GET "http://localhost:5000/api/expenses/trends/analysis?months=6&category=inventory" \
  -H "Authorization: Bearer <token>"
```

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "trend": [
      {
        "month": "Feb 2026",
        "total": 125000,
        "count": 12
      },
      {
        "month": "Mar 2026",
        "total": 145000,
        "count": 15
      },
      {
        "month": "Apr 2026",
        "total": 98000,
        "count": 8
      }
    ],
    "categoryBreakdown": [
      {
        "category": "inventory",
        "total": 450000,
        "count": 45,
        "percentage": 52.3
      },
      {
        "category": "utilities",
        "total": 85000,
        "count": 12,
        "percentage": 9.8
      },
      {
        "category": "maintenance",
        "total": 65000,
        "count": 8,
        "percentage": 7.5
      }
    ],
    "totalExpenses": 862000,
    "averageMonthly": 143667,
    "highestMonth": {
      "month": "Mar 2026",
      "total": 145000
    },
    "lowestMonth": {
      "month": "Apr 2026",
      "total": 98000
    }
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `trend[].month` | string | Month in "MMM YYYY" format |
| `trend[].total` | number | Total expenses for that month (₦) |
| `trend[].count` | number | Number of expenses recorded |
| `categoryBreakdown[].category` | string | Category name (inventory, utilities, etc.) |
| `categoryBreakdown[].total` | number | Total spent in category (₦) |
| `categoryBreakdown[].count` | number | Number of expenses in category |
| `categoryBreakdown[].percentage` | number | % of total spend (0-100) |
| `totalExpenses` | number | Sum of all expenses in period (₦) |
| `averageMonthly` | number | Average monthly spend (₦) |
| `highestMonth` | object | Peak spending month data |
| `lowestMonth` | object | Lowest spending month data |

### Use Cases
- **Forecasting**: Use average monthly spend to project cash needs
- **Budgeting**: Identify seasonal peaks for better planning
- **Performance Tracking**: Compare month-to-month spending trends
- **Category Analysis**: Drill down into which categories drive costs

### Error Responses

**400 Bad Request** - Invalid months parameter
```json
{
  "success": false,
  "error": "Months must be 3, 6, or 12"
}
```

**401 Unauthorized** - Missing/invalid token
```json
{
  "success": false,
  "error": "No token provided"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "success": false,
  "error": "You do not have permission to view expenses"
}
```

---

## Expense Reconciliation Report

### Endpoint
```
GET /api/expenses/reconciliation/report
```

### Description
Shows which expenses are matched with supplier invoices and which are pending invoice linkage. Critical for accounting accuracy and identifying unmatched supplier bills.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | string | No | Filter by category (optional) |
| `branch` | string | No | Filter by branch/location (optional) |
| `status` | string | No | "matched", "unmatched", or "all" (default: all) |

### Authorization
- **Required Permission**: `canViewExpenses`
- **Required Role**: Staff, Admin, Manager, Accountant
- **Access**: Business-scoped

### Request Example
```bash
# Get all unmatched expenses
curl -X GET "http://localhost:5000/api/expenses/reconciliation/report?status=unmatched" \
  -H "Authorization: Bearer <token>"

# Get inventory expenses matched to invoices at Lagos branch
curl -X GET "http://localhost:5000/api/expenses/reconciliation/report?category=inventory&branch=<branchId>&status=matched" \
  -H "Authorization: Bearer <token>"
```

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "matched": [
      {
        "_id": "expense123",
        "description": "Raw materials purchase",
        "amount": 85000,
        "category": "inventory",
        "date": "2026-03-15",
        "linkedInvoice": "INV-2026-001",
        "invoiceAmount": 85000,
        "status": "approved"
      }
    ],
    "unmatched": [
      {
        "_id": "expense456",
        "description": "Monthly electricity bill",
        "amount": 12500,
        "category": "utilities",
        "date": "2026-03-20",
        "linkedInvoice": null,
        "status": "pending"
      }
    ],
    "matchedTotal": 850000,
    "unmatchedTotal": 125000,
    "totalExpenses": 975000,
    "matchRate": 87.2,
    "summary": {
      "matched_count": 48,
      "unmatched_count": 7,
      "pending_approval": 3
    }
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `matched[]._id` | ObjectId | Expense document ID |
| `matched[].linkedInvoice` | string | Supplier invoice reference number |
| `matched[].invoiceAmount` | number | Amount on the linked supplier invoice (₦) |
| `unmatched[]._id` | ObjectId | Expense document ID |
| `unmatched[].linkedInvoice` | null | Always null for unmatched |
| `matchedTotal` | number | Sum of all matched expenses (₦) |
| `unmatchedTotal` | number | Sum of expenses awaiting invoice link (₦) |
| `totalExpenses` | number | Sum of matched + unmatched (₦) |
| `matchRate` | number | % of expenses with linked invoices (0-100) |
| `summary.matched_count` | number | Total matched expense records |
| `summary.unmatched_count` | number | Total unmatched expense records |
| `summary.pending_approval` | number | Expenses still awaiting approval |

### Use Cases
- **Accounts Payable**: Identify supplier invoices not yet matched
- **Period Closing**: Ensure all expenses reconciled before financial reporting
- **Audit Trail**: Verify expense documentation completeness
- **Cash Flow**: Forecast payments for unmatched invoices

### Common Reconciliation Workflows

**Weekly reconciliation check:**
```bash
curl -X GET "http://localhost:5000/api/expenses/reconciliation/report" \
  -H "Authorization: Bearer <token>"
# Review matchRate - target should be > 95%
# Review unmatched[] - follow up on missing invoices
```

**By category (e.g., find all unmatched purchases):**
```bash
curl -X GET "http://localhost:5000/api/expenses/reconciliation/report?category=purchases&status=unmatched" \
  -H "Authorization: Bearer <token>"
```

### Error Responses

**401 Unauthorized**
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

**404 Not Found** - No expenses for specified filters
```json
{
  "success": true,
  "data": {
    "matched": [],
    "unmatched": [],
    "matchRate": 0
  }
}
```

---

## Budget vs. Actual Analysis

### Endpoint
```
GET /api/expenses/budget/analysis
```

### Description
Compares budgeted expense amounts against actual spending by category. Helps identify over-budget categories and variances from planned spending.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `month` | number | Yes | Month (1-12) |
| `year` | number | Yes | Year (e.g., 2026) |
| `category` | string | No | Filter by specific category (optional) |

### Authorization
- **Required Permission**: `canViewExpenses`
- **Required Role**: Finance, Admin, Manager
- **Access**: Business-scoped

### Request Example
```bash
# Get full budget analysis for March 2026
curl -X GET "http://localhost:5000/api/expenses/budget/analysis?month=3&year=2026" \
  -H "Authorization: Bearer <token>"

# Get inventory category budget vs actual for March 2026
curl -X GET "http://localhost:5000/api/expenses/budget/analysis?month=3&year=2026&category=inventory" \
  -H "Authorization: Bearer <token>"
```

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "month": 3,
    "year": 2026,
    "totals": {
      "budget": 500000,
      "actual": 485000,
      "variance": 15000,
      "variancePercent": 3.0
    },
    "byCategory": {
      "inventory": {
        "budget": 250000,
        "actual": 280000,
        "variance": -30000,
        "variancePercent": -12.0,
        "status": "over_budget"
      },
      "utilities": {
        "budget": 85000,
        "actual": 75000,
        "variance": 10000,
        "variancePercent": 11.8,
        "status": "under_budget"
      },
      "maintenance": {
        "budget": 100000,
        "actual": 95000,
        "variance": 5000,
        "variancePercent": 5.0,
        "status": "under_budget"
      },
      "staffing": {
        "budget": 65000,
        "actual": 35000,
        "variance": 30000,
        "variancePercent": 46.2,
        "status": "under_budget"
      }
    },
    "overBudgetCategories": [
      "inventory"
    ],
    "overBudgetCount": 1,
    "totalVariance": 15000
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `totals.budget` | number | Total budget for all categories (₦) |
| `totals.actual` | number | Total actual spending (₦) |
| `totals.variance` | number | Budget - Actual (positive = under budget) (₦) |
| `totals.variancePercent` | number | Variance as % of budget |
| `byCategory[].budget` | number | Budgeted amount for category (₦) |
| `byCategory[].actual` | number | Actual spending for category (₦) |
| `byCategory[].variance` | number | Budget - Actual (positive = under) (₦) |
| `byCategory[].variancePercent` | number | Variance % (negative = over budget) |
| `byCategory[].status` | string | "under_budget" or "over_budget" |
| `overBudgetCategories` | array | List of categories that exceeded budget |
| `overBudgetCount` | number | Number of categories over budget |
| `totalVariance` | number | Overall budget variance (₦) |

### Interpretation Guide

| Scenario | Variance | Meaning |
|----------|----------|---------|
| `variance: 15000, variancePercent: 3.0` | Positive | Category is **3% UNDER budget** - Good spending control |
| `variance: -30000, variancePercent: -12.0` | Negative | Category is **12% OVER budget** - Action needed |
| `variance: 0, variancePercent: 0` | Zero | Category is **on budget** - Perfect |

### Use Cases
- **Budget Monitoring**: Track spending against approved budgets
- **Cost Control**: Alert managers when categories exceed limits
- **Variance Analysis**: Understand why actual != budgeted
- **Financial Planning**: Use variance data for next period budgets
- **Performance Review**: Assess department spending discipline

### Common Budget Queries

**Monthly CFO check:**
```bash
curl -X GET "http://localhost:5000/api/expenses/budget/analysis?month=3&year=2026" \
  -H "Authorization: Bearer <token>"
# Check overBudgetCount - alert if > 0
# Review overBudgetCategories for corrective action
```

**Track specific category performance:**
```bash
curl -X GET "http://localhost:5000/api/expenses/budget/analysis?month=3&year=2026&category=inventory" \
  -H "Authorization: Bearer <token>"
# If variancePercent < -5%, investigate overages
```

### Error Responses

**400 Bad Request** - Missing required parameters
```json
{
  "success": false,
  "error": "Month and year are required"
}
```

**400 Bad Request** - Invalid month
```json
{
  "success": false,
  "error": "Month must be between 1 and 12"
}
```

---

## Link Invoice to Expense

### Endpoint
```
POST /api/expenses/:id/link-invoice
```

### Description
Associates a supplier invoice with an expense record for reconciliation. This links the expense document to the corresponding invoice from your supplier, ensuring proper accounting trail and reconciliation.

### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | ObjectId | Expense document ID |

### Request Body

```json
{
  "invoiceId": "INV-2026-001"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `invoiceId` | string | Yes | Supplier invoice reference number or ID |

### Authorization
- **Required Permission**: `canManageExpenses`
- **Required Role**: Admin, Finance Manager
- **Access**: Business-scoped (can only modify own business expenses)

### Request Example
```bash
curl -X POST "http://localhost:5000/api/expenses/expense123/link-invoice" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "INV-2026-001"
  }'
```

### Response (200 OK)
```json
{
  "success": true,
  "message": "Invoice linked successfully",
  "data": {
    "_id": "expense123",
    "description": "Raw materials purchase",
    "amount": 85000,
    "linkedInvoice": "INV-2026-001",
    "status": "approved",
    "linkedAt": "2026-03-20T10:15:00.000Z"
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `linkedInvoice` | string | The invoice ID that was linked |
| `linkedAt` | ISO string | Timestamp when invoice was linked |
| `status` | string | Current expense status (pending/approved/rejected) |

### Use Cases
- **Reconciliation**: Link expenses to supplier invoices after receipt
- **Payment Tracking**: Verify expenses before processing AP payments
- **Audit Trail**: Create documented link between expense and invoice
- **Duplicate Prevention**: Avoid paying same invoice twice

### Workflow Example

**Typical monthly reconciliation process:**
```
1. Supplier sends Invoice INV-2026-001 for ₦85,000
2. Finance logs expense: "Raw materials - ₦85,000"
3. Finance links: POST /expenses/exp123/link-invoice (invoiceId: INV-2026-001)
4. System confirms match
5. Finance approves expense: POST /expenses/exp123/approve
6. Expense ready for payment
```

### Error Responses

**404 Not Found** - Expense doesn't exist
```json
{
  "success": false,
  "error": "Expense not found"
}
```

**400 Bad Request** - Invalid request body
```json
{
  "success": false,
  "error": "invoiceId is required"
}
```

**403 Forbidden** - User lacks permission
```json
{
  "success": false,
  "error": "You do not have permission to modify expenses"
}
```

**409 Conflict** - Expense already linked to different invoice
```json
{
  "success": false,
  "error": "This expense is already linked to a different invoice"
}
```

---

## Expense Approval Workflow

### Approve Expense

#### Endpoint
```
POST /api/expenses/:id/approve
```

#### Description
Marks a pending expense as approved by an administrator. Approved expenses are typically counted in profit calculations and reports.

#### Request Example
```bash
curl -X POST "http://localhost:5000/api/expenses/expense123/approve" \
  -H "Authorization: Bearer <token>"
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Expense approved",
  "data": {
    "_id": "expense123",
    "description": "Office supplies",
    "amount": 5000,
    "status": "approved",
    "approvedBy": "user456",
    "approvedAt": "2026-03-20T10:15:00.000Z"
  }
}
```

#### Authorization
- **Required Permission**: `canManageExpenses`
- **Required Role**: Admin, Finance Manager
- **Access**: Business-scoped

---

### Reject Expense

#### Endpoint
```
POST /api/expenses/:id/reject
```

#### Description
Marks a pending expense as rejected by an administrator. Rejected expenses are excluded from reports and profit calculations.

#### Request Example
```bash
curl -X POST "http://localhost:5000/api/expenses/expense123/reject" \
  -H "Authorization: Bearer <token>"
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Expense rejected",
  "data": {
    "_id": "expense123",
    "description": "Unauthorized purchase",
    "amount": 15000,
    "status": "rejected",
    "rejectedBy": "user456",
    "rejectedAt": "2026-03-20T10:15:00.000Z"
  }
}
```

#### Use Cases
- **Approval workflow**: Admin reviews pending expenses before counting them
- **Expense control**: Reject unauthorized or policy-violating expenses
- **Audit trail**: Track who approved/rejected each expense

---

## Error Codes & Troubleshooting

### Common HTTP Status Codes

| Status | Code | Meaning | Example |
|--------|------|---------|---------|
| 200 | OK | Request succeeded | Expense data returned |
| 400 | Bad Request | Invalid parameters | Missing required fields |
| 401 | Unauthorized | Missing/invalid token | No authorization header |
| 403 | Forbidden | Insufficient permissions | User lacks canViewExpenses |
| 404 | Not Found | Resource doesn't exist | Expense ID not found |
| 409 | Conflict | Operation conflict | Invoice already linked |
| 500 | Server Error | Internal error | Database connection failed |

### Authentication Troubleshooting

**Problem**: "No token provided"
```json
{
  "success": false,
  "error": "No token provided"
}
```
**Solution**: Include Authorization header:
```bash
curl -H "Authorization: Bearer <your_jwt_token>"
```

**Problem**: "Invalid or expired token"
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```
**Solution**: 
- Generate new token via login endpoint
- Token expires after 7 days (check backend config)
- Verify token was not modified

### Permission Troubleshooting

**Problem**: "You do not have permission"
```json
{
  "success": false,
  "error": "You do not have permission to view expenses"
}
```
**Solution**:
- Verify user role has `canViewExpenses` permission
- Check user is assigned to correct role (Staff, Admin, Manager)
- Confirm business assignment (users only see their business data)

**Typical permissions by role:**
- **Admin**: All expense operations
- **Finance Manager**: Can approve, create, view all
- **Manager**: Can create, view their branch
- **Staff**: Can create their own, view (read-only)

### Data Validation Errors

**Problem**: "Month must be between 1 and 12"
```bash
# WRONG
curl -X GET "http://localhost:5000/api/expenses/budget/analysis?month=13&year=2026"

# CORRECT
curl -X GET "http://localhost:5000/api/expenses/budget/analysis?month=3&year=2026"
```

**Problem**: "Months must be 3, 6, or 12"
```bash
# WRONG
curl -X GET "http://localhost:5000/api/expenses/trends/analysis?months=5"

# CORRECT
curl -X GET "http://localhost:5000/api/expenses/trends/analysis?months=6"
```

### Performance Tips

**For large businesses with many expenses:**
- Use `category` filter to narrow results
- Use `branch` filter for multi-location queries
- Avoid fetching full year trends (limit to 6 months)
- Cache reconciliation reports (changes only when expenses linked)

**Example - Fast budget check:**
```bash
# Slow: All expenses for all categories
curl "http://localhost:5000/api/expenses/budget/analysis?month=3&year=2026"

# Fast: Just inventory category
curl "http://localhost:5000/api/expenses/budget/analysis?month=3&year=2026&category=inventory"
```

---

## Integration Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';
const token = 'your_jwt_token';

const headers = { Authorization: `Bearer ${token}` };

// Get expense trends
async function getTrends() {
  const res = await axios.get(`${API_BASE}/expenses/trends/analysis?months=6`, { headers });
  console.log(res.data.data.trend);
}

// Link invoice to expense
async function linkInvoice(expenseId, invoiceId) {
  const res = await axios.post(
    `${API_BASE}/expenses/${expenseId}/link-invoice`,
    { invoiceId },
    { headers }
  );
  console.log('Linked:', res.data.data);
}

// Get budget analysis
async function getBudgetAnalysis() {
  const res = await axios.get(
    `${API_BASE}/expenses/budget/analysis?month=3&year=2026`,
    { headers }
  );
  console.log(res.data.data.byCategory);
}
```

### React/Frontend

```javascript
import { useState, useEffect } from 'react';

export function ExpenseAnalytics() {
  const [trends, setTrends] = useState(null);
  const [budget, setBudget] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);

  useEffect(() => {
    // Fetch all analytics in parallel
    Promise.all([
      fetch('/api/expenses/trends/analysis?months=6').then(r => r.json()),
      fetch('/api/expenses/budget/analysis?month=3&year=2026').then(r => r.json()),
      fetch('/api/expenses/reconciliation/report').then(r => r.json())
    ]).then(([trendsRes, budgetRes, reconcRes]) => {
      setTrends(trendsRes.data);
      setBudget(budgetRes.data);
      setReconciliation(reconcRes.data);
    });
  }, []);

  return (
    <div>
      <h2>Trends: {trends?.totalExpenses}</h2>
      <h2>Match Rate: {reconciliation?.matchRate}%</h2>
      <h2>Over Budget: {budget?.overBudgetCount}</h2>
    </div>
  );
}
```

---

## Support & Questions

For issues or questions:
1. Check error codes section above
2. Verify authentication/permissions
3. Check parameter validation
4. Review business/branch scope
5. Contact: support@marthingtonbms.com

