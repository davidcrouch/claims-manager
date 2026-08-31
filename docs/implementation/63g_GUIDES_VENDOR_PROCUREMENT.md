# 63g — Guides: Vendor Procurement

**Status:** Planned  
**Date:** 2026-08-31  
**Parent:** `63_HELP_GUIDE_CONTENT_ROLLOUT.md`  
**Priority:** P2  
**Related:** `33d_PROPOSALS_MODULE.md`, `33e_BILLS_MODULE.md`, `11_PURCHASE_ORDERS_MODULE.md`, `50_RFQ_SEND_REQUESTS.md`, `ui/07_RFQS.md`–`ui/10_BILLS.md`, `18_VENDORS_MODULE.md`

---

## Objective

Document the Vendors sidebar (RFQs → Proposals → POs → Bills) plus the **vendor directory** pages that are not in the sidebar.

---

## Guides

| File | Slug | Routes | Audience |
|------|------|--------|----------|
| `operations/vendors/overview.md` | `vendors-overview` | `/vendors`, `/vendors/[id]` | member |
| `operations/vendors/rfqs.md` | `rfqs` | `/rfqs`, `/rfqs/[id]` | member |
| `operations/vendors/proposals.md` | `proposals` | `/proposals`, `/proposals/[id]` | member |
| `operations/vendors/purchase-orders.md` | `purchase-orders` | `/purchase-orders`, `/purchase-orders/[id]` | member |
| `operations/vendors/bills.md` | `bills` | `/bills`, `/bills/[id]` | member |

**TOC expansion:** add Vendors Overview at the start of the Vendors bullet in both indexes.

Permissions cluster: `procurement.read` / `procurement.manage`, `vendors.read` / `vendors.manage`.

---

## Direction of trade (include in overview + RFQ/proposal)

Plain language:

| You are… | Document | Sidebar |
|----------|----------|---------|
| Asking a vendor for a price | RFQ | Vendors |
| Receiving a vendor’s price | Proposal | Vendors |
| Ordering from a vendor | Purchase Order | Vendors |
| Vendor invoices you | Bill | Vendors → AP |
| You price work to the insurer | Estimate (`/quotes`) | Customers |

Dashboard queues: RFQs awaiting, proposals to review — link `dashboard`.

---

## 1. Vendors — Overview (new)

### Outline

1. Intro — vendor organisations you trade with; opened from RFQ/PO/bill links.
2. Accessing — no sidebar row; URL `/vendors` or from a document’s vendor link.
3. List + detail fields (walk live).
4. Linking vendors (`48a_VENDOR_ORGANISATION_LINKING.md` only if the UI exposes link/unlink).
5. Best practices — don’t duplicate vendors; match ABN.

`related_guides`: `rfqs`, `proposals`, `purchase-orders`, `bills`, `company-settings`

---

## 2. RFQs

Walk list/detail (`rfqs/[id]`). Cover: create RFQ, select vendors, send request (`50_RFQ_SEND_REQUESTS.md` behaviour **as visible in UI**), job filter, statuses.

`related_guides`: `vendors-overview`, `proposals`, `jobs-overview`, `dashboard`

---

## 3. Proposals

Inbound vendor quotes. Review/accept. Contrast with **Estimates** (your outbound price). Dashboard “proposals to review”.

Walk live detail (line items, accept actions).

`related_guides`: `rfqs`, `estimates-overview`, `purchase-orders`, `dashboard`

---

## 4. Purchase Orders

Issued to vendors; may be **received** from insurer for assessment/works fees (builder playbooks). Variations may append lines (link `creating-a-variation`).

Walk list/detail, statuses, receiving/ack if present.

`related_guides`: `bills`, `work-orders-overview`, `creating-a-variation`, `builder-assessment-workflow`

---

## 5. Bills

Vendor invoices payable. Contrast **Invoices** (AR). Link AP. Approve/pay actions if present.

`related_guides`: `accounts-payable`, `purchase-orders`, `invoices-overview`

---

## Per-file minimum structure

Each of RFQ / Proposal / PO / Bills:

1. Key Concepts (one screen’s worth).
2. Accessing + permission.
3. List (filters, job scope).
4. Creating (if `procurement.manage`).
5. Detail tour (tabs as live).
6. How it connects to the next document in the chain.
7. Best practices (3–5).

Do not paste API tables from module docs.

---

## Index updates

```markdown
- **Vendors** — [Overview](operations/vendors/overview.md) · [RFQs](…) · [Proposals](…) · [Purchase Orders](…) · [Bills](…)
```

---

## Ingest & smoke

| Route | Expect |
|-------|--------|
| `/rfqs` | `rfqs` |
| `/proposals` | `proposals` |
| `/purchase-orders` | `purchase-orders` |
| `/bills` | `bills` |
| `/vendors` | `vendors-overview` |

---

## Acceptance

- [ ] Overview file exists; estimate vs proposal confusion addressed.
- [ ] Each Vendors href resolves.
- [ ] Ingest + **?** on RFQs and Bills.
