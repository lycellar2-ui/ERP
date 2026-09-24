# Standard Operating Procedure (SOP): Field Check-in Operations

> **Module Code:** `SFV` (Sales Field Visit)  
> **Route:** `/dashboard/sales/visits`  
> **Target Audience:** Field Sales Representatives, Regional Sales Managers, Commercial Directors  
> **Interface Locales:** English (`EN`) and Vietnamese (`VI`)  
> **Last Verified:** 2026-09-23  

---

## Table of Contents
1. [System Architecture & Role Segmentation](#1-system-architecture--role-segmentation)
2. [Hardware & Browser Permissions Setup](#2-hardware--browser-permissions-setup)
3. [Field Sales Representative Workflow (Mobile / Tablet)](#3-field-sales-representative-workflow-mobile--tablet)
   - [3.1 Daily Route & Mobile Navigation](#31-daily-route--mobile-navigation)
   - [3.2 5-Step Field Check-in Execution](#32-5-step-field-check-in-execution)
   - [3.3 Ad-Hoc / Unplanned Check-in](#33-ad-hoc--unplanned-check-in)
   - [3.4 Weekly Plan Schedule & Target Commitment](#34-weekly-plan-schedule--target-commitment)
   - [3.5 Cellar Offline Mode (Offline Draft Storage)](#35-cellar-offline-mode-offline-draft-storage)
   - [3.6 Photo Gallery & Map Auditing](#36-photo-gallery--map-auditing)
4. [Sales Manager & Executive Operations (Desktop / Tablet)](#4-sales-manager--executive-operations-desktop--tablet)
   - [4.1 Executive Board & 5 Core KPIs](#41-executive-board--5-core-kpis)
   - [4.2 Team Plan vs. Actual Audit Matrix](#42-team-plan-vs-actual-audit-matrix)
   - [4.3 Photo Audit & Weekly Plan Approval](#43-photo-audit--weekly-plan-approval)
5. [Language Switching [ VI | EN ]](#5-language-switching--vi--en-)
6. [Troubleshooting & Diagnostics](#6-troubleshooting--diagnostics)

---

## 1. System Architecture & Role Segmentation

The Field Check-in system operates with strict role-based separation:

| Dimension | Sales Representative View | Manager / Director View |
|---|---|---|
| **Primary Device** | Mobile Smartphone (iOS Safari / Android Chrome) | Desktop PC, Laptop, or Tablet |
| **Data Scope** | Isolated strictly to own visits (`where.salespersonId = user.id`) | Full team aggregation (Sales Reps only; office staff excluded) |
| **Hardware Use** | Live camera sensor + high-precision GPS geofencing | Data audit only; no hardware GPS required |
| **Default Screen** | 4-Tab Mobile Navigation (`Today`, `Plan`, `Summary`, `Photos`) | Executive KPI Board + Team Audit Matrix |

---

## 2. Hardware & Browser Permissions Setup

Field check-in requires active **Camera** and **Geolocation (GPS)** permissions to prevent proxy check-ins.

### iOS Safari (iPhone / iPad)
1. Open **Settings** → Scroll down and select **Safari**.
2. Tap **Location** → Select **Ask** or **Allow**.
3. Tap **Camera** → Select **Allow**.
4. When accessing `/dashboard/sales/visits`, tap **"Allow"** on the browser permission prompt.

### Android Chrome
1. In Google Chrome, tap the **Padlock icon 🔒** on the left side of the address bar (`https://...`).
2. Tap **Permissions**.
3. Toggle both **Location** and **Camera** to **Allowed**.
4. Reload the page (`Pull down to refresh` or `F5`).

> [!NOTE]
> If permissions were previously denied, tap the **"How to enable GPS"** banner on the dashboard to open visual diagnostic steps.

---

## 3. Field Sales Representative Workflow (Mobile / Tablet)

### 3.1 Daily Route & Mobile Navigation

When accessing `/dashboard/sales/visits` on a mobile device, the application renders a dedicated mobile UI with a persistent bottom navigation bar.

![Real Mobile Today View](file:///d:/Lyruou/docs/images/check-in/real_mobile_today_view_en.png)

#### Mobile Touchpoints:
- **Top Bar**: Fast hamburger menu, route title, and instant `[ VI | EN ]` locale pill.
- **GPS Location Banner**: Displays real-time GPS acquisition status and diagnostic triggers (`Refresh GPS`, `How to enable GPS`).
- **Floating Action Button (FAB)**: Prominent orange button `[+ Ad-hoc Check-in]` fixed at the bottom-right for instant access from any scroll position.
- **Fixed Bottom Bar**: 4 native touch tabs (`Today`, `Plan`, `Summary`, `Photos`).

---

### 3.2 5-Step Field Check-in Execution

```
[1. Arrive at Venue] ➔ [2. Tap Check-in / FAB] ➔ [3. Capture Verification Photo] ➔ [4. Select Purpose & Notes] ➔ [5. Check-out]
```

1. **Arrive at the client location** (restaurant storefront, bar counter, or retail display).
2. Tap the **`[⚡ Check-in Now]`** button on the client card or the floating **`[+ Ad-hoc Check-in]`** button.
3. Align the camera with the venue's wine rack or signage and capture the photo. The camera HUD verifies GPS coordinates and applies an encrypted watermark.
4. Select the **Activity Type** and input field findings.
5. Confirm to finalize. The visit record is immediately logged with time-in and coordinates.

---

### 3.3 Ad-Hoc / Unplanned Check-in

For impromptu visits to new venues or unlisted accounts, sales reps trigger the Ad-Hoc modal:

![Real Ad-Hoc Check-in Modal](file:///d:/Lyruou/docs/images/check-in/real_adhoc_checkin_modal.png)

#### Input Fields:
1. **Select customer / client**: Fast searchable combobox filtering all active accounts by name, customer code, or address.
2. **Activity type**: Choose from predefined operational presets:
   - *Periodic Customer Care*
   - *Wine Tasting & Sampling*
   - *Inventory & POS Audit*
   - *Payment & Receivables Collection*
   - *Contract Signing*
   - *Complaint Handling*
   - *Other Purpose*
3. **Specific purpose (optional)**: Brief notes regarding the objective.
4. Tap **`[📷 Open Check-in Camera]`** to initiate photo capture. The visit is tagged with an orange **`⚡ AD-HOC`** badge for managerial audit.

---

### 3.4 Weekly Plan Schedule & Target Commitment

Sales representatives establish their weekly itinerary in the **Weekly Plan** tab:

![Real Weekly Plan Calendar](file:///d:/Lyruou/docs/images/check-in/real_weekly_plan_tab.png)

#### Operational Steps:
1. **Select Week**: Use `< Week XX >` navigation to select the target operating week.
2. **Set Weekly Target**: Input commercial commitments into the target bar (e.g., *"Focus on Chianti Classico distribution in District 1 and collect overdue AR"*).
3. **Assign Daily Stops**: Tap **`[+ Add Stop]`** on any day card (Monday through Sunday) to allocate clients and morning/afternoon time slots. Today's date is highlighted with an emerald border.
4. Tap **`[Save]`** in the top-right to commit the plan to the database.

---

### 3.5 Cellar Offline Mode (Offline Draft Storage)

Sub-basement hotel venues and underground wine storage cellars frequently lack 4G/cellular reception.

#### System Behavior:
- If a check-in is submitted while offline, the system catches the network failure and buffers the visit payload (image binary, timestamp, GPS lock) in local browser storage (`localStorage: SALES_VISITS_OFFLINE_DRAFTS_V1`).
- A persistent warning banner indicates:  
  *⚠️ "Offline check-in draft pending sync (Cellar/No Network)"*.
- **Automatic Sync**: The moment the device detects network restoration, the system automatically triggers server synchronization without rep re-entry.
- Reps may also click **`[Sync Now]`** once surface reception is restored.

---

### 3.6 Photo Gallery & Map Auditing

Under the **Photos** tab:
- **Visual Grid View**: Displays captured venue photos with overlay badges, client identifiers, and exact GPS coordinates.
- **Direct Maps Cross-Reference**: Tap **`[🗺️ View on Map]`** on any photo to inspect the capture coordinates directly in Google Maps against the registered client address.

---

## 4. Sales Manager & Executive Operations (Desktop / Tablet)

When a user with managerial or executive credentials (`admin`, `sales manager`, `ceo`) accesses `/dashboard/sales/visits`, the system renders the **Executive Monitoring Board**.

![Real Manager Executive Board](file:///d:/Lyruou/docs/images/check-in/real_manager_executive_board_en.png)

### 4.1 Executive Board & 5 Core KPIs

The dashboard aggregates operational performance across the entire sales force for the selected week:

| KPI Card | Data Source | Operational Meaning |
|---|---|---|
| **👥 Sales Personnel** | `COUNT(users WHERE role = 'SALES_REP')` | Active field sales force headcount (office staff excluded). |
| **📋 Target Visits** | `SUM(WeeklyVisitPlan.schedules)` | Total scheduled visits committed for the selected week. |
| **📍 Actual Check-ins** | `COUNT(SalesVisit WHERE status = 'COMPLETED')` | Verified field visits completed. |
| **📈 Completion Rate** | `(Actual / Target) * 100%` | Team quota execution velocity. |
| **⏳ Pending Approval** | `COUNT(WeeklyVisitPlan WHERE status = 'SUBMITTED')` | Rep reports awaiting manager review and sign-off. |

---

### 4.2 Team Plan vs. Actual Audit Matrix

The audit table evaluates each sales representative individually:
- **Sales Rep**: Name, avatar, and email account (e.g., `Phạm Quang Trường`, `Vũ Hà Phương`).
- **Plan vs. Actual**: Target stops vs. verified check-in count with progress bars.
- **Ad-hoc**: Count of spontaneous market visits conducted outside the weekly plan.
- **Status Badges**: Indicates report status (`Not Scheduled`, `Pending Review`, `Approved`).
- **Action**: Tap **`[👁 Audit & Photos]`** to launch the comprehensive inspection drawer.

---

### 4.3 Photo Audit & Weekly Plan Approval

Clicking **`[👁 Audit & Photos]`** opens the dedicated verification drawer:

![Real Manager Review and Approve Drawer](file:///d:/Lyruou/docs/images/check-in/real_manager_review_approve_tab.png)

#### Audit Workflow:
1. **Inspect Photos & GPS**: Review high-resolution venue photos in the `Check-in photos` tab to verify store signage and GPS coordinates against fraudulent off-site check-ins.
2. **Verify Weekly Plan**: Cross-check scheduled vs. completed visits in the `Weekly plan` tab.
3. **Review & Sign-Off**:
   - Inspect the representative's self-evaluation comments.
   - Enter managerial directives and feedback into the **Manager Feedback** field.
   - Click **`[✓ Save Review & Approve]`** to lock the evaluation into corporate KPI records.

---

## 5. Language Switching [ VI | EN ]

The interface supports instant, client-side bilingual switching between English and Vietnamese.

![Real Desktop Overview in English](file:///d:/Lyruou/docs/images/check-in/real_sales_visits_desktop_en.png)

- **Toggle Location**: The **`[ VI | EN ]`** pill switch is positioned in the top-right header and duplicated in the module title bar.
- **Zero Page Reload**: Instant locale toggle powered by reactive DOM events (`sales_visits_locale_change`).
- **Zero Data Mutation**: Client accounts, rep operational notes, and manager feedback comments are **strictly preserved in their original entered format** and never machine-translated.
- **Session Persistence**: User preference is stored in `localStorage: sales_visits_locale` for subsequent logins.

---

## 6. Troubleshooting & Diagnostics

### T1: Camera initialization fails or displays a black screen
- **Root Cause**: Another application (native camera, Zalo, messaging app) is holding hardware lock, or browser camera permission is blocked.
- **Fix**: Force-close background apps, verify browser site permissions via the padlock icon, and refresh the page.

### T2: GPS banner reports "No GPS coordinates acquired"
- **Root Cause**: Device location services are turned off, or high-density concrete walls are shielding GPS satellite triangulation.
- **Fix**: Enable phone GPS services in quick settings, step toward an exterior window or entrance, and tap **`Refresh GPS`**.

### T3: Loss of 4G reception in underground wine storage cellars
- **Status**: **Fully Supported via Offline Mode**.
- **Action**: Proceed with normal photo capture. The payload is cached safely in local storage and auto-synced the moment the phone returns to 4G reception.

### T4: Office or accounting personnel missing from Manager Audit Table
- **Status**: **Working as Designed**.
- **Explanation**: The audit matrix automatically isolates personnel with field sales roles (`SALES_REP`). Warehouse, administrative, and accounting staff are excluded to maintain actionable sales data.

---

*Document reference: Wine ERP Operations Manual — SFV Field Check-in.*
