# Data Management Guide - Creekside Apartments System

## Overview
This guide covers duplicate prevention, bulk imports, and data truncation features.

---

## 🔒 USER ROLES

### Superuser
- **First registered user automatically becomes SUPERUSER**
- Can truncate ALL units and tenants
- Can delete individual records
- Can import data without restrictions

### Manager
- Can create/edit individual tenants and units
- Can import data
- **Cannot truncate data**
- Can delete individual records

---

## 📤 BULK IMPORT - DUPLICATE PREVENTION

### How It Works
1. When you import data, the system checks for **duplicates BEFORE importing**
2. Duplicates are **SKIPPED** (not added again)
3. You see a report showing:
   - ✅ Successfully imported
   - ⚠️ Duplicates skipped
   - ❌ Errors encountered

### Tenant Duplicate Check
**Duplicates are detected by:** `Name + Unit` combination

**Example:**
```
First Import: John Doe, Unit 100-1 ✅ Added
Second Import: John Doe, Unit 100-1 ⚠️ Duplicate Skipped (already exists)
Second Import: John Doe, Unit 100-2 ✅ Added (different unit)
```

### Unit Duplicate Check
**Duplicates are detected by:** `Unit Number` (exact match)

**Example:**
```
First Import: Unit 100-1 ✅ Added
Second Import: Unit 100-1 ⚠️ Duplicate Skipped
Second Import: Unit 100-2 ✅ Added
```

---

## 📊 IMPORT RESULTS

After each import, you'll see:

```
✅ Import Complete!
✅ 50 imported
⚠️ 5 duplicates skipped
❌ 2 errors

Refreshing data...
```

### Legend
- **✅ Imported** = Successfully added new records
- **⚠️ Duplicates** = Records already exist (skipped)
- **❌ Errors** = Invalid data or other issues

---

## 🗑️ DATA TRUNCATION (SUPERUSER ONLY)

### What is Truncation?
**Truncation = Delete ALL records of a type**

- Deletes ALL tenants OR ALL units (your choice)
- **CANNOT be undone**
- Requires **SUPERUSER role** only

### Steps to Truncate

#### 1️⃣ Navigate to Tenants or Units
- Click: **👥 Tenants** or **🏠 Units**
- Superusers will see red button: **🗑️ Truncate All**

#### 2️⃣ Click Truncate Button
- Button only shows for superusers
- Non-superusers won't see the button

#### 3️⃣ Confirm in Prompt
- System asks you to type confirmation:
  - For Tenants: **"DELETE ALL TENANTS"**
  - For Units: **"DELETE ALL UNITS"**

#### 4️⃣ Confirm Deletion
- Shows count of records to be deleted
- Example: "This will DELETE ALL 91 TENANTS!"
- Type exact phrase to confirm
- Click OK

#### 5️⃣ Done
- All records deleted
- System refreshes automatically
- You'll see empty tables

---

## ⚠️ IMPORTANT WARNINGS

### Backup Before Truncating
```
ALWAYS export your data before truncating!
1. Download CSV template
2. Copy-paste current data
3. Save backup file
```

### Cannot Undo Truncation
- ❌ No undo button
- ❌ No recovery from trash
- ❌ Data is permanently gone
- ✅ Only restore from backup

### Who Can Truncate?
- ✅ Superusers (first registered user)
- ❌ Managers cannot truncate
- ❌ Non-authenticated users cannot access

---

## 👤 IDENTIFYING SUPERUSER

### In Header
- **Superuser displays:** "Name 👑 SUPERUSER"
- **Regular user displays:** "Name" only

### In Buttons
- **Superuser sees:** Red "🗑️ Truncate All" buttons
- **Regular user sees:** These buttons hidden

---

## 🚀 WORKFLOW EXAMPLE

### Scenario: Starting Fresh with New Data

**Step 1: Backup Old Data**
```
(if you have data to save)
1. Go to Tenants → Download Template
2. Copy current tenant data
3. Save as "backup_tenants_2024.csv"
```

**Step 2: Truncate Old Data** (SUPERUSER ONLY)
```
1. Click 👥 Tenants
2. Click 🗑️ Truncate All (red button)
3. Type: "DELETE ALL TENANTS"
4. Click OK
→ All tenants deleted ✅
```

**Step 3: Import New Data**
```
1. Click 👥 Tenants
2. Click 📤 Import from CSV
3. Upload new_tenants.csv
4. Verify preview
5. Click "Import Tenants"
→ New tenants imported (no duplicates) ✅
```

**Step 4: Verify**
```
1. Click 📊 Dashboard
2. Check tenant count
3. All new data loaded ✅
```

---

## 🔄 DUPLICATE HANDLING BEST PRACTICES

### Before Importing
1. ✅ Check if data already exists
2. ✅ Remove duplicates from CSV first
3. ✅ Use unique email/phone per tenant (if possible)

### During Importing
1. ✅ Review import preview
2. ✅ Check duplicate count
3. ✅ Note any errors

### After Importing
1. ✅ Verify dashboard numbers
2. ✅ Check specific records
3. ✅ Fix any missing data

---

## 📋 CSV REQUIREMENTS

### Tenants CSV
```csv
name,unit,email,phone,status,lease_start,lease_end
John Doe,100-1,john@example.com,555-1234,CURRENT,2023-01-01,2025-01-01
Jane Smith,100-2,jane@example.com,555-5678,CURRENT,2023-06-01,2025-06-01
```

**Duplicate Detection:** `name` + `unit` combination

### Units CSV
```csv
unit_number,status
100-1,OCCUPIED
100-2,VACANT
100-3,OCCUPIED
```

**Duplicate Detection:** `unit_number` (exact match)

---

## ✅ TROUBLESHOOTING

### Issue: "Duplicates Skipped" - Why?
**Answer:** Record with same `Name + Unit` (tenants) or same `Unit Number` (units) already exists

**Solution:**
- Delete existing record first, then re-import
- OR skip duplicates and import only new records

### Issue: Some Records Failed to Import
**Answer:** Check CSV format:
- Missing required columns
- Empty name or unit fields
- Invalid date format

**Solution:**
- Fix CSV and re-import
- Use template format as guide

### Issue: "Only Superusers Can Truncate"
**Answer:** Your account is a Manager, not Superuser

**Solution:**
- Contact superuser to truncate
- OR create new account (first user = superuser)

### Issue: Truncate Button Not Showing
**Answer:** You're logged in as Manager, not Superuser

**Solution:**
- Logout and login as superuser
- OR ask superuser to do truncation

---

## 🔐 SECURITY NOTES

### Truncation Protection
- ✅ Requires exact phrase confirmation
- ✅ Superuser-only access
- ✅ Shows count before deletion
- ✅ Prevents accidental clicks

### Duplicate Prevention
- ✅ Prevents data pollution
- ✅ Automatic checking
- ✅ Non-destructive (duplicates skipped, not deleted)

### Role-Based Access
- ✅ Superuser for admin functions
- ✅ Manager for normal operations
- ✅ System prevents unauthorized actions

---

## 📞 SUPPORT

**Common Scenarios:**
1. Want to delete specific tenant/unit? → Click "Delete" button on that row
2. Want to delete ALL tenants? → Click "🗑️ Truncate All" (superuser only)
3. Want to prevent duplicates? → System does this automatically
4. Want to see import details? → Check status message after import

---

**Last Updated:** August 4, 2026
