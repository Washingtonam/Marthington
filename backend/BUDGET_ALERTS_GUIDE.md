# Email Budget Alerts Implementation Guide

## Overview

The system now automatically monitors expense budgets and sends email alerts to finance administrators when spending exceeds budgeted amounts.

---

## How It Works

### 1. **Automatic Budget Monitoring**

When a staff member creates an expense:
```
Expense Created → Budget Check → Over Budget? → Send Alert Email
                                      ↓ (No)
                                   No Action
```

### 2. **Alert Triggers**

Alerts are sent when:
- Monthly expenses in ANY category exceed 5%+ over budget
- Multiple categories are over budget in same month
- Priority categories (Salaries, Rent, Inventory) exceed budget

### 3. **Who Receives Alerts**

**By default:**
- Business Owner (always notified)
- Super Admin (always notified)
- Finance Managers (for warnings)

**Customizable per business** via user preferences

---

## Backend Implementation

### Files Modified

1. **`backend/src/utils/emailService.js`**
   - Added `sendBudgetExceededEmail()` function
   - Sends formatted HTML email with:
     - Over-budget categories with amounts
     - Variance breakdown
     - Recommended actions
     - Link to expenses dashboard

2. **`backend/src/modules/expenses/expense.controller.js`**
   - Added `checkAndAlertBudgetExceeded()` helper
   - Automatically called after expense creation
   - Calculates category-level budget variances
   - Identifies admin users and sends alerts

3. **`backend/src/config/budgetAlerts.js`** (NEW)
   - `BUDGET_ALERT_CONFIG` - Centralized alert settings
   - `getSeverityLevel()` - Categorize overage severity
   - `shouldTriggerAlert()` - Determine if alert needed
   - Configurable thresholds and cooldowns

### Budget Check Logic

```javascript
// In expense.controller.js
const checkAndAlertBudgetExceeded = async (businessId, month, year) => {
  // 1. Get all expenses for the month
  const expenses = Expense.find({ 
    business: businessId,
    date: { $gte: monthStart, $lte: monthEnd }
  });

  // 2. Group by category and sum
  categorySpending = {
    inventory: 450000,
    salaries: 320000,
    utilities: 85000
  };

  // 3. Compare against budgets
  IF actual > budget THEN
    variance = actual - budget
    variancePercent = (variance / budget) * 100
    IF variancePercent >= 5% THEN
      overBudgetList.add(category)

  // 4. Send email to admins with list
  IF overBudgetList.length > 0 THEN
    sendBudgetExceededEmail(overBudgetList)
};
```

### Alert Configuration

Edit `backend/src/config/budgetAlerts.js` to customize:

```javascript
// Alert when expenses exceed budget by this %
ALERT_THRESHOLD_PERCENT: 5,  // Change to 10 for less frequent alerts

// Categories that always alert admins
PRIORITY_CATEGORIES: [
  "salaries",      // Payroll is critical
  "rent",          // Fixed commitments
  "inventory"      // Major expense
],

// Don't send duplicate alerts within N hours
ALERT_COOLDOWN_HOURS: 24,

// Max emails per business per day (prevent spam)
MAX_ALERTS_PER_DAY: 5
```

---

## Frontend Implementation

### Expense Form - Budget Allocation Field

When creating/editing expenses, users can set budget:

```jsx
<input
  type="number"
  placeholder="Budget Allocation (Optional)"
  value={formData.budgetAllocation}
  onChange={(e) => setFormData({...formData, budgetAllocation: e.target.value})}
/>
```

**Purpose**: Track individual expense budgets for category-level aggregation

### Budget Analysis Tab

Displays:
- Total budget vs actual spend
- Category breakdown with variances
- Over-budget categories highlighted in RED
- Variance percentages and amounts

---

## Email Alert Format

### Subject Line
```
Budget Alert: Expenses exceeding budget for 03/2026
```

### Email Body

```
⚠️ Budget Alert - 03/2026

Hello Ahmed,

Marthington Health has exceeded its budget for 03/2026.

Total Overspend: ₦45,000

Category | Budget    | Actual     | Variance
---------|-----------|------------|------------------
Inventory| ₦250,000  | ₦280,000   | +₦30,000 (12.0%)
Salaries | ₦200,000  | ₦210,000   | +₦10,000 (5.0%)

Recommended Actions:
• Review expense approvals for the month
• Identify cost-saving opportunities
• Adjust budget for upcoming months if needed
• Prioritize essential expenses only

[Review Expenses Dashboard Button]
```

---

## Email Delivery

### Requirements

1. **SMTP Configuration** (in `.env`)
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=app-specific-password
   SMTP_FROM=noreply@marthingtonbms.com
   ```

2. **User Email** - Users must have email address in system
   - Staff profile must have email field populated
   - Admins with missing emails are silently skipped

3. **Frontend URL** - Set in `.env`
   ```
   FRONTEND_URL=https://bms.marthington.com
   ```
   (Used for "View Expenses" link in email)

### Email History Tracking

All budget alert emails are logged in `EmailHistory` collection:
```javascript
{
  business: ObjectId,
  recipientEmail: "ahmed@marthington.com",
  subject: "Budget Alert: Expenses exceeding budget for 03/2026",
  emailType: "budget_exceeded",
  status: "sent",  // or "failed"
  sentAt: 2026-03-20T10:15:00.000Z,
  metadata: {
    month: "03",
    year: 2026,
    categoriesCount: 2,
    totalVariance: 45000,
    overBudgetCategories: ["inventory", "salaries"]
  }
}
```

---

## Testing the Feature

### 1. Manual Test

**Setup:**
```bash
# 1. Create expense with budget allocation
POST /api/expenses
{
  "description": "Inventory purchase",
  "amount": 150000,
  "category": "inventory",
  "budgetAllocation": 100000,  // ← Set lower than amount
  "date": "2026-03-15"
}

# 2. Check if admin received email
# 3. View expense in dashboard
GET /api/expenses/budget/analysis?month=3&year=2026
```

### 2. API Test

```bash
# Get budget analysis showing over-budget
curl -X GET "http://localhost:5000/api/expenses/budget/analysis?month=3&year=2026" \
  -H "Authorization: Bearer <token>"

# Response shows:
# "overBudgetCount": 2
# "categories": {
#   "inventory": { "actual": 280000, "budget": 250000, "variance": -30000 }
# }
```

### 3. Email History Check

```bash
# View all budget alert emails sent
db.emailhistories.find({ 
  emailType: "budget_exceeded",
  business: ObjectId("...")
})
```

---

## Disable/Customize Alerts

### Option 1: Disable Entirely

In `backend/src/modules/expenses/expense.controller.js`:
```javascript
// Comment out this line to disable alerts
// checkAndAlertBudgetExceeded(businessId, month, year, req.user.id);
```

### Option 2: Change Alert Threshold

In `backend/src/config/budgetAlerts.js`:
```javascript
// Only alert if 15%+ over budget (instead of 5%)
ALERT_THRESHOLD_PERCENT: 15,
```

### Option 3: Exclude Categories

```javascript
// Don't alert for these categories even if over budget
EXCLUDED_CATEGORIES: ["miscellaneous", "utilities"],
```

### Option 4: Restrict Recipients

```javascript
// Only send to super_admin (not managers)
ALERT_RECIPIENTS: {
  WARNING: ["super_admin"],
  MODERATE: ["owner", "super_admin"],
  CRITICAL: ["owner", "super_admin"]
}
```

---

## Troubleshooting

### Alerts Not Sending

1. **Check SMTP Configuration**
   ```bash
   # Test email config
   curl -X POST http://localhost:5000/api/test-email \
     -H "Authorization: Bearer <token>"
   ```

2. **Verify Admin Email**
   - Users must have `email` field populated in database
   - Super Admin role is assigned
   - Check `EmailHistory` for failed sends:
   ```javascript
   db.emailhistories.find({ 
     status: "failed",
     emailType: "budget_exceeded"
   }).sort({ _id: -1 }).limit(5)
   ```

3. **Check Logs**
   ```bash
   # Look for budget check logs
   tail -f logs/error.log | grep "Budget alert"
   ```

### Over-Budget Categories Not Showing

1. **Verify Budget Allocation Set**
   - Expense must have `budgetAllocation > 0`
   - Check database: `db.expenses.findOne({ _id: ... })`

2. **Check Date Range**
   - Expenses must be created in same calendar month
   - Budget check uses month from expense.date

3. **Threshold Check**
   - Variance must be >= 5% (default)
   - Formula: `(actual - budget) / budget * 100 >= 5`

---

## Performance Considerations

### Alert Frequency

- **Non-blocking**: Budget check runs asynchronously after expense creation
- **No impact** on expense creation response time
- If alert send fails, error is logged but expense still created

### Email Rate Limiting

- Maximum 5 alerts per business per day
- 24-hour cooldown per category (prevents spam)
- Can be adjusted in `budgetAlerts.js`

### Database Queries

- Uses indexed queries on `{ business, date }`
- Runs only for current month (limited data)
- Sub-100ms for typical business (< 1000 expenses/month)

---

## Future Enhancements

1. **User Preferences**
   - Allow admins to opt-in/out of alerts
   - Customize alert frequency (real-time, daily, weekly)
   - Alert threshold per business

2. **Smart Alerts**
   - Machine learning to detect anomalies
   - Seasonal adjustment for recurring expenses
   - Variance trending (improving vs worsening)

3. **Slack Integration**
   - Send budget alerts to Slack channel
   - Quick approval/rejection workflow
   - Team notification consolidation

4. **Mobile Push Notifications**
   - iOS/Android push for critical alerts
   - In-app notification center
   - Read/unread tracking

---

## API Reference

### Email Budget Alert Email Function

```javascript
await sendBudgetExceededEmail({
  recipientEmail: "admin@business.com",
  recipientName: "Ahmed",
  businessName: "Marthington Health",
  businessId: ObjectId("..."),
  month: "03",              // MM format
  year: 2026,
  categories: [
    {
      label: "Inventory/Stock",
      budget: 250000,
      actual: 280000,
      variance: 30000,      // Overage amount
      variancePercent: 12.0
    }
  ],
  totalVariance: 30000,     // Total overage
  expensesUrl: "https://bms.com/expenses",
  createdBy: userId
});
```

### Budget Check Function

```javascript
await checkAndAlertBudgetExceeded(
  businessId,   // Which business to check
  month,        // Month number (1-12)
  year,         // Year (2026)
  userId        // Who triggered the check
);
// Internally:
// 1. Fetches expenses for month
// 2. Calculates category totals
// 3. Compares against budgets
// 4. Sends emails to admins if over budget
```

---

## Support

For issues or questions about budget alerts:
1. Check logs in `EmailHistory` collection
2. Review `budget/analysis` endpoint response
3. Verify SMTP configuration in `.env`
4. Contact: support@marthingtonbms.com

