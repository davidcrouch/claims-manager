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

Contacts are deduplicated by `(tenant_id, external_reference)`:

```typescript
async upsertFromApi(params: {
  tenantId: string;
  apiContact: CrunchworkContactDto;
}): Promise<Contact> {
  const existing = await this.contactRepo.findOne({
    where: {
      tenantId: params.tenantId,
      externalReference: params.apiContact.externalReference,
    },
  });

  const contactData = {
    tenantId: params.tenantId,
    externalReference: params.apiContact.externalReference,
    firstName: params.apiContact.firstName,
    lastName: params.apiContact.lastName,
    email: params.apiContact.email,
    mobilePhone: params.apiContact.mobilePhone,
    homePhone: params.apiContact.homePhone,
    workPhone: params.apiContact.workPhone,
    notes: params.apiContact.notes,
    contactPayload: params.apiContact,
  };

  // Resolve lookup values for type and preferredMethodOfContact
  if (params.apiContact.type?.externalReference) {
    contactData.typeLookupId = await this.lookupsService.resolveOrCreate({
      domain: LookupDomain.CONTACT_TYPE,
      externalReference: params.apiContact.type.externalReference,
      name: params.apiContact.type.name,
    });
  }

  if (existing) {
    await this.contactRepo.update(existing.id, contactData);
    return { ...existing, ...contactData };
  }

  return this.contactRepo.save(contactData);
}
```

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

The ClaimsSyncService and JobsSyncService call `ContactsService.upsertFromApi()` for each contact in the API response, then create the appropriate join table entries (`claim_contacts` or `job_contacts`).

---

## Acceptance Criteria

- [ ] Contacts deduplicated by `(tenant_id, external_reference)`
- [ ] Contact data updated on each sync from API
- [ ] Contact type and preferred method resolved via lookups
- [ ] Contacts queryable by claim or job
- [ ] Full contact payload preserved in JSONB
