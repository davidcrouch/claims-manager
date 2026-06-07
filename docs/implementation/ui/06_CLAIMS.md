# 06 — Claims

**Route:** `/claims` (list), `/claims/[id]` (detail)
**Sidebar group:** CUSTOMERS
**Accent:** Blue
**Chain context:** Claims flow down from insurer. Read-only for vendors.

---

## List Page

**Columns:**

| Column | Field | Sortable |
|--------|-------|----------|
| Claim # | `claimNumber` or `externalReference` | Yes |
| Status | `status.name` | No |
| Policy | `policyNumber` or `policyName` | No |
| Address | `address.streetNumber + streetName, suburb` | No |
| Account | `account.name` | No |
| Lodged | `lodgementDate` | No |
| Updated | `updatedAt` | Yes |

**Sort options:** Updated, Created, Claim #
**Search:** Claim number, reference, policy
**Filters:** Status (multi-select)

---

## Detail Page

### Header
- Back → /claims
- FileText icon (blue)
- Title: `claimNumber`
- StatusBadge
- Address subtitle

### Tabs

| Tab | ID |
|-----|----|
| Overview | `overview` |
| Jobs | `jobs` |
| Activities | `activities` |
| Communications | `communications` |
| Timeline | `timeline` |
| Attachments | `attachments` |

### Overview Tab

**Section: Basic Information**

| Field | Source | Type |
|-------|--------|------|
| CAT Code | `catCode` | Text |
| Loss Type | `lossType.name` | Lookup |
| Loss Sub Type | `lossSubType.name` | Lookup |
| Address | full address | Text |

**Section: Incident Information**

| Field | Source | Type |
|-------|--------|------|
| Lodgement Date | `lodgementDate` | DateTime |
| Date of Loss | `dateOfLoss` | DateTime |
| Claim Consultant | `claimConsultant` | Text |
| Property Assessor | `propertyAssessor` | Text |
| Internal Auditor | `internalAuditor` | Text |
| Desktop Assessor | `desktopAssessor` | Text |
| Technical Assessor | `technicalAssessor` | Text |
| Vulnerable Customer | `vulnerableCustomer` | BoolPill |
| Vulnerability Category | `vulnerabilityCategory` | Text |
| Total Loss | `totalLoss` | BoolPill |
| Priority | `priority` | Text |
| Claim Decision | `claimDecision` | Text |
| Auto Approval Applies | `autoApproval` | BoolPill |
| Contentious Claim | `contentiousClaim` | BoolPill |
| Contentious Activity Flag | `contentiousActivityFlag` | BoolPill |
| Contentious Activity Details | `contentiousActivityDetails` | Text |
| Accommodation Benefit Limit | `accommodationBenefitLimit` | Number |
| Max Accommodation Duration | `maxAccommodationDuration` | Text |
| Broker Reference | `brokerReference` | Text |
| Hazardous Waste | `hazardousWaste` | BoolPill |
| Incident Description | `incidentDescription` | HTML |

**Section: Policy Information**

| Field | Source | Type |
|-------|--------|------|
| Flood Coverage Flag | `floodCoverageFlag` | Text |
| Policy Type | `policyType` | Text |
| Policy Number | `policyNumber` | Text |
| Line of Business | `lineOfBusiness` | Text |
| Policy Inception Date | `policyInceptionDate` | Date |
| Policy Name | `policyName` | Text |
| ABN | `abn` | Text |
| Building Sum Insured | `buildingSumInsured` | Currency |
| Contents Sum Insured | `contentsSumInsured` | Currency |
| Excess | `excess` | Currency |
| Collect Excess | `collectExcess` | BoolPill |

**Section: Postal Address**

| Field | Source |
|-------|--------|
| Same as project | boolean |
| Postal address | full text |

**Section: Contacts**

| Column | Field |
|--------|-------|
| Contact Role | `type.name` (Insured, etc.) |
| Name | `firstName + lastName` |
| Email | `email` |
| Phone | `mobilePhone` |

**Section: Assignees**

| Column | Field |
|--------|-------|
| Name | `name` |
| Role | `roleType.name` |
| External Ref | `externalReference` |

### Jobs Tab

**Internal Jobs table:**

| Column | Field |
|--------|-------|
| Job Type | `jobType.name` |
| Job Reference | `externalReference` |
| Assigned to | assignee |
| Last Updated | `updatedAt` |
| Status | badge |
| Actions | EDIT/VIEW |

**Linked Jobs table:**

| Column | Field |
|--------|-------|
| Job Type | `jobType.name` |
| Job Reference | `externalReference` |
| Vendor Name | `vendor.name` |
| Vendor Contact Number | phone |
| Vendor Contact Email | email |
| Status | badge |

### Activities Tab
Tasks + Appointments (standard)

### Communications Tab
Emails (standard)

### Timeline Tab
Notes + audit (standard, with ADD NOTE, EXPORT, filters)

---

## Notes

- Claims are **read-only** — synced via CW webhooks
- No "Create Claim" in the vendor UI
- All incident/policy fields come from the insurer
- Status transitions are insurer-driven
