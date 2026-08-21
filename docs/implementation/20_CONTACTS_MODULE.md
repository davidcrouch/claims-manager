# 20 — Contacts Module

## Objective

Implement the shared Contacts module. Contacts appear in both claims and jobs as nested arrays in the API response. Locally, they are stored in a deduplicated `contacts` table and linked via `claim_contacts` and `job_contacts` join tables.

---

## Steps

### 20.1 Module Structure

```
src/modules/contacts/
├── contacts.module.ts
├── contacts.controller.ts
├── contacts.service.ts
├── dto/
│   ├── contact-query.dto.ts
│   └── contact-response.dto.ts
├── mappers/
│   └── contact.mapper.ts
└── interfaces/
    └── contact.interface.ts
```

### 20.2 Controller Endpoints

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/contacts` | List contacts (local DB) | All authenticated |
| `GET` | `/contacts/:id` | Get contact detail | All authenticated |

Contacts are created and updated indirectly through claim/job sync operations, not via standalone endpoints (the Crunchwork API manages contacts as nested arrays within claims/jobs).

### 20.3 Service Layer

```typescript
@Injectable()
export class ContactsService {
  async findAll(params: { query: ContactQueryDto }): Promise<PaginatedResponse<ContactResponseDto>>;
  async findOne(params: { id: string }): Promise<ContactResponseDto>;
  async findByClaim(params: { claimId: string }): Promise<ContactResponseDto[]>;
  async findByJob(params: { jobId: string }): Promise<ContactResponseDto[]>;

  async upsertFromApi(params: {
    tenantId: string;
    apiContact: CrunchworkContactDto;
  }): Promise<Contact>;
}
```

### 20.4 Deduplication Logic

Contacts are shared people rows. Identity match is a cascade (first hit wins,
tenant-scoped):

1. `external_reference`
2. email (case-insensitive)
3. any phone (mobile / home / work, digits-normalized)
4. first name + last name (case-insensitive)

On match, **fill empty fields only** (do not overwrite non-empty scalars). Always
apply inbound `external_reference` and `contact_payload` when provided. On miss,
create a new `contacts` row. Link via join tables:

- `claim_contacts` — many-to-many claim ↔ contact
- `job_contacts` — many-to-many job ↔ contact

Implemented by `ContactSyncService` during claim/job projection (not a standalone
`upsertFromApi` on the HTTP contacts module).

### 20.5 Contact Response DTO

```typescript
export class ContactResponseDto {
  id: string;
  externalReference: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  mobilePhone: string;
  homePhone: string;
  workPhone: string;
  type: LookupValueDto;
  preferredContactMethod: LookupValueDto;
  notes: string;
}
```

### 20.6 Integration with Claims and Jobs

`ProjectClaimUseCase` / `ProjectJobUseCase` call `ContactSyncService.syncForEntity()`
for each extracted contact, which upserts the shared `contacts` row then the
join row (`claim_contacts` or `job_contacts`).

---

## Acceptance Criteria

- [x] Contacts matched by identity cascade (ext-ref → email → phone → name)
- [x] Missing details filled on sync without overwriting existing values
- [x] Contact type and preferred method resolved via lookups
- [x] Contacts linked to claims/jobs via `claim_contacts` / `job_contacts`
- [x] Full contact payload preserved in JSONB
- [x] Contacts without `externalReference` still sync when email/phone/name present
