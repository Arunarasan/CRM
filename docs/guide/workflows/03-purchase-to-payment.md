# Workflow — Purchase to Stock to Payment

How materials are bought, received, stocked and paid for.

| # | Step | Who | Where | What happens |
|---|---|---|---|---|
| 1 | **Need identified** | Employee / PM / system | Material request (portal) or low-stock alert or project material list | Becomes a purchase request. |
| 2 | **Create PO** | Admin / purchasing | Purchasing → New PO (or Project → Resources → New PO) | Supplier, items, tax, discount, transport, delivery addresses, optional project. Status DRAFT. |
| 3 | **Approve** | Approver | PO detail | DRAFT → PENDING_APPROVAL → APPROVED. |
| 4 | **Send to supplier** | Purchasing | PO detail | Status SENT, then CONFIRMED when the supplier agrees. |
| 5 | **Advance / payments** | Finance | PO or bill | Payment type ADVANCE, PARTIAL or FULL; posts to Cash Book and project expenses. |
| 6 | **Shipment** | Purchasing | PO → shipments | One PO may have many shipments, each with a shipping ID and delivery place. |
| 7 | **Receive goods** | Store staff / field employee | Purchasing receipt or portal Requests → Goods Receipt | Enter received, damaged, rejected, QC result, photos. |
| 8 | **Approve receipt** | Receiver / admin | Goods receipt | Accepted quantity enters stock (to the chosen warehouse, tagged to the project if any). Damaged/rejected never enter stock. QC *Reject* blocks approval; raise a purchase return. PO becomes PARTIAL or COMPLETED. Approval is logged. |
| 9 | **Supplier bill** | Purchasing | Bill on PO | Matches receipts; tracks dues. |
| 10 | **Use stock** | PM / employees | Material request issue, project stock out | CONSUMPTION movement; project cost updates. |
| 11 | **Return to supplier** | Purchasing | Purchase return | Confirmed returns reduce stock. |

**Rules**
- Receipts only against open POs (Approved, Sent, Confirmed, Partial).
- A shipping ID can be received once per PO.
- Approval refreshes the product's last purchase price and supplier.

## Quick Q&A
**Q: Where is who approved a receipt?** Purchasing → Receipt Log.
**Q: A PO shows PARTIAL.** Some goods arrived; receive the rest to complete it.
