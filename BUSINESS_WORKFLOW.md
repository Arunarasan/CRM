# Arudra CRM/ERP — Business Workflow Documentation

This document traces the real, code-verified business workflows of the Arudra CRM/ERP application. It is built by reading the **service layer** (`backend/src/main/java/com/arudra/crm/service/*.java`), the relevant **entities** (status/state fields), the **controllers** that expose them as REST endpoints, and the **frontend pages** that call those endpoints.

Every claim below is backed by a specific file/method. Where the code does not support a plausible-sounding workflow step, that gap is called out explicitly rather than invented.

---

## 1. Lead-to-Customer lifecycle

### Narrative

1. **Creation** — A lead is created via `POST /api/leads` (`LeadController.createLead`) → `LeadService.createLead(Lead, User)` (`service/LeadService.java:71`). If no status is supplied, it defaults to `"New"`. A `leadNumber` is auto-generated as `L-<epoch millis>`. An `ActivityLog`-style `LeadActivity` row is written (`CREATED`).
2. **Auto-assignment on creation** — If the incoming lead already has `assignedSalesExecutive` set, `createLead` immediately calls `assignLead(...)` to also write a `LeadAssignment` audit row (`LeadService.java:80-83`).
3. **Manual assignment** — `POST /api/leads/{id}/assignments` (`LeadController.assignLead`) → `LeadService.assignLead(leadId, userId, role, assignedBy)` (`LeadService.java:172`). Role is a free-text string; the service special-cases `"Sales Executive"`, `"Project Manager"`, `"Engineer"` to set the corresponding FK on `Lead` (`assignedSalesExecutive`, `projectManager`, `assignedEngineer`). Any other role string is silently accepted into the `LeadAssignment` audit table but does not update a field on `Lead` itself.
4. **Status transitions** — `PUT /api/leads/{id}/status?status=...` (`LeadController.updateLeadStatus`) → `LeadService.updateLeadStatus` (`LeadService.java:148`). `Lead.status` is a **plain `String` column, not a Java enum** (`entity/Lead.java:41-43`, comment says `"NEW, CONTACTED, QUALIFIED..."` but nothing constrains the value at the entity level). The actual set of statuses in use is defined only in the **frontend** Kanban board, `frontend/src/pages/Leads.tsx:29-31`:
   `"New", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Site Visit Scheduled", "Quotation Approved", "Closed", "Lost"`.
   Every status change is recorded in `LeadStatusHistory` (old → new, remarks, changed-by, timestamp) and logged as a `LeadActivity` (`STATUS_CHANGED`).
5. **Follow-ups** — `POST /api/leads/{id}/follow-ups` → `LeadService.addFollowup` (`LeadService.java:202`). Creates a `LeadFollowup` (method: Call/Email/WhatsApp/Meeting, outcome, next follow-up date/time) and updates denormalized fields on `Lead` (`lastFollowUp`, `nextFollowUpDate`, `nextFollowUpTime`, `followUpCount++`, `followUpOutcome`).
6. **Negotiation** — There is a `LeadNegotiation` **entity** but no repository is injected/used anywhere in `LeadService` or any other service. Negotiation on the lead side is tracked only informally through `LeadFollowup.outcome` / `Lead.followUpOutcome` — there is no dedicated negotiation workflow for leads (contrast with `Quotation`, see §3).
7. **Marking as Lost** — `POST /api/leads/{id}/lost` → `LeadService.markAsLost(leadId, reason, competitor, feedback, user)` (`LeadService.java:221`) sets `lostReason`/`competitor`/`customerFeedback` on the `Lead`, then internally calls `updateLeadStatus(leadId, "Lost", reason, user)`.
8. **Conversion to Customer** — `POST /api/leads/{id}/convert` → `LeadController.convertLeadToCustomer` → `LeadService.convertLeadToCustomer(leadId, user)` (`LeadService.java:230`). Guards against double conversion via `lead.getIsConverted()`. Builds a new `Customer` from lead fields (name/company, email, phone, city, state, billing address = lead address, GST number, contact person). Saves the `Customer`, sets `lead.isConverted = true`, `convertedToCustomer`, `convertedBy`, `convertedDate`, then transitions status to `"Closed"` via `updateLeadStatus` and logs a `CONVERTED` activity.
9. **Deletion** — `DELETE /api/leads/{id}` hard-deletes the `Lead` row (`LeadService.deleteLead`), no soft-delete/archival.

### State/flow diagram

```
New -> Contacted -> Qualified -> Proposal Sent -> Negotiation -> Site Visit Scheduled
     -> Quotation Approved -> Closed (= Converted to Customer)
                                   \
                                    -> Lost (any point, via markAsLost)

Lead.isConverted: false -> true (one-way, guarded against re-conversion)
```

(Note: these status *string values* are a frontend convention only — the backend accepts any string in `Lead.status`.)

### Confirmed bug: acting user passed as `null`

`LeadController` receives `@AuthenticationPrincipal UserDetails userDetails` on every mutating endpoint but **never uses it** — it passes literal `null` as the `User currentUser` argument to every `LeadService` call:

```java
// LeadController.java
createLead(...)         -> leadService.createLead(lead, null);           // line 57
updateLead(...)         -> leadService.updateLead(id, lead, null);       // line 63
updateLeadStatus(...)   -> leadService.updateLeadStatus(id, status, remarks, null); // line 70
assignLead(...)         -> leadService.assignLead(id, userId, role, null);          // line 78
addFollowup(...)        -> leadService.addFollowup(id, followup, null);             // line 84
convertLeadToCustomer() -> leadService.convertLeadToCustomer(id, null);             // line 90
markLeadAsLost(...)     -> leadService.markAsLost(id, ..., null);                   // line 97
```

This is still present in the current code. Practical effect: every `LeadActivity.performedBy`, `LeadStatusHistory.changedBy`, `LeadAssignment.assignedBy`, `Lead.assignedBy`, and `Lead.convertedBy` written through these endpoints is `NULL` in the database, even though a real authenticated user made the request. The same `null`-for-`User` pattern also appears in `ProjectController` (daily-logs, quality-checks, activity-logs, documents, payments all pass `null`) and `SiteVisitController` (create, assignments, measurements, media, reschedule, sign all pass `null`) and `QuotationController` (create, update, duplicate, revise, approval, convert, sign all pass `null`). It appears to be a systemic pattern across the controller layer, not isolated to Leads.

---

## 2. Site Visit & Measurement workflow

### Site Visit narrative (`SiteVisitService.java`, `SiteVisitController.java`)

1. **Scheduling** — `POST /api/site-visits` → `SiteVisitService.createSiteVisit(SiteVisit, User)` (`SiteVisitService.java:47`). Defaults `status = "Scheduled"`, auto-generates `visitNumber = "SV-<epoch millis>"`. A `SiteVisit` optionally links to a `Lead`, `Customer`, and/or `Project` (all nullable FKs, `entity/SiteVisit.java:20-29`).
2. **Assignment** — `POST /api/site-visits/{id}/assignments` → `SiteVisitService.assignUser` (`SiteVisitService.java:85`) creates a `SiteVisitAssignment` (assignee, assigned-by, role, remarks) and logs `"Engineer Assigned"` to `SiteVisitHistory`.
3. **Conducting the visit** —
   - `updateSiteVisit` (`SiteVisitService.java:56`) updates status, priority, actual start/end times, property details (floors, area, construction stage, site condition), requirements (preferred style, budget), and observation fields (structural/electrical issues).
   - Rooms: `POST /api/site-visits/{id}/rooms` → `addRoom` creates a `SiteRoom`.
   - Room measurements: `POST /api/site-visits/rooms/{roomId}/measurements` → `addMeasurement` creates a `SiteMeasurement` tied to a `SiteRoom`, logs `"Measurements Completed"`.
   - Media: `POST /api/site-visits/{id}/media` → `addMedia` creates `SiteVisitMedia` (photo/video), logs `"Photos Uploaded"`.
   - Every state-changing action writes a `SiteVisitHistory` row via the private `logHistory` helper.
4. **Customer sign-off** — `PUT /api/site-visits/{id}/sign` → `SiteVisitService.updateSignature` (`SiteVisitService.java:144`) stores a base64 signature + customer name, sets `status = "Completed"`. **This is wired to the frontend**: `frontend/src/pages/SiteVisitProfile.tsx:51` calls `PUT /site-visits/{id}/sign`.
5. **Reschedule** — `PUT /api/site-visits/{id}/reschedule` → `rescheduleVisit` sets `status = "Rescheduled"`, appends a reason to `visitNotes`.
6. **Checklist — declared but unused.** `SiteVisitService` autowires a `SiteVisitChecklistRepository` (`SiteVisitService.java:23`) and the `SiteVisitChecklist` entity exists (item, isCompleted, remarks — `entity/SiteVisitChecklist.java`), but **no method in `SiteVisitService` or `SiteVisitController` ever reads or writes it**. The "checklist" part of the workflow described in the task brief does not actually exist in working code — it is schema-only dead weight.

### State/flow diagram (Site Visit)

```
Scheduled -> Confirmed -> In Progress -> Completed
         \-> Rescheduled (loops back to scheduling)
         \-> Cancelled
(Completed is also set as a side-effect of capturing the customer signature)
```

### Measurement module narrative (`MeasurementService.java`, `MeasurementController.java`)

1. **Creation** — `POST /api/measurements` → `MeasurementService.createMeasurement(Measurement, username, role)` (`MeasurementService.java:37`). Note: this controller uses **`@RequestHeader("X-User-Name")` / `@RequestHeader("X-User-Role")`** instead of `@AuthenticationPrincipal` — a different, header-based "auth" convention than every other controller in the app. Auto-generates `measurementNumber = "MSR-<uuid8>"`, forces `status = "Draft"` regardless of input.
2. **Update** — `updateMeasurement` only touches `remarks`, `status`, `mapLocation` — none of the other ~15 fields on `Measurement` (property type, site address, construction stage, floors, area, customer approval/signature fields) are ever updated through this service.
3. **Rooms** — `POST /api/measurements/{id}/rooms` → `addRoomToMeasurement` creates a `MeasurementRoom` and **auto-calculates** `floorArea`, `ceilingArea`, `perimeter`, and (if height present) `wallArea` from length/width/height.
4. Every create/update/room-add action logs to `MeasurementActivityLog` (actor = the raw `username`/`role` header strings, not a `User` FK).
5. **No further steps are implemented.** There is no service method for walls, doors, windows, floors, electrical, plumbing, furniture, drawings, material estimates, or customer approval/signature capture, despite dedicated entities existing for all of them (`MeasurementWall`, `MeasurementDoor`, `MeasurementWindow`, `MeasurementFloor`, `MeasurementElectrical`, `MeasurementPlumbing`, `MeasurementFurniture`, `MeasurementDrawing`, `MeasurementMaterialEstimate`, `MeasurementCeiling`). These entities and their columns exist in the domain model but have no service/controller code exercising them.

### Site Visit vs. standalone Measurement — are they duplicates?

**They are structurally two separate, overlapping subsystems, and the code does not show one clearly superseding the other:**

- `SiteVisit` has its own room/measurement capability: `SiteRoom` + `SiteMeasurement` (captured live during a visit, via `SiteVisitService.addRoom`/`addMeasurement`).
- `Measurement` is a **separate top-level entity** with its own number series (`MSR-...`), own room sub-entity (`MeasurementRoom`, with auto area calculation), and its own status lifecycle (`Draft, In Progress, Completed, Approved, Rejected` — `entity/Measurement.java:39`).
- `Measurement` **does** have a nullable `siteVisit` FK (`entity/Measurement.java:27-29`), suggesting the intended design is: a site visit happens first (quick/rough capture), and a follow-up, more formal `Measurement` record is optionally created and linked back to that visit. However, **no service method in `MeasurementService` or `SiteVisitService` ever sets `Measurement.siteVisit`** — the FK exists in the schema but nothing in the current code path populates it. So in practice the two modules run independently: `SiteVisit`/`SiteRoom`/`SiteMeasurement` for the visit itself, and `Measurement`/`MeasurementRoom` as an unrelated, disconnected parallel record.
- Both `Quotation` and `Project` independently hold **both** a `siteVisit` and a `measurement` FK (`entity/Quotation.java:42-50`, `entity/Project.java:41-47`), reinforcing that the data model expects both to coexist as inputs to a quotation/project, but nothing in the service layer auto-derives one from the other or keeps them in sync.

**Honest conclusion:** the code does not clearly answer "which one supersedes the other." They appear to be two independently-built measurement-capture features (`SiteVisit`'s inline rooms vs. the standalone `Measurement` module with its richer, never-populated sub-entity set) that were never fully wired together, beyond one dangling FK.

---

## 3. Quotation lifecycle

### Narrative (`QuotationService.java`, `QuotationController.java`, `entity/Quotation.java`)

1. **Creation** — `POST /api/quotations` → `QuotationService.createQuotation(Quotation, User)` (`QuotationService.java:40`). Links child collections (`items`, `discounts`, `taxes`, `labours`, `additionalCharges`, `terms`, `attachments`) back to the parent via `linkCollections`. Auto-generates `quotationNumber = "QT-<epoch millis>"`. Calls `recalculateTotals` before saving. Logs `QuotationActivity` (`CREATED`).
2. **Line items, discounts, taxes, labour, additional charges** — all computed in `recalculateTotals` (`QuotationService.java:272`):
   - Each `QuotationItem`: `rate * quantity`, minus item-level `discountPercentage`, plus item-level `gstPercentage` → `totalAmount`.
   - `QuotationLabour`: `rate * hours` → `amount`.
   - `QuotationAdditionalCharge.amount` summed as-is.
   - Subtotal = items + labour + charges.
   - `QuotationDiscount`: percentage-of-subtotal or flat amount, summed into `quotation.discount`.
   - `QuotationTax`: percentage applied to (subtotal − discount) **only if `isInclusive` is false**, summed into `quotation.gst`.
   - `grandTotal = (subtotal − discount) + tax`.
3. **Update** — `PUT /api/quotations/{id}` → `updateQuotation` replaces customer/lead/siteVisit/measurement/boq links, status, priority, currency, dates, T&Cs, and fully replaces (`clear()` + re-add) every child collection, then recalculates totals.
4. **Duplication** — `POST /api/quotations/{id}/duplicate` → `duplicateQuotation` (`QuotationService.java:78`) creates a brand-new quotation (`status = "DRAFT"`, new number) copying customer/lead/currency/T&Cs and **only the `items` collection** (`copyCollections`, `QuotationService.java:247`) — the comment in the code explicitly says deep-copying of the other collections (discounts, taxes, labour, charges, terms) was skipped "for brevity."
5. **Revision** — `POST /api/quotations/{id}/revise` → `createRevision` (`QuotationService.java:97`) creates a new `Quotation` row with `quotationNumber = "<original>-v<n+1>"`, `revisionNumber = original+1`, `parentQuotationId` pointing back to the root (or the original's own parent if it's already a revision). Copies items only (same `copyCollections` limitation as duplication). The **original** quotation's status is flipped to `"REVISED"`.
6. **Internal approval** — `PUT /api/quotations/{id}/approval?status=...` → `updateApprovalStatus` (`QuotationService.java:122`) sets `Quotation.internalApprovalStatus` and `approvedBy`; if the passed status is `"APPROVED"`, also sets `approvedDate` and flips the main `Quotation.status` to `"APPROVED"`.
   - **`QuotationApproval` entity exists but is unused.** It models a proper multi-level approval chain (`approvalLevel`: SALES/MANAGER/CUSTOMER, `reviewer`, `status`, `comments`) with its own repository (`QuotationApprovalRepository`), but **no service anywhere in the codebase references `QuotationApprovalRepository`**. The actual "approval workflow" is just two flat string fields (`status`, `internalApprovalStatus`) on `Quotation` itself — there is no per-level approval record being created.
   - **`QuotationNegotiation` entity is likewise unused** — `QuotationNegotiationRepository` is never injected/called by any service. Price negotiation history (old price vs. new price, customer/sales remarks, manager approval) is modeled in the schema but not implemented in business logic.
7. **Customer signing** — `PUT /api/quotations/{id}/sign` → `QuotationController.saveSignature` → `QuotationService.saveSignature` (`QuotationService.java:191`) stores `customerSignatureBase64` and force-sets `status = "APPROVED"`. **This endpoint has no caller anywhere in the frontend** (`grep` across `frontend/src` for `.sign(`, `/sign\``, `saveSignature` found only the Site Visit sign call in `SiteVisitProfile.tsx`; `QuotationView.tsx` only *displays* `quotation.customerSignatureBase64` if it happens to be set — line 243-246 — but has no capture UI or call to trigger it). So customer e-signing of a quotation is backend-only, unreachable from the current UI.
8. **Conversion to Project** — `POST /api/quotations/{id}/convert-to-project` → `QuotationController.convertToProject` → `QuotationService.convertToProject` (`QuotationService.java:142`). Guard: requires `quotation.status == "APPROVED"` **or** `quotation.internalApprovalStatus == "APPROVED"` (either is sufficient — not both). Creates a new `Project` copying customer, lead, siteVisit, measurement, and the quotation link; `status = "PLANNING"`, `progress = 0`, `startDate = today`, `budget = quotation.grandTotal`. Also seeds three default `ProjectStage` rows (`"Planning & Procurement"`, `"Execution & Installation"`, `"Quality Check & Handover"`, each `status = "PENDING"`), writes a `ProjectActivityLog`, and flips the quotation to `status = "CONVERTED"` with `quotation.project` set.
9. **Deletion** — `DELETE /api/quotations/{id}` hard-deletes.

### State/flow diagram

```
DRAFT -> (approval) -> APPROVED -> (sign, customer) -> APPROVED (unchanged)
                                 -> CONVERTED (via convertToProject)
DRAFT -> REVISED (original, once a new revision is created)
       -> new revision starts again at DRAFT

internalApprovalStatus: PENDING -> APPROVED / REJECTED   (flat field, not the QuotationApproval entity)
```

---

## 4. Project execution lifecycle

### Narrative (`ProjectService.java`, `ProjectController.java`, `entity/Project.java`)

1. **Creation** — Projects are normally created as a side-effect of `QuotationService.convertToProject` (§3), but `POST /api/projects` also exists directly (`ProjectService.createProject`) with no defaulting logic (status must be supplied by the caller).
2. **Status field** — `Project.status` is a free-text string; the entity comment lists the intended values: `PLANNING, PENDING, APPROVED, RUNNING, PAUSED, ON_HOLD, COMPLETED, CANCELLED, CLOSED` (`entity/Project.java:72`). Nothing in `ProjectService` enforces transitions between these — `updateProject` just overwrites `status` with whatever the caller sends.
3. **Stages** — `POST /api/projects/{id}/stages` → `addStage` creates a `ProjectStage` (status: `PENDING, IN_PROGRESS, COMPLETED, DELAYED`, `entity/ProjectStage.java:27`), with `completionPercentage` and `dueDate`/`completionDate`. Three default stages are auto-created on quotation conversion (§3.8); additional stages can be added manually. No service logic recalculates `Project.progress` from stage completion — `progress` is a plain integer set directly wherever the caller wants (e.g. hard-set to `0` on creation, `100` on `completeProject`).
4. **Daily logs** — `POST /api/projects/{id}/daily-logs` → `addDailyLog` creates a `ProjectDailyLog` with `reportedBy = user` (passed as `null` from the controller — see the bug note in §1).
5. **Quality checks** — `POST /api/projects/{id}/quality-checks` → `addQualityCheck` creates a `ProjectQualityCheck` with `inspector = user` (also `null` from the controller).
6. **Customer approvals** — `POST /api/projects/{id}/approvals` → `addCustomerApproval` creates a `ProjectCustomerApproval` (no user tracking parameter at all in this one).
7. **Issues / Risks** — `POST /api/projects/{id}/issues` and `/risks` create `ProjectIssue` / `ProjectRisk` rows — simple CRUD, no status-driven workflow logic (e.g. no auto-escalation, no linking risk resolution back to project status).
8. **Documents** — `POST /api/projects/{id}/documents` → `addDocument`, tracks `uploadedBy` (also `null` from controller).
9. **Payments** — `POST /api/projects/{id}/payments` → `addPayment` creates a `ProjectPayment`, tracks `receivedBy` (also `null` from controller). **This is a separate payment-tracking table from `CustomerPayment`/`Invoice` in the Billing module (§7) — the two are not reconciled with each other in code.**
10. **Dashboard aggregation** — `GET /api/projects/{id}` → `getProjectDashboard` (`ProjectService.java:59`) returns a single `Map` bundling the project plus all of stages, daily logs, quality checks, approvals, activity logs, issues, risks, documents, and payments — this is what `ProjectCommandCenter.tsx` renders (confirmed via `frontend/src/pages/ProjectCommandCenter.tsx:32` calling `GET /projects/{id}`, and subsequent calls to `/stages`, `/daily-logs`, `/issues`, `/quality-checks`, `/complete`).
11. **Completion** — `POST /api/projects/{id}/complete` → `completeProject(projectId, certificateBase64)` (`ProjectService.java:181`) force-sets `status = "COMPLETED"`, `progress = 100`, `actualCompletionDate = today`, and stores a completion certificate as base64. No check that all stages/quality checks are actually done first.

### State/flow diagram

```
PLANNING -> PENDING -> APPROVED -> RUNNING -> COMPLETED
                                \-> PAUSED / ON_HOLD -> RUNNING (manual, no gating)
                                \-> CANCELLED / CLOSED

ProjectStage: PENDING -> IN_PROGRESS -> COMPLETED (or DELAYED)
```

---

## 5. Procurement workflow

### Narrative (`PurchaseService.java`, `PurchaseController.java`)

1. **Suppliers** — plain CRUD (`getAllSuppliers`, `createSupplier`), no approval or rating workflow.
2. **Purchase Order creation** — `POST /api/purchases/orders` → `PurchaseService.createPurchaseOrder(po, items)` (`PurchaseService.java:47`). Sets `date = today`, `status = "DRAFT"`. Computes each `PurchaseOrderItem.totalPrice = unitPrice * quantity` and sums into `po.totalAmount`. **`PurchaseOrder` has no link to `Project`** (verified: no `project`/`Project` field anywhere in `entity/PurchaseOrder.java`) — procurement is Supplier-only, not tied to which project the materials are for.
3. **PO status update** — `POST /api/purchases/orders/{id}/status?status=...` → `updatePurchaseOrderStatus` simply overwrites the status string; entity comment lists `DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, SENT, PARTIAL, COMPLETED, CANCELLED` (`entity/PurchaseOrder.java:30`) but **no code enforces which transitions are legal** or requires an approval step before `APPROVED`.
4. **Goods Receipt Note (GRN)** — `POST /api/purchases/grns` → `createGrn(grn, items)` sets `status = "DRAFT"`, saves `GoodsReceiptNoteItem`s.
5. **GRN approval — this is the real inventory-integration point.** `POST /api/purchases/grns/{id}/approve` → `PurchaseService.approveGrn(grnId)` (`PurchaseService.java:98`):
   - Throws if already `"APPROVED"`.
   - For each GRN item: finds the matching `PurchaseOrderItem` by product ID and increments its `receivedQuantity` by the GRN's `acceptedQuantity`.
   - Builds an `InventoryTransaction` (`type = "PURCHASE"`, `destinationWarehouse = grn.warehouse`, `quantity = acceptedQuantity`, `reference = grn.grnNumber`) and calls **`InventoryService.processTransaction(tx)`** — this is the one and only place Procurement talks to Inventory.
   - Sets GRN `status = "APPROVED"`.
   - Calls `checkAndUpdatePoStatus` (`PurchaseService.java:139`): if every PO item's `receivedQuantity >= quantity`, PO becomes `"COMPLETED"`; otherwise `"PARTIAL"`.
6. **Purchase Bills** — `POST /api/purchases/bills` → `createBill` sets `date = today`, `status = "UNPAID"`. Bills reference a PO but there's no automatic bill generation from an approved GRN — bill creation is a separate manual step.
7. **Purchase Payments** — `POST /api/purchases/payments` → `PurchaseService.addPayment` (`PurchaseService.java:173`) saves the payment, sums all payments against the bill, and sets bill status to `"PAID"` (fully covered) or `"PARTIAL"` (partially covered).

### Connection to Inventory

**Confirmed, one-directional:** Procurement → Inventory happens only through `approveGrn` → `InventoryService.processTransaction`. There is no reverse link (Inventory doesn't know which PO/GRN a stock item came from beyond the free-text `InventoryTransaction.reference` string matching the GRN number). Products (`Product` entity) are shared between the two modules — a `PurchaseOrderItem`/`GoodsReceiptNoteItem` references the same `Product` used by `InventoryItem`.

### State/flow diagram

```
PurchaseOrder:  DRAFT -> PENDING_APPROVAL -> APPROVED -> SENT -> PARTIAL -> COMPLETED
                                                              \-> CANCELLED / REJECTED
                (status transitions are not enforced by code; PARTIAL/COMPLETED are the
                 only ones actually driven by service logic, via checkAndUpdatePoStatus)

GRN:            DRAFT -> APPROVED   (approval triggers Inventory stock-in)

PurchaseBill:   UNPAID -> PARTIAL -> PAID   (driven by summed PurchasePayments)
```

---

## 6. Inventory workflow

### Narrative (`InventoryService.java`, `InventoryController.java`)

1. **Master data** — `Product` (catalog item), `Warehouse`, `InventoryCategory` are plain CRUD/read entities (`createProduct`, `getWarehouses`, `getCategories`).
2. **Stock ledger** — `InventoryItem` represents on-hand quantity per (product, warehouse) pair (`getAllStock`).
3. **Transactions** — `POST /api/inventory/transactions` → `InventoryService.processTransaction(tx)` (`InventoryService.java:66`) is the single choke-point for all stock movement, keyed on `tx.getType()`:
   - `"PURCHASE"` or `"ADJUSTMENT"` → `addStock(product, destinationWarehouse, qty)` (increments or creates the `InventoryItem`).
   - `"CONSUMPTION"` → `removeStock(product, sourceWarehouse, qty)`.
   - `"TRANSFER"` → both `removeStock` from source and `addStock` to destination.
   - This same method is called internally by `PurchaseService.approveGrn` (see §5) and can also be called directly via the controller endpoint (e.g. manual adjustments, consumption bookings, transfers) — the frontend `Inventory.tsx` presumably drives the latter (not read in full, but the endpoint is generic and reusable).
4. **Negative stock allowed by design** — `removeStock` (`InventoryService.java:112`) explicitly allows the resulting quantity to go negative, with a code comment: *"Allows negative stock depending on business logic, assuming yes for now."* If no `InventoryItem` row exists yet for that product/warehouse, one is created with a **negative** quantity outright rather than rejecting the transaction.
5. **Low-stock alerts** — `GET /api/inventory/alerts/low-stock` → `getLowStockAlerts` delegates entirely to a repository query (`itemRepository.findLowStockItems()`); the threshold/reorder-point logic lives in the repository/entity layer, not in the service (not opened in this review, but confirmed the service does no threshold math itself).
6. **No consumption trigger from Projects.** Nothing in `ProjectService` or `TaskService` creates a `"CONSUMPTION"` `InventoryTransaction` when project work happens — inventory consumption booking (if it happens at all) must be done manually through the generic transaction endpoint; it is not wired to project execution.

### State/flow diagram

```
InventoryTransaction.type:
  PURCHASE    -> +stock at destination warehouse   (fed automatically by GRN approval)
  ADJUSTMENT  -> +stock at destination warehouse   (manual)
  CONSUMPTION -> -stock at source warehouse        (manual; not linked to Project/Task)
  TRANSFER    -> -stock at source, +stock at destination
```

---

## 7. Billing workflow

### Narrative (`BillingService.java`, `BillingController.java`)

1. **Invoice creation** — `POST /api/billing/invoices` → `BillingService.createInvoice(invoice, items)` (`BillingService.java:37`). Sets `date = today`, `status = "DRAFT"`. For each `InvoiceItem`: `lineTotal = unitPrice * quantity`, `lineGst = lineTotal * gstRate / 100`, `item.totalPrice = lineTotal + lineGst`; sums into `invoice.subTotal`, `invoice.gstAmount`, `invoice.totalAmount`.
   - `Invoice` **does** have a nullable `project` FK (`entity/Invoice.java:24-25`), so the data model supports linking an invoice to a project. **However, the frontend `InvoiceBuilder.tsx` never sets it** — its create payload only includes `invoiceNumber`, `dueDate`, `notes`, `terms`, and `customer: {id}` (`frontend/src/pages/InvoiceBuilder.tsx:63-77`; no `project` field anywhere in the form state or payload). So in practice, every invoice created through the UI is customer-only, with `project = null`, even though the schema and the `CustomerProfileDTO` aggregation (`CustomerService.getCustomerProfile`, listing `profile.setInvoices(...)`) treat invoices as belonging to a customer regardless of project link.
2. **Invoice status update** — `POST /api/billing/invoices/{id}/status?status=...` → `updateInvoiceStatus` simply overwrites the status string (`DRAFT, SENT, PARTIAL, PAID, CANCELLED` per the entity comment, `entity/Invoice.java:43`) — no validation of legal transitions.
3. **Customer payments** — `POST /api/billing/payments` → `BillingService.addPayment(payment)` (`BillingService.java:83`) saves the `CustomerPayment`; if it references an invoice, calls `recalculateInvoiceStatus(invoiceId)`.
4. **Credit/Debit notes** — `POST /api/billing/notes` → `addNote` saves a `CreditDebitNote`; if linked to an invoice, also triggers `recalculateInvoiceStatus`.
5. **Status recalculation** (`BillingService.java:121`) — sums all `CustomerPayment`s for the invoice, plus/minus all `CreditDebitNote`s (`CREDIT` adds, `DEBIT` subtracts) to get an "effective payment." If effective payment ≥ `totalAmount` → `"PAID"`; if > 0 but less → `"PARTIAL"`; if 0 and the invoice was previously `PAID`/`PARTIAL`, it's rolled back to `"SENT"` (i.e., removing a payment un-pays the invoice, but never rolls it back below `"SENT"` even to `"DRAFT"`).
6. **Advance/non-invoice payments** — `CustomerService.getCustomerProfile` (`CustomerService.java:154-173`) treats any `CustomerPayment` with `invoice == null` as an "advance paid" amount separate from invoice-linked payments — implying the billing module supports pre-invoice advance collection, though there's no dedicated service method for recording an advance (it's just a `CustomerPayment` with no invoice set, via the generic `addPayment` endpoint).

### Connection to Projects/Quotations

- **Quotation → Billing: no code link.** Nothing in `QuotationService` or `BillingService` creates an invoice from an approved/converted quotation. The quotation's `grandTotal` only flows into `Project.budget` at conversion time (§3.8); billing amounts are entered independently when an invoice is manually created.
- **Project → Billing: link exists in schema, unused by UI.** `Invoice.project` FK exists but is never populated by the only invoice-creation path in the frontend. `ProjectPayment` (tracked inside `ProjectService`, §4.9) is a **separate** payment ledger from `CustomerPayment`/`Invoice` and the two are never reconciled against each other in code — a project could show payments received via `ProjectPayment` that have no corresponding `Invoice`/`CustomerPayment`, and vice versa.

### State/flow diagram

```
Invoice: DRAFT -> SENT -> PARTIAL -> PAID
                       \-> CANCELLED
(PARTIAL/PAID/reversion-to-SENT are driven by recalculateInvoiceStatus based on
 CustomerPayment + CreditDebitNote totals; DRAFT->SENT and ->CANCELLED are manual only)

PurchaseBill (separate, vendor-side, §5): UNPAID -> PARTIAL -> PAID
```

---

## 8. Contractor management workflow

### Narrative (`ContractorService.java`, `ContractorController.java`)

1. **Contractor profile** — plain CRUD (`createContractor`, `updateContractor` — updates name/email/phone/company/skills/hourlyRate/dailyRate/performanceRating; `deleteContractor`).
2. **Assignment to projects** — `POST /api/contractors/{id}/projects` → `ContractorService.addProject(contractorId, ContractorProject)` creates a `ContractorProject` row (`status`: `ACTIVE`/`COMPLETED`, `entity/ContractorProject.java:27`) linking a `Contractor` to a `Project`. **This is a genuine, working cross-module link** — `ContractorProject.project` is a required (`nullable = false`) FK to `Project`.
3. **Attendance** — `POST /api/contractors/{id}/attendance` → `addAttendance` creates a `ContractorAttendance` row. No aggregation/payroll calculation service tying attendance to payment amounts (unlike HR's leave-to-attendance auto-generation, §9).
4. **Payments** — `POST /api/contractors/{id}/payments` → `addPayment` creates a `ContractorPayment`. No status recalculation, running-balance, or link back to `ContractorAttendance` (e.g. no "pay for days worked" computation) — it's a flat payment log.
5. **Documents** — `POST /api/contractors/{id}/documents` → `addDocument` creates a `ContractorDocument`.
6. **Aggregated profile view** — `GET /api/contractors/{id}` → `getContractorDetails` (`ContractorService.java:44`) bundles contractor + projects + attendance + payments + documents into one map, consumed by `ContractorProfile.tsx`.

### State/flow diagram

```
Contractor (master record, no status field of its own)
   -> ContractorProject: ACTIVE -> COMPLETED   (per project assignment)
   -> ContractorAttendance (daily records, independent of project status)
   -> ContractorPayment (flat log, no reconciliation against attendance/dues)
```

---

## 9. HR workflow

### Narrative (`HrService.java`, `HrController.java`)

1. **Departments / Employees** — plain CRUD, no approval workflow for either.
2. **Attendance** — `POST /api/hr/attendance` → `markAttendance` saves an `Attendance` row (defaults `date = today` if omitted).
3. **Leave requests** —
   - `POST /api/hr/leaves` → `createLeaveRequest` saves with implicit default status `"PENDING"` (`entity/LeaveRequest.java:32`).
   - `POST /api/hr/leaves/{id}/approve?approvedBy=...` → `HrService.approveLeaveRequest(id, approvedBy)` (`HrService.java:70`) sets `status = "APPROVED"`, `approvedBy = <string>`, and **auto-generates one `Attendance` row per day in the leave date range** with `status = "LEAVE"` (`HrService.java:77-87`). Note `approvedBy` is a plain `String`, not a `User` FK — and the frontend hardcodes it: `frontend/src/pages/HumanResources.tsx:58` calls `POST /hr/leaves/{id}/approve?approvedBy=Admin` — the literal string `"Admin"` is sent regardless of who is actually logged in.
   - `POST /api/hr/leaves/{id}/reject` → `rejectLeaveRequest` just sets `status = "REJECTED"`.
4. **Documents** — `addDocument` for `EmployeeDocument`, plain CRUD.
5. **Payroll/Salary** — `POST /api/hr/payroll` → `generateSalaryRecord` (`HrService.java:114`): if `netSalary` isn't supplied, computes it as `basic + allowances - deductions`. `POST /api/hr/payroll/{id}/pay` → `markSalaryPaid` sets `status = "PAID"`, `paymentDate = today`. No link from `Attendance`/`LeaveRequest` records into the payroll calculation (e.g. LOP for unapproved absences is not computed) — salary figures are entered manually.
6. **Performance reviews** — `addPerformanceReview` is a flat CRUD append, no linkage to salary increments or leave history.

### State/flow diagram

```
LeaveRequest: PENDING -> APPROVED (auto-creates Attendance="LEAVE" rows for the date range)
                       -> REJECTED

SalaryRecord: (generated) -> PAID
```

---

## 10. Notification workflow

### Narrative (`NotificationService.java`, `NotificationController.java`)

1. **Central dispatcher** — `NotificationService.dispatch(title, message, type, recipientId, actionUrl)` (`NotificationService.java:28`) is documented as the "Central Dispatcher for all notifications." It looks up the recipient's `NotificationSettings` (auto-creating a default row if none exists) and, per-channel flag:
   - In-app enabled → persists a `Notification` row.
   - Email/SMS/WhatsApp enabled → **mocked**: just a `System.out.println(...)` line for each channel (`NotificationService.java:46,50,54`) — no real email/SMS/WhatsApp integration exists.
2. **What actually triggers a dispatch — confirmed by grep across the whole backend:** `NotificationService`/`dispatch` is referenced in exactly three files: `NotificationService.java` itself, `NotificationController.java`, and **`TaskService.java`**. `TaskService.createTask` (`TaskService.java:66-74`) is the **only** business-logic call site in the entire codebase — it fires a `"New Task Assigned"` notification when a task is created with an assigned employee, but the recipient is hardcoded: `1L, // Using 1L as mock current user recipient` (`TaskService.java:71`).
   - **No other service triggers a notification.** Lead status changes, lead assignment, quotation approval/conversion, project stage changes, GRN approval, invoice payment, leave approval/rejection, salary payment — none of these call `NotificationService.dispatch`, despite being exactly the kind of events a notification system would normally cover.
3. **Unread counts / inbox** — `getInbox`, `getRecent` (top 5), `getUnreadCount`, `markAsRead`, `markAllAsRead` are straightforward repository-backed reads/writes, all scoped by `recipientId`.
4. **"Current user" is hardcoded everywhere in this module.** `NotificationController` declares `private final Long CURRENT_USER_ID = 1L;` (`NotificationController.java:22`) with the comment *"Hardcode for now, but in production this comes from JWT/Session"* — every inbox/unread-count/settings endpoint operates against user ID `1` regardless of who is actually authenticated.
5. **Settings** — `getSettings`/`updateSettings` manage per-user `NotificationSettings` (email/SMS/WhatsApp/in-app toggles), but since the recipient is always hardcoded to `1L`, these settings are effectively global/single-user in the current implementation, not per-logged-in-user.

### State/flow diagram

```
Trigger (only TaskService.createTask today) -> NotificationService.dispatch
   -> [inAppEnabled]    -> Notification row (unread) -> markAsRead / markAllAsRead
   -> [emailEnabled]    -> console log only (no real email sent)
   -> [smsEnabled]      -> console log only
   -> [whatsappEnabled] -> console log only
```

---

## 11. Cross-module data flow — what's actually wired vs. disconnected

### Implemented, working connections (verified by direct service/repository calls or real FK usage in service logic)

```
Lead --(LeadService.convertLeadToCustomer)--> Customer
Customer --(nullable FK)--> SiteVisit, Quotation, Invoice, Project
SiteVisit --(nullable FK, populated at creation)--> Lead / Customer / Project
Quotation --(QuotationService.convertToProject)--> Project
   Project gets: customer, lead, siteVisit, measurement, quotation copied across;
   3 default ProjectStages auto-created; quotation.status -> CONVERTED
Project --(TaskService)--> Task (task.project required, non-null FK)
Project --(ContractorService.addProject)--> ContractorProject (contractor <-> project link)
Project --(ProjectService.addPayment)--> ProjectPayment  [separate ledger from Billing]
PurchaseOrder --(GRN approval)--> GoodsReceiptNote --(PurchaseService.approveGrn)--> 
   InventoryService.processTransaction --> InventoryItem (stock-in)
Invoice --(BillingService payments/notes)--> CustomerPayment / CreditDebitNote 
   --> recalculateInvoiceStatus --> Invoice.status
TaskService.createTask --> NotificationService.dispatch (only trigger in the app)
CustomerService.getCustomerProfile aggregates read-only views across Project, Quotation,
   Invoice, CustomerPayment, Lead, SiteVisit, Task — but this is a reporting rollup, not a
   write-path connection.
```

### Modules that are schema-connected but NOT actually wired in service code (confirmed disconnects)

- **`Measurement.siteVisit`** FK exists but is never set by any service — `Measurement` and `SiteVisit` run as parallel, unlinked capture flows (§2).
- **`QuotationApproval`** and **`QuotationNegotiation`** entities/repositories exist but are never used by `QuotationService` or any other service — the real approval workflow is just two flat string fields (`Quotation.status`, `Quotation.internalApprovalStatus`).
- **`LeadNegotiation`, `LeadReminder`, `LeadLabel`, `LeadDocument`, `LeadNote`** — none of these entities' repositories are referenced anywhere in `service/`. They exist in the schema with no working backend feature behind them.
- **`Quotation.sign`** endpoint (customer e-signature capture) has no frontend caller — backend-only, unreachable feature (confirmed by search across `frontend/src`; only `SiteVisit`'s sign endpoint is actually called from the UI).
- **`SiteVisitChecklist`** — repository is autowired into `SiteVisitService` but never read/written; no controller endpoint exists for it either.
- **`Invoice.project`** FK exists but `InvoiceBuilder.tsx` never populates it — every UI-created invoice is customer-only, `project = null`.
- **`PurchaseOrder`** has no relationship to `Project` at all (no FK in the entity) — procurement is not scoped to a specific project in this codebase; it only reaches Inventory (via GRN approval), never Projects directly.
- **`ProjectPayment`** vs. **`CustomerPayment`/`Invoice`** are two separate, unreconciled payment leders for the same underlying business event (money received against a project) — nothing in the code keeps them consistent with each other.
- **Notifications are essentially only wired to one event** (task assignment) out of the many status-changing operations across Leads, Quotations, Projects, Purchases, Billing, and HR that would conventionally fire a notification (approval requests, status changes, payment received, leave decisions, low stock, etc.). Combined with the hardcoded `CURRENT_USER_ID = 1L`, the notification system is effectively a single-user proof-of-concept, not a production multi-user notification system yet.
- **Inventory consumption is never triggered by Project/Task execution** — the only automatic `InventoryTransaction` in the codebase is the `"PURCHASE"` one created by GRN approval; `"CONSUMPTION"` transactions (materials used on a project) must be entered manually through the generic transaction endpoint, with no linkage back to which project consumed the stock.
- **The `User currentUser` / `null` pattern** (§1) means that even where a relationship *is* modeled (e.g. `LeadActivity.performedBy`, `ProjectDailyLog.reportedBy`, `SiteVisitHistory.performedBy`), the actual acting-user data is frequently not being captured at runtime because controllers discard the authenticated principal and pass `null`.

### Consolidated end-to-end diagram (as actually implemented)

```
Lead ──(convertLeadToCustomer)──> Customer
                                     │
                    ┌────────────────┼───────────────────────┐
                    ▼                ▼                        ▼
              SiteVisit         Quotation ◄── (siteVisit/measurement FK, not auto-populated)
              (rooms/media/          │
               signature)      (approve via status field, sign endpoint unreachable from UI)
                    │                │
        [Measurement: schema-linked to SiteVisit via FK, but never actually set — 
         runs as an independent, parallel capture flow, not a continuation of SiteVisit]
                    │                ▼
                    │          convertToProject
                    │                │
                    └───────────────►▼
                                   Project ──> ProjectStage / DailyLog / QualityCheck /
                                                CustomerApproval / Issue / Risk / Document /
                                                ProjectPayment [separate ledger from Billing]
                                     │
                        ┌────────────┼─────────────┐
                        ▼            ▼              ▼
                    Task        ContractorProject   Invoice (project FK present but
                (assignment       (Contractor <->     never populated by the UI —
                 notification      Project link,      Billing is effectively
                 to user 1L)       works)              Customer-only in practice)
                                                        │
                                                  CustomerPayment / CreditDebitNote
                                                  ──> recalculates Invoice.status

Side flows, not connected to the chain above:
  Supplier -> PurchaseOrder -> GRN (approve) -> InventoryTransaction("PURCHASE") -> InventoryItem
     (PurchaseOrder has no Project FK; Inventory consumption by Project is not automated)
  Department -> Employee -> Attendance / LeaveRequest(approve auto-creates Attendance)
              -> SalaryRecord -> PerformanceReview
     (HR module does not reference Project, Customer, or any sales-side entity)
```

---

## Summary of workflow sections

1. Lead-to-Customer lifecycle — §1
2. Site Visit & Measurement workflow — §2
3. Quotation lifecycle — §3
4. Project execution lifecycle — §4
5. Procurement workflow — §5
6. Inventory workflow — §6
7. Billing workflow — §7
8. Contractor management workflow — §8
9. HR workflow — §9
10. Notification workflow — §10
11. Cross-module data flow — §11
