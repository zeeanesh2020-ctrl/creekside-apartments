# NOTICE TEMPLATES - CSV IMPORT GUIDE
## How to Bulk Upload Notice Templates from Spreadsheet

**Date:** August 2026  
**Application:** Creekside Apartments Management System  
**Version:** 1.0  

---

## TABLE OF CONTENTS

1. Quick Start (5 minutes)
2. CSV Format Specifications
3. Step-by-Step Guide
4. Example CSV Files
5. Excel to CSV Conversion
6. Troubleshooting Common Issues
7. Sample Templates (Ready to Use)

---

## 🚀 QUICK START (5 MINUTES)

### Method 1: Download & Edit Template

```
1. Go to: 📋 Notice Templates page
2. Click: "📥 Download Template"
3. Opens: notice_templates_template.csv
4. Edit in: Excel, Google Sheets, or any text editor
5. Save as: CSV format (NOT Excel)
6. Upload: Click "📤 Import from CSV"
7. Select file
8. Review preview
9. Click "Import Templates"
✅ Done!
```

### Method 2: Create CSV from Scratch

```
1. Open Excel or Google Sheets
2. Copy this header row:
   name,notice_type,subject,content
3. Add your templates (one per row)
4. Save as CSV format
5. Upload to application
✅ Done!
```

---

## 📋 CSV FORMAT SPECIFICATIONS

### File Format
- **Format:** CSV (Comma-Separated Values)
- **Encoding:** UTF-8
- **First Row:** HEADERS (must match exactly)
- **Data Rows:** Your templates (one per row)

### Column Definitions

```
REQUIRED COLUMNS:
├─ name (VARCHAR 255)
│  └─ Template name (e.g., "30-Day Notice to Quit")
│
├─ notice_type (VARCHAR 100)
│  └─ Type identifier (e.g., "30_DAY_NOTICE")
│
└─ content (TEXT)
   └─ Full template text (can use variables like {tenant_name})

OPTIONAL COLUMNS:
└─ subject (VARCHAR 255)
   └─ Email subject line (if emailing notice)
```

### Valid Notice Types

```
30_DAY_NOTICE .......................... 30-Day Notice to Quit
60_DAY_NOTICE .......................... 60-Day Notice to Quit
RENT_DUE .............................. Rent Due Reminder
RENT_LATE ............................. Rent Late Reminder
LEASE_RENEWAL ......................... Lease Renewal Notice
MAINTENANCE_ACCESS .................... Maintenance Access Notice
MAINTENANCE_NEEDED .................... Maintenance Task Notice
LEASE_VIOLATION ....................... Lease Violation Notice
EMERGENCY_MAINTENANCE ................. Emergency Entry Notice
SECURITY_DEPOSIT ...................... Deposit Return Notice
OTHER ................................ Custom/Other Notice Type
```

---

## 📝 CSV HEADER ROW

```
name,notice_type,subject,content
```

**CRITICAL:** Headers must match EXACTLY (case-sensitive, exact spelling)

**INCORRECT Examples:**
```
❌ Name,Notice_Type,Subject,Content (wrong capitalization)
❌ template_name,type,email_subject,body (wrong column names)
❌ name,notice_type,content (missing optional 'subject' is OK, but if including it, must spell correctly)
```

**CORRECT Examples:**
```
✅ name,notice_type,subject,content (all lowercase)
✅ name,notice_type,content (omitting optional subject is OK)
```

---

## 📊 CSV STRUCTURE EXAMPLES

### Example 1: Minimal (Required Fields Only)

```csv
name,notice_type,content
"30-Day Notice","30_DAY_NOTICE","Dear {tenant_name}, You are required to vacate Unit {unit} by {date}. Sincerely, Management"
"Rent Due","RENT_DUE","Your rent for Unit {unit} is due on {date}. Please submit payment promptly."
```

### Example 2: Complete (All Fields)

```csv
name,notice_type,subject,content
"30-Day Notice to Quit","30_DAY_NOTICE","Notice to Vacate Your Property","Dear {tenant_name}, This is formal notice that you must vacate the premises at Unit {unit}, {property_address}, on or before {date}. Please contact management with questions. Sincerely, Creekside Apartments Management"
"Rent Due Reminder","RENT_DUE","Your Rent is Due","This is a friendly reminder that rent for Unit {unit} is due on {date}. Amount due: {rent_amount}. Please submit payment to: {payment_address}"
"Rent Late Collection","RENT_LATE","URGENT: Rent Payment Past Due","Your rent payment for Unit {unit} is now PAST DUE. Amount owed: {rent_amount} + {late_fees}. Contact management immediately: {phone}. Failure to pay may result in eviction."
```

### Example 3: With Variables

```csv
name,notice_type,subject,content
"Standard 30-Day Notice","30_DAY_NOTICE","Notice to Quit","To: {tenant_name}
Unit: {unit}
Property: {property_address}

Dear {tenant_name},

This is formal notice that you are required to vacate the above property on or before {date} at 11:59 PM.

Please return all keys and ensure the unit is cleaned and in good condition.

Questions? Contact {management_phone} or {management_email}

Sincerely,
Creekside Apartments Management"
```

---

## 🔤 AVAILABLE TEMPLATE VARIABLES

Use these in your template content:

```
{tenant_name} ......................... Tenant's full name
{unit} ................................ Unit number (e.g., "100-1")
{property_address} .................... Full property address
{date} ................................ Current date
{rent_amount} ......................... Monthly rent amount
{late_fees} ........................... Late fee amount
{payment_address} ..................... Where to send payment
{management_phone} .................... Property phone number
{management_email} .................... Property email
{lease_start_date} .................... Lease start date
{lease_end_date} ...................... Lease end date
```

**Example with variables:**
```
Dear {tenant_name},

Your lease for Unit {unit} at {property_address} expires on {lease_end_date}. 
Your monthly rent of ${rent_amount} is due by {date}.

Please contact us at {management_phone} to discuss renewal options.

Best regards,
{management_email}
```

---

## 📋 STEP-BY-STEP UPLOAD GUIDE

### Step 1: Prepare Your Data

**Option A: Use Downloaded Template**
```
1. Click "📥 Download Template"
2. Opens: notice_templates_template.csv
3. Edit in Excel/Google Sheets
4. Add your templates
5. Save as CSV
```

**Option B: Create in Excel**
```
1. Open Excel
2. Create columns:
   | name | notice_type | subject | content |
3. Add template rows
4. Save As → Format: CSV UTF-8
```

**Option C: Use Google Sheets**
```
1. Create new Google Sheet
2. Add header row
3. Add template rows
4. File → Download → CSV (.csv)
```

### Step 2: Prepare CSV File

**In Excel:**
```
1. Open notice_templates_template.csv (downloaded)
2. Edit columns:
   - name: Your template name
   - notice_type: Select from list
   - subject: Email subject (optional)
   - content: Full template text
3. File → Save As
4. Format: CSV UTF-8 (.csv)
5. Name: my_templates.csv
```

**Important:** 
- ⚠️ Do NOT save as .xlsx (Excel format) - must be .csv
- ⚠️ Use UTF-8 encoding for special characters
- ⚠️ Keep header row exactly as specified

### Step 3: Upload File

```
1. Go to: 📋 Notice Templates page
2. Click: "📤 Import from CSV"
3. Modal opens
4. Click: "Select CSV File"
5. Choose: your_templates.csv
6. Preview appears (first 10 rows)
7. Review carefully
8. Click: "Import Templates"
9. Wait for import to complete
```

### Step 4: Verify Import

```
✅ Success message shows:
   - "✅ X imported"
   - "⚠️ X duplicates skipped"
   - "❌ X errors" (if any)

✅ Templates appear in list
✅ Can create notices using templates
```

---

## 💾 EXCEL TO CSV CONVERSION

### Windows Excel

```
1. Open Excel file
2. File → Save As
3. File name: my_templates
4. Format: CSV UTF-8 (.csv) ← SELECT THIS
5. Location: Desktop or Downloads
6. Click: Save
⚠️ Warning: You may lose formatting - OK to click
✅ File saved as: my_templates.csv
```

### Mac Excel

```
1. Open Excel file
2. File → Save As (or Cmd+Shift+S)
3. File name: my_templates
4. Format: Comma Separated Values (.csv)
5. Click: Save
✅ File saved as: my_templates.csv
```

### Google Sheets

```
1. Open Google Sheet with templates
2. File → Download
3. Select: Comma Separated Values (.csv)
4. File downloads as: spreadsheet_name.csv
✅ Use this file to upload
```

---

## 📊 COMPLETE EXAMPLE - READY TO USE

Copy this and paste into Excel, save as CSV, and upload:

```csv
name,notice_type,subject,content
"30-Day Notice to Quit","30_DAY_NOTICE","Notice to Vacate","TO: {tenant_name}, Unit {unit}

NOTICE TO VACATE

You are hereby notified that you must vacate the premises located at Unit {unit}, {property_address}, on or before {date}.

Your lease requires 30 days written notice for termination. This letter serves as that notice.

MOVE-OUT REQUIREMENTS:
- Return unit to clean condition
- Remove all personal belongings
- Return all keys to management
- Leave utilities on until final date
- Provide forwarding address

Contact property management:
Phone: {management_phone}
Email: {management_email}

The unit will be inspected upon move-out. Any damages beyond normal wear-and-tear may be deducted from your security deposit per your lease agreement and Pennsylvania law.

Sincerely,
Creekside Apartments Management"
"Rent Due Reminder","RENT_DUE","Monthly Rent Reminder","FRIENDLY REMINDER

Your monthly rent payment is due:

Tenant: {tenant_name}
Unit: {unit}
Amount Due: ${rent_amount}
Due Date: {date}

PAYMENT OPTIONS:

Online: [your payment portal]
Mail: [your address]
In Person: [office address]
Hours: [office hours]

Please allow 3-5 business days for mailed payments.

Questions? Contact us:
Phone: {management_phone}
Email: {management_email}

Thank you for being a valued resident!"
"Rent Late Notice","RENT_LATE","URGENT: Rent Past Due","⚠️ URGENT - RENT PAST DUE

Tenant: {tenant_name}
Unit: {unit}
Rent Amount: ${rent_amount}
Late Fees: ${late_fees}
TOTAL DUE: ${rent_amount + late_fees}

Your rent payment is now PAST DUE.

IMMEDIATE ACTION REQUIRED:

You must pay the full amount due by [DATE] to avoid further action including:
- Additional late fees
- Eviction proceedings
- Court costs
- Damage to credit report

PAY IMMEDIATELY:
- Online: [payment portal]
- Phone: {management_phone}
- In Person: [office address]

PAYMENT PLAN AVAILABLE:
If you cannot pay in full, contact management TODAY to discuss options.

{management_phone}
{management_email}

PENNSYLVANIA LAW:
Per your lease and PA law, failure to pay may result in eviction.

This is your final notice before legal action.

Pay immediately to avoid eviction."
"Lease Renewal","LEASE_RENEWAL","Your Lease is Expiring - Renewal Available","Dear {tenant_name},

Your lease for Unit {unit} is expiring on {lease_end_date}.

We would love to have you continue as a resident!

RENEWAL DETAILS:
- Current Monthly Rent: ${rent_amount}
- New Proposed Rent: ${new_rent_amount}
- Lease Term: [12 months / month-to-month]
- New Lease Start: [date]

RESPONSE DEADLINE:
Please let us know by [RENEWAL_DEADLINE] if you would like to renew.

OPTIONS:
1. Renew lease with us (contact office for paperwork)
2. Go month-to-month (if available)
3. Provide 30-day notice of move-out

WHY RENEW WITH US?
✓ Professional management
✓ Well-maintained property
✓ Responsive maintenance team
✓ Safe community

Contact us to discuss:
Phone: {management_phone}
Email: {management_email}
Office: [office address]
Hours: [office hours]

We appreciate your tenancy!"
"Maintenance Access Notice","MAINTENANCE_ACCESS","Maintenance Entry - 24 Hour Notice","NOTICE OF ENTRY

Management will be entering Unit {unit} for maintenance on:

DATE: [ENTRY_DATE]
TIME: [ENTRY_TIME]

PURPOSE: [Maintenance work description]

WHO'S COMING:
- Property Manager
- Maintenance Technician
- [Contractor if applicable]

WHAT WE'LL DO:
[Specific maintenance task]

YOUR RIGHTS:
✓ You may be present during entry
✓ We will respect your privacy
✓ Entry only to necessary areas
✓ Unit will be secure after work

PREPARATION:
- Ensure access to unit
- Secure or remove pets
- Clear access to work areas
- Contact us if you cannot be home

CONTACT:
If you have questions or need to reschedule:
Phone: {management_phone}
Email: {management_email}

This notice is provided 24 hours in advance as required by Pennsylvania law."
"Lease Violation Notice","LEASE_VIOLATION","Lease Violation - Action Required","FORMAL NOTICE OF LEASE VIOLATION

Tenant: {tenant_name}
Unit: {unit}
Date Issued: {date}

VIOLATION(S) IDENTIFIED:
[Specific lease violation(s)]

LEASE REQUIREMENT:
Your lease states: [specific clause violated]

REQUIRED ACTION:
You must remedy this violation by [CURE_DATE] by:
[Specific actions required]

CONSEQUENCES OF NON-COMPLIANCE:
If this violation is not cured by {date}:
- We may file for eviction
- Legal action will be pursued
- Court costs will be added
- Judgment may affect your credit and future housing

PENNSYLVANIA LAW:
This notice is issued per PA Residential Tenancies Act § 5511.

You have the right to:
✓ Contact an attorney
✓ Request mediation
✓ Appear in court if eviction is filed

QUESTIONS?
Please contact management immediately:
Phone: {management_phone}
Email: {management_email}

You have until {date} to cure this violation. Failure to do so will result in eviction proceedings.

Creekside Apartments Management"
"Emergency Maintenance Notice","EMERGENCY_MAINTENANCE","EMERGENCY - Immediate Maintenance Entry","🚨 EMERGENCY MAINTENANCE

An emergency maintenance situation has been identified at Unit {unit}.

EMERGENCY TYPE: [Water leak / Gas leak / Electrical hazard / Other]

IMMEDIATE ACTION TAKEN:
- [Actions taken to secure unit]
- [Emergency services contacted if applicable]
- Management responding immediately

NEXT STEPS:
- Contractor entering immediately to address emergency
- You may be asked to evacuate for safety
- Do NOT attempt to repair yourself
- Contact management immediately

TENANT RESPONSIBILITIES:
✓ Cooperate with emergency personnel
✓ Provide access to unit
✓ Ensure safety of occupants
✓ Secure personal belongings if evacuated

CONTACT:
Emergency: {emergency_phone}
Management: {management_phone}

This emergency entry is authorized under PA law without advance notice for situations threatening safety or property.

Creekside Apartments Management"
```

---

## ❌ COMMON ERRORS & FIXES

### Error 1: "❌ Missing required fields: name, notice_type, content"

**Cause:** A row is missing one of these columns
**Fix:** Ensure ALL rows have:
- name (not empty)
- notice_type (not empty)
- content (not empty)

**Example:**
```
❌ WRONG:
name,notice_type,subject,content
"30-Day Notice","30_DAY_NOTICE","Notice",""  ← content is empty

✅ CORRECT:
name,notice_type,subject,content
"30-Day Notice","30_DAY_NOTICE","Notice","Dear tenant, you must vacate..."
```

### Error 2: "❌ Template with this name already exists"

**Cause:** You already uploaded a template with that name
**Fix:** Either:
- Rename the template in your CSV
- Delete old template first, then import
- Import as new version with different name

### Error 3: File won't upload or shows error

**Cause 1:** File format is XLSX (Excel) not CSV
**Fix:** Save as CSV UTF-8 format (not Excel)

**Cause 2:** Encoding is not UTF-8
**Fix:** Re-save file as UTF-8 (in Excel: Save As → Format: CSV UTF-8)

**Cause 3:** Headers don't match exactly
**Fix:** Ensure header row is:
```
name,notice_type,subject,content
```
(all lowercase, exact spelling)

### Error 4: "⚠️ X duplicates skipped"

**Cause:** Template names already exist in system
**Fix:** Either:
- System automatically skips duplicates (safe)
- Delete old templates if you want to replace them
- Rename templates in CSV before importing

---

## ✅ VALIDATION CHECKLIST

Before uploading, verify:

```
HEADER ROW:
☐ First row is: name,notice_type,subject,content
☐ All lowercase
☐ Correct spelling (no extra spaces)
☐ Commas separate columns exactly

DATA ROWS:
☐ Each row has at least name, notice_type, content
☐ Names are not empty
☐ Notice types are valid (from list)
☐ Content is not empty
☐ Content is at least 20 characters (recommended)

FILE FORMAT:
☐ File is .csv format (NOT .xlsx, .xls, .ods)
☐ Encoding is UTF-8
☐ File is readable in text editor
☐ No extra blank rows at end

SPECIAL CHARACTERS:
☐ If using quotes, they're proper CSV quotes (")
☐ If using variables, syntax is correct: {variable}
☐ Commas within content are inside quotes
☐ Line breaks in content use proper CSV line breaks

EXAMPLE VALID CSV LINE:
"30-Day Notice","30_DAY_NOTICE","Notice to Quit","Dear {tenant_name}, you must vacate Unit {unit} by {date}. Regards, Management"
```

---

## 🎯 QUICK REFERENCE - IMPORT STEPS

```
1. Prepare CSV file with headers:
   name,notice_type,subject,content

2. Go to: 📋 Notice Templates page

3. Click: 📤 Import from CSV

4. Select: Your CSV file

5. Review: Preview shows first 10 rows

6. Click: Import Templates

7. Wait: Import completes

8. Check: Success message and template list

✅ Done! Templates ready to use
```

---

## 📞 TROUBLESHOOTING

### Preview shows 0 templates
- **Issue:** CSV file is empty or headers don't match
- **Fix:** Add data rows and ensure header row is correct

### Some templates imported, others skipped
- **Issue:** Some are duplicates or have errors
- **Fix:** Check error messages - duplicate names will be skipped (safe)

### Can't find file to upload
- **Issue:** File wasn't saved as CSV format
- **Fix:** Re-save in Excel as CSV UTF-8 format

### Templates appear but content is wrong
- **Issue:** Special characters didn't convert properly
- **Fix:** Ensure file is UTF-8 encoded

---

## 🎓 BEST PRACTICES

✅ **DO:**
- Test with 1-2 templates first before bulk upload
- Keep backup of your CSV file
- Use meaningful template names
- Include variables like {tenant_name}, {unit}, {date}
- Use UTF-8 encoding for special characters
- Save as CSV UTF-8 (not regular Excel)

❌ **DON'T:**
- Save as Excel (.xlsx) - must be CSV
- Use special Excel formatting - it won't transfer
- Leave required fields empty
- Use duplicate template names
- Upload without reviewing preview first
- Forget to save CSV before uploading

---

## 📊 SAMPLE CSV DOWNLOADS

**Download:** notice_templates_template.csv
- Includes 6 sample templates
- All properly formatted
- Ready to edit and upload
- Edit in Excel/Google Sheets

---

## ✨ YOU'RE READY TO:

✅ Create notice templates in Excel/Sheets  
✅ Convert to CSV format  
✅ Upload templates in bulk  
✅ Avoid common errors  
✅ Use template variables  
✅ Create custom notices quickly  

**Start with the download template - it's pre-formatted and ready to edit!** 📋

