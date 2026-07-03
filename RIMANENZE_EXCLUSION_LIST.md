# ✅ Rimanenze Exclusion List - Implemented

## 🎯 What Was Added

A configurable exclusion list in `constants.ts` to filter out specific orders from both rimanenze dashboards.

---

## 📍 Location

**File**: `src/config/constants.ts`

**Section**: `APP_CONFIG.ANALYTICS.RIMANENZE_EXCLUDED_ORDERS`

```typescript
RIMANENZE_EXCLUDED_ORDERS: ['9994', '9993', '9990', '9998', '9997'] as string[],
```

---

## 🔧 How It Works

### **Orders in the Exclusion List**:
- **9994**
- **9993**
- **9990**
- **9998**
- **9997**

These orders will be **automatically excluded** from:
1. ✅ Rimanenze (Materiali) dashboard
2. ✅ Rimanenze (Lavoro) dashboard
3. ✅ Summary statistics
4. ✅ Excel exports
5. ✅ Pagination counts

---

## ✏️ How to Edit

### **To Add More Orders**:

Open `src/config/constants.ts` and edit the array:

```typescript
RIMANENZE_EXCLUDED_ORDERS: ['9994', '9993', '9990', '9998', '9997', '9999', '9996'] as string[],
```

### **To Remove Orders**:

Just delete them from the array:

```typescript
RIMANENZE_EXCLUDED_ORDERS: ['9994', '9993'] as string[],
```

### **Format**:
- Use **4-digit commessa display format** (e.g., '9994', not '259994')
- Wrap each order in **single quotes**
- Separate with **commas**
- Keep the `as string[]` at the end

---

## 📊 What Gets Excluded

### **Example**:

**Before Exclusion**:
- Total orders: 10
- Order 9994: €500 materials
- Order 9993: €300 materials
- Other orders: €7,000 materials
- **Total: €7,800**

**After Exclusion**:
- Total orders: 8 (9994 and 9993 excluded)
- **Total: €7,000** (only non-excluded orders)

---

## 🎯 Use Cases

### **Why Exclude Orders?**

1. **Internal Orders**: Test orders, samples, internal projects
2. **Special Cases**: Orders that shouldn't count as inventory
3. **Accounting Adjustments**: Orders with special accounting treatment
4. **Data Cleanup**: Remove noise from reports

---

## ✅ Applied To

### **Rimanenze (Materiali)**:
- ✅ Main table data
- ✅ Summary statistics
- ✅ Excel export
- ✅ Pagination count

### **Rimanenze (Lavoro)**:
- ✅ Main table data
- ✅ Summary statistics
- ✅ Excel export
- ✅ Pagination count

---

## 🧪 Testing

### **Test the Exclusion**:

1. Go to: http://localhost:3000/analytics/rimanenze
2. Search for order "9994"
3. **Result**: Should NOT appear in results
4. Check summary: Should NOT include excluded orders

### **Verify Exclusion Works**:

1. Note the current total orders count
2. Add a new order to exclusion list
3. Refresh dashboard
4. Total orders count should decrease by 1

---

## 📝 Current Excluded Orders

As of now, these orders are excluded:

| Order | Reason |
|-------|--------|
| 9994 | (Add reason here) |
| 9993 | (Add reason here) |
| 9990 | (Add reason here) |
| 9998 | (Add reason here) |
| 9997 | (Add reason here) |

**Note**: You can add comments in the code to document why each order is excluded.

---

## 💡 Pro Tip

Keep a comment in `constants.ts` explaining why orders are excluded:

```typescript
// Rimanenze Exclusion List
// Order numbers to exclude from rimanenze reports
// 9994 - Internal test order
// 9993 - Sample production
// 9990 - Accounting adjustment
// 9998 - Special project
// 9997 - Internal use
RIMANENZE_EXCLUDED_ORDERS: ['9994', '9993', '9990', '9998', '9997'] as string[],
```

This helps future maintenance!

---

## ✅ Ready to Use

The exclusion list is now active in both dashboards. Edit `constants.ts` anytime to add/remove orders!
