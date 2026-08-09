# 48a — Vendor → Organisation Linking

**Series:** 48 (Cross-Tenant Supply Chain Completion)  
**Review reference:** `docs/reviews/cross-tenant-supply-chain-review.md` item #6  
**Depends on:** 48 (lookup standardisation, ghost org cleanup)  
**Status:** Planned

---

## Overview

The `vendors` table is strictly per-tenant with no link to the global `organizations` identity registry. When a vendor is also a platform subscriber (or a ghost awaiting subscription), there is no schema-level connection. Cross-tenant document issuance relies on `recipientOrganisationId` being manually set on each document rather than being derived from the vendor relationship.

This document adds an `organisation_id` FK on vendors, auto-resolves it during vendor creation/sync, and enables automatic cross-tenant routing based on vendor identity.

---

## Schema Migration (0050)

**File:** `apps/api/src/database/migrations-drizzle/0050_vendor_organisation_link.sql`

```sql
ALTER TABLE vendors
  ADD COLUMN organisation_id UUID REFERENCES organizations(id);

CREATE INDEX idx_vendors_organisation
  ON vendors(organisation_id)
  WHERE organisation_id IS NOT NULL;

COMMENT ON COLUMN vendors.organisation_id IS
  'Links this tenant-scoped vendor record to the global organisation identity. '
  'May point to a ghost (pre-subscribed) or active (subscribed) organisation.';
```

**Schema update:** In `apps/api/src/database/schema/index.ts`, add to the `vendors` table definition:

```typescript
organisationId: uuid('organisation_id').references(() => organizations.id),
```

**Rollback:**

```sql
DROP INDEX IF EXISTS idx_vendors_organisation;
ALTER TABLE vendors DROP COLUMN IF EXISTS organisation_id;
```

---

## Service Changes

### VendorsRepository

**File:** `apps/api/src/database/repositories/vendors.repository.ts`

Add methods:

```typescript
async findByOrganisationId(params: {
  organisationId: string;
  tenantId: string;
}): Promise<VendorRow | null> {
  const [row] = await this.db
    .select()
    .from(vendors)
    .where(
      and(
        eq(vendors.tenantId, params.tenantId),
        eq(vendors.organisationId, params.organisationId),
        eq(vendors.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

async findOnPlatform(params: {
  tenantId: string;
}): Promise<Array<VendorRow & { organisationStatus: string }>> {
  return this.db
    .select({
      ...getTableColumns(vendors),
      organisationStatus: organizations.subscriptionStatus,
    })
    .from(vendors)
    .innerJoin(organizations, eq(vendors.organisationId, organizations.id))
    .where(
      and(
        eq(vendors.tenantId, params.tenantId),
        eq(vendors.isActive, true),
        eq(organizations.subscriptionStatus, 'active'),
      ),
    );
}
```

Update `upsertByExternalReference` to accept and persist `organisationId` when provided:

```typescript
// In the onConflict set clause, add:
organisationId: data.organisationId ?? undefined,
```

### VendorSyncService

**File:** `apps/api/src/modules/domain/services/vendor-sync.service.ts`

After upserting a vendor from Crunchwork payload, attempt to resolve the corresponding organisation:

```typescript
async syncFromCrunchworkPayload(params: {
  tenantId: string;
  vendorData: Record<string, unknown>;
  tx?: DrizzleDbOrTx;
}): Promise<VendorRow> {
  // ... existing upsert logic ...

  const vendor = await this.vendorsRepo.upsertByExternalReference({ ... });

  // Attempt org resolution if not already linked
  if (!vendor.organisationId) {
    const orgId = await this.resolveOrganisationForVendor({
      vendor,
      tx: params.tx,
    });
    if (orgId) {
      await this.vendorsRepo.update({
        id: vendor.id,
        data: { organisationId: orgId },
        tx: params.tx,
      });
      vendor.organisationId = orgId;
    }
  }

  return vendor;
}

private async resolveOrganisationForVendor(params: {
  vendor: VendorRow;
  tx?: DrizzleDbOrTx;
}): Promise<string | null> {
  const { vendor } = params;
  const contactDetails = vendor.contactDetails as Record<string, unknown>;
  const vendorPayload = vendor.vendorPayload as Record<string, unknown>;

  const abn = (contactDetails.abn ?? vendorPayload.abn) as string | undefined;
  const email = (contactDetails.email ?? vendorPayload.email) as string | undefined;
  const legalName = vendor.name;

  if (!abn && !email && !legalName) return null;

  const candidates = await this.ghostOrgService.findCandidates({
    abn,
    primaryEmail: email,
    legalName,
    emailDomain: email ? email.split('@')[1]?.toLowerCase() : undefined,
  });

  if (candidates.length === 0) return null;

  // Prefer exact ABN match, then exact email, then name+domain
  const best =
    candidates.find((c) => c.matchType === 'exact_abn') ??
    candidates.find((c) => c.matchType === 'exact_email') ??
    candidates[0];

  return best.organisationId;
}
```

This is a **read-only resolution** — it does not create ghost orgs during sync. Ghost creation only happens during manual capture flows. If no existing org matches, the vendor remains unlinked until manually captured or explicitly linked by the user.

### VendorsService

**File:** `apps/api/src/modules/vendors/vendors.service.ts`

Add method:

```typescript
async findOnPlatformVendors(params: { page?: number; limit?: number }) {
  const tenantId = this.tenantContext.getTenantId();
  return this.vendorsRepo.findOnPlatform({ tenantId });
}
```

Add controller endpoint: `GET /vendors/on-platform`.

---

## Cross-Tenant Routing

### Auto-populate `recipientOrganisationId` from vendor

When creating POs or RFQs that target a vendor with an `organisationId`, auto-populate the `recipientOrganisationId` from the vendor record.

**PurchaseOrdersService** (new `create` enhancement):

```typescript
async create(params: { body: Record<string, unknown> }) {
  const tenantId = this.tenantContext.getTenantId();
  const data = { ...params.body, tenantId };

  // Auto-resolve recipient org from vendor
  if (data.vendorId && !data.recipientOrganisationId) {
    const vendor = await this.vendorsRepo.findOne({
      id: data.vendorId as string,
      tenantId,
    });
    if (vendor?.organisationId) {
      data.recipientOrganisationId = vendor.organisationId;
    }
  }

  return this.purchaseOrdersRepo.create({ data });
}
```

Apply the same pattern to `RfqsService.create` (after doc 48b adds cross-tenant fields to RFQs).

### Manual linking endpoint

For vendors synced from Crunchwork without automatic org resolution, allow manual linking:

**Endpoint:** `POST /vendors/:id/link-organisation`

```typescript
async linkOrganisation(params: { vendorId: string; organisationId: string }) {
  const tenantId = this.tenantContext.getTenantId();
  const vendor = await this.vendorsRepo.findOne({ id: params.vendorId, tenantId });
  if (!vendor) throw new BadRequestException('Vendor not found');

  // Verify org exists
  const [org] = await this.db
    .select()
    .from(organizations)
    .where(eq(organizations.id, params.organisationId))
    .limit(1);
  if (!org) throw new BadRequestException('Organisation not found');

  await this.vendorsRepo.update({
    id: params.vendorId,
    data: { organisationId: params.organisationId },
  });

  return { vendorId: params.vendorId, organisationId: params.organisationId };
}
```

---

## Frontend Changes

### Vendor list — "On Platform" badge

**File:** `apps/frontend/src/components/vendors/VendorsListClient.tsx`

When rendering vendor rows, check `organisationId` and its associated org's `subscriptionStatus`. Display an "On Platform" badge (e.g. a small chip/icon) when `subscriptionStatus === 'active'`.

The API response for vendor list should include `organisationStatus` field (returned by the enhanced repository query).

### Vendor detail — organisation link section

**File:** `apps/frontend/src/components/vendors/VendorDetail.tsx`

Add a section showing:
- **Linked organisation:** name, status (ghost/active/verified)
- **Link action:** button to search and link an organisation (calls `POST /vendors/:id/link-organisation`)
- **Auto-route indicator:** "Documents issued to this vendor will be delivered automatically" when org is active

### Document creation forms

When creating a PO or RFQ targeting a vendor with `organisationId`:
- Show "This vendor is on the platform — document will be delivered automatically" info banner
- Auto-populate `recipientOrganisationId` in the form submission (handled server-side, but UI can show the indication)

---

## Impact on Ghost Organisation Flows

When a ghost org subscribes (custody transfer via `OrganisationsService.approveClaim`):
1. Ghost becomes active tenant.
2. Custodial POs/quotes are transferred.
3. **New:** After transfer, find all vendor records across tenants with `organisationId = ghostOrgId`. Their `organisationId` now points to an active tenant — cross-tenant routing automatically activates for future documents.

No code change needed for this — the existing `organisationId` FK already points to the now-active org row.

---

## Testing Strategy

- Create a vendor with ABN. Create a ghost org with same ABN via manual PO capture. Verify `VendorSyncService` resolves the vendor's `organisationId` to the ghost.
- Create a PO targeting a vendor with `organisationId` pointing to an active org. Verify `recipientOrganisationId` is auto-populated.
- Verify `findOnPlatformVendors` returns only vendors linked to active orgs.
- Verify manual linking endpoint works and persists.
- Ghost subscribes → verify vendor records pointing to that org now route cross-tenant.

---

## File Impact Summary

| Category | Files |
|----------|-------|
| **Migration** | `0050_vendor_organisation_link.sql` |
| **Schema** | `schema/index.ts` (vendors table) |
| **Modified (backend)** | `vendors.repository.ts`, `vendors.service.ts`, `vendors.controller.ts`, `vendor-sync.service.ts` |
| **Modified (frontend)** | `VendorsListClient.tsx`, `VendorDetail.tsx` |
| **New endpoints** | `GET /vendors/on-platform`, `POST /vendors/:id/link-organisation` |
