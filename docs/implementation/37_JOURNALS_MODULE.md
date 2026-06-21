# 37 — Journals Module (Full Stack)

## Objective

Implement the Journals entity. A Journal is an independent, location-aware, multimedia log that can be *linked* to one or more Jobs, Quotes (estimates), or Invoices. Each journal contains ordered pages — conversational entries that combine text, photos, and file attachments with geo-coordinates captured at the time of entry. Journals are created standalone and then associated with entities via a many-to-many link table.

---

## Prerequisites

- Database schema module (plan 03) — Drizzle + PostgreSQL
- Attachments module (plan 17) — file upload/storage patterns
- Jobs module (plan 09), Quotes module (plan 10), Invoices module (plan 12) — parent entities
- UI Foundation (plans 25a–25e) — layout, components, drawers

---

## Domain Context

A Journal serves as a field diary for work performed against a job, estimate, or invoice. Common use cases:

- **Site visit log** — photos of damage, GPS-tagged entries at the loss site
- **Progress diary** — daily notes with photos showing work progression
- **Evidence collection** — timestamped, geo-located photos and notes for claims evidence
- **Delivery record** — documented material delivery with photos and location proof

Key characteristics:

- **Independent entity** — a journal is created standalone, then *linked* to one or more Jobs, Quotes, or Invoices via a `journal_entity_links` join table
- **Many-to-many** — a single journal can be linked to multiple parent entities; an entity can have multiple journals
- **Location-aware** — the journal itself can have an address + coordinates; each page independently captures coordinates (phone GPS)
- **Multimedia** — pages support rich text, inline images, and file attachments (video, documents)
- **Conversational** — pages are ordered chronologically, creating a timeline narrative
- **Thumbnail** — optional cover image for list views
- **Local-only** — journals are not synced to external APIs; they live entirely in the local database and object storage

---

## Data Model

```
┌──────────────┐       ┌─────────────────────┐       ┌──────────────────┐       ┌─────────────────────────┐
│   Job /      │ *───* │  journal_entity_    │ *───1 │     Journal      │ 1───* │     Journal Page        │
│   Quote /    │       │  links              │       │                  │       │                         │
│   Invoice    │       │                     │       │ name             │       │ body (rich text)        │
│              │       │  journalId          │       │ description      │       │ latitude / longitude    │
└──────────────┘       │  entityType         │       │ address (jsonb)  │       │ capturedAt              │
                       │  entityId           │       │ latitude / long  │       │ sortIndex               │
                       └─────────────────────┘       │ thumbnailUrl     │       └────────────┬────────────┘
                                                     │ status           │                    │
                                                     └──────────────────┘                    │ 1───*
                                                                              ┌───────────┴────────────┐
                                                                              │  Journal Page          │
                                                                              │  Attachment            │
                                                                              │                        │
                                                                              │  fileName, mimeType    │
                                                                              │  fileSize, storageKey  │
                                                                              │  caption               │
                                                                              │  sortIndex             │
                                                                              └────────────────────────┘
```

---

## Steps

### 37.1 Database Schema

**File:** `apps/api/src/database/schema/index.ts`

#### `journals` table

Journals are standalone entities with no direct parent FK columns. Entity associations are managed via `journal_entity_links`.

```typescript
export const journals = pgTable(
  'journals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('active'),

    // Optional address
    address: jsonb('address').notNull().default({}),
    addressPostcode: text('address_postcode'),
    addressSuburb: text('address_suburb'),
    addressState: text('address_state'),
    addressCountry: text('address_country'),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),

    // Optional thumbnail
    thumbnailUrl: text('thumbnail_url'),
    thumbnailStorageKey: text('thumbnail_storage_key'),

    metadata: jsonb('metadata').notNull().default({}),
    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_journal_status', sql`status IN ('active', 'archived', 'deleted')`),
    index('idx_journals_tenant').on(t.tenantId, t.status),
  ],
);
```

#### `journal_entity_links` table

Many-to-many join table linking journals to Jobs, Quotes, or Invoices.

```typescript
export const journalEntityLinks = pgTable(
  'journal_entity_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    journalId: uuid('journal_id')
      .notNull()
      .references(() => journals.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),  // 'Job' | 'Quote' | 'Invoice'
    entityId: uuid('entity_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_journal_link_entity_type', sql`entity_type IN ('Job', 'Quote', 'Invoice')`),
    uniqueIndex('UQ_journal_entity_link').on(t.journalId, t.entityType, t.entityId),
    index('idx_journal_links_entity').on(t.tenantId, t.entityType, t.entityId),
    index('idx_journal_links_journal').on(t.tenantId, t.journalId),
  ],
);
```

#### `journal_pages` table

```typescript
export const journalPages = pgTable(
  'journal_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    journalId: uuid('journal_id')
      .notNull()
      .references(() => journals.id, { onDelete: 'cascade' }),

    body: text('body'),
    bodyFormat: text('body_format').notNull().default('plaintext'),

    // Geo-coordinates captured at time of entry
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    locationAccuracy: numeric('location_accuracy', { precision: 10, scale: 2 }),
    locationLabel: text('location_label'),

    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    sortIndex: integer('sort_index').notNull().default(0),

    metadata: jsonb('metadata').notNull().default({}),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_page_body_format', sql`body_format IN ('plaintext', 'markdown', 'html')`),
    index('idx_journal_pages_journal').on(t.tenantId, t.journalId),
    index('idx_journal_pages_captured').on(t.journalId, t.capturedAt),
    index('idx_journal_pages_sort').on(t.journalId, t.sortIndex),
  ],
);
```

#### `journal_page_attachments` table

```typescript
export const journalPageAttachments = pgTable(
  'journal_page_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    journalPageId: uuid('journal_page_id')
      .notNull()
      .references(() => journalPages.id, { onDelete: 'cascade' }),

    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }),
    storageProvider: text('storage_provider').notNull().default('r2'),
    storageKey: text('storage_key').notNull(),
    fileUrl: text('file_url'),

    caption: text('caption'),
    sortIndex: integer('sort_index').notNull().default(0),

    // Image/video specific
    width: integer('width'),
    height: integer('height'),
    durationSeconds: numeric('duration_seconds', { precision: 10, scale: 2 }),
    thumbnailStorageKey: text('thumbnail_storage_key'),

    metadata: jsonb('metadata').notNull().default({}),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_journal_page_attachments_page').on(t.tenantId, t.journalPageId),
    index('idx_journal_page_attachments_type').on(t.tenantId, t.mimeType),
  ],
);
```

---

### 37.2 Database Migration

Generate a Drizzle migration after adding the schema tables:

```bash
pnpm --filter api drizzle-kit generate
```

---

### 37.3 Repository Layer

**File:** `apps/api/src/database/repositories/journals.repository.ts`

```typescript
@Injectable()
export class JournalsRepository {
  constructor(@Inject('DRIZZLE') private db: DrizzleDB) {}

  async findAll(params: { tenantId: string; page?: number; limit?: number; status?: string }): Promise<{ data: Journal[]; total: number }>;
  async findOne(params: { id: string; tenantId: string }): Promise<Journal | null>;
  async findByEntity(params: { tenantId: string; entityType: string; entityId: string }): Promise<Journal[]>;
  async create(params: { data: JournalInsert }): Promise<Journal>;
  async update(params: { id: string; data: Partial<JournalInsert> }): Promise<Journal | null>;
  async softDelete(params: { id: string }): Promise<void>;
  async getPageCount(params: { journalId: string; tenantId: string }): Promise<number>;

  // Entity link management
  async linkToEntity(params: { data: JournalEntityLinkInsert }): Promise<JournalEntityLink>;
  async unlinkFromEntity(params: { tenantId: string; journalId: string; entityType: string; entityId: string }): Promise<void>;
  async getEntityLinks(params: { tenantId: string; journalId: string }): Promise<JournalEntityLink[]>;
}
```

**File:** `apps/api/src/database/repositories/journal-pages.repository.ts`

```typescript
@Injectable()
export class JournalPagesRepository {
  constructor(@Inject('DRIZZLE') private db: DrizzleDB) {}

  async create(params: { tenantId: string; data: InsertJournalPage }): Promise<JournalPage>;
  async findById(params: { tenantId: string; id: string }): Promise<JournalPage | null>;
  async findByJournal(params: {
    tenantId: string;
    journalId: string;
    limit?: number;
    offset?: number;
  }): Promise<JournalPage[]>;
  async update(params: { tenantId: string; id: string; data: Partial<InsertJournalPage> }): Promise<JournalPage>;
  async softDelete(params: { tenantId: string; id: string }): Promise<void>;
  async reorder(params: { tenantId: string; journalId: string; pageIds: string[] }): Promise<void>;
}
```

**File:** `apps/api/src/database/repositories/journal-page-attachments.repository.ts`

```typescript
@Injectable()
export class JournalPageAttachmentsRepository {
  constructor(@Inject('DRIZZLE') private db: DrizzleDB) {}

  async create(params: { tenantId: string; data: InsertJournalPageAttachment }): Promise<JournalPageAttachment>;
  async findByPage(params: { tenantId: string; journalPageId: string }): Promise<JournalPageAttachment[]>;
  async delete(params: { tenantId: string; id: string }): Promise<void>;
}
```

Register all three repositories in `apps/api/src/database/repositories/index.ts`.

---

### 37.4 API Module Structure

```
apps/api/src/modules/journals/
├── journals.module.ts
├── journals.controller.ts
├── journals.service.ts
├── journal-pages.controller.ts
├── journal-pages.service.ts
├── journal-page-attachments.service.ts
├── dto/
│   ├── create-journal.dto.ts
│   ├── update-journal.dto.ts
│   ├── journal-query.dto.ts
│   ├── journal-response.dto.ts
│   ├── create-journal-page.dto.ts
│   ├── update-journal-page.dto.ts
│   ├── journal-page-response.dto.ts
│   ├── create-page-attachment.dto.ts
│   └── page-attachment-response.dto.ts
└── interfaces/
    └── journal.interface.ts
```

---

### 37.5 Controller Endpoints

#### Journals

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/journals` | List all journals (paginated) | Authenticated |
| `POST` | `/journals` | Create a journal (standalone) | Authenticated |
| `GET` | `/journals/:id` | Get journal by ID (includes entity links) | Authenticated |
| `PATCH` | `/journals/:id` | Update journal metadata | Authenticated |
| `DELETE` | `/journals/:id` | Soft-delete journal | Authenticated |
| `GET` | `/journals/entity/:entityType/:entityId` | List journals linked to a specific entity | Authenticated |
| `POST` | `/journals/:journalId/link` | Link journal to an entity | Authenticated |
| `DELETE` | `/journals/:journalId/link/:entityType/:entityId` | Unlink journal from an entity | Authenticated |

#### Journal Pages

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/journals/:journalId/pages` | Create a page entry | Authenticated |
| `GET` | `/journals/:journalId/pages` | List pages (paginated) | Authenticated |
| `GET` | `/journals/:journalId/pages/:pageId` | Get single page with attachments | Authenticated |
| `PATCH` | `/journals/:journalId/pages/:pageId` | Update page text/metadata | Authenticated |
| `DELETE` | `/journals/:journalId/pages/:pageId` | Soft-delete page | Authenticated |
| `POST` | `/journals/:journalId/pages/reorder` | Reorder pages | Authenticated |

#### Page Attachments

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/journals/:journalId/pages/:pageId/attachments` | Upload attachment(s) | Authenticated |
| `GET` | `/journals/:journalId/pages/:pageId/attachments/:attachmentId/download` | Download file | Authenticated |
| `DELETE` | `/journals/:journalId/pages/:pageId/attachments/:attachmentId` | Remove attachment | Authenticated |

---

### 37.6 Service Layer

```typescript
@Injectable()
export class JournalsService {
  // Journal CRUD (standalone — no parent required)
  async findAll(params: { page?: number; limit?: number; status?: string }): Promise<{ data: Journal[]; total: number }>;
  async findOne(params: { id: string }): Promise<JournalWithLinks>;
  async findByEntity(params: { entityType: string; entityId: string }): Promise<Journal[]>;
  async create(params: { body: { name: string; description?: string; address?: object; latitude?: number; longitude?: number } }): Promise<Journal>;
  async update(params: { id: string; body: Partial<JournalUpdate> }): Promise<Journal>;
  async softDelete(params: { id: string }): Promise<{ deleted: true }>;

  // Entity linking
  async linkToEntity(params: { journalId: string; entityType: string; entityId: string }): Promise<JournalEntityLink>;
  async unlinkFromEntity(params: { journalId: string; entityType: string; entityId: string }): Promise<{ unlinked: true }>;

  // Pages
  async getPages(params: { journalId: string; limit?: number; offset?: number }): Promise<{ data: PageWithAttachments[]; total: number }>;
  async getPage(params: { journalId: string; pageId: string }): Promise<PageWithAttachments>;
  async createPage(params: { journalId: string; body: CreatePageBody }): Promise<JournalPage>;
  async updatePage(params: { journalId: string; pageId: string; body: Partial<UpdatePageBody> }): Promise<JournalPage>;
  async deletePage(params: { journalId: string; pageId: string }): Promise<{ deleted: true }>;
  async reorderPages(params: { journalId: string; pageIds: string[] }): Promise<{ reordered: true }>;

  // Attachments
  async createAttachment(params: { journalId: string; pageId: string; body: CreateAttachmentBody }): Promise<JournalPageAttachment>;
  async deleteAttachment(params: { journalId: string; pageId: string; attachmentId: string }): Promise<{ deleted: true }>;
}
```

---

### 37.7 DTOs

#### CreateJournalDto

Journals are created without any parent reference. Linking is a separate action.

```typescript
export class CreateJournalDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() address?: Record<string, any>;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
}
```

#### LinkJournalDto

```typescript
export class LinkJournalDto {
  @IsIn(['Job', 'Quote', 'Invoice']) entityType: string;
  @IsUUID() entityId: string;
}
```

#### CreateJournalPageDto

```typescript
export class CreateJournalPageDto {
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsIn(['plaintext', 'markdown', 'html']) bodyFormat?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsNumber() locationAccuracy?: number;
  @IsOptional() @IsString() locationLabel?: string;
  @IsOptional() @IsDateString() capturedAt?: string;
}
```

---

### 37.8 File Storage

Journal page attachments (photos, videos, documents) are stored in **Cloudflare R2** (or local filesystem in development). The storage key pattern:

```
journals/{tenantId}/{journalId}/pages/{pageId}/{uuid}-{filename}
```

Thumbnail storage:
```
journals/{tenantId}/{journalId}/thumbnail/{uuid}-{filename}
```

The `JournalPageAttachmentsService` handles:
- Multipart upload via `@UseInterceptors(FileInterceptor('file'))`
- MIME type validation (images: jpg/png/webp/heic; video: mp4/mov/webm; documents: pdf/doc/docx)
- Image thumbnail generation for gallery views (via Sharp or delegated to a worker)
- File size limits configurable per tenant (default: 50 MB per file, 500 MB per journal)

---

### 37.9 Frontend — Journal List Component

**File:** `apps/frontend/src/components/journals/JournalList.tsx`

Displayed as a tab/section on Job detail, Quote detail, and Invoice detail pages. Shows:
- Card grid of journals with thumbnail, name, description, page count, last updated
- **"New Journal"** button — creates a journal and immediately links it to the current entity
- **"Link Existing"** button — opens `JournalLinkDrawer` to search and link an existing journal
- **Unlink** action on each card — removes the link (does not delete the journal)
- Click-through to journal detail view

---

### 37.10 Frontend — Journal Detail Page

**File:** `apps/frontend/src/app/(app)/journals/[id]/page.tsx`

Layout:
- Header: journal name, description, address/map pin, status badge
- Timeline view of pages (newest first or configurable order)
- Each page card shows: text body, photo gallery grid, attachment chips, location pin, timestamp
- Floating "Add Entry" button for quick page creation

---

### 37.11 Frontend — Journal Creation Drawer

**File:** `apps/frontend/src/components/journals/JournalFormDrawer.tsx`

Creates a journal independently, then immediately links it to the current entity context (if opened from an entity detail page).

Fields:
- Name (required)
- Description (optional, textarea)
- Address (optional, with geocoding integration or manual lat/lng)
- Thumbnail upload (optional, image picker)

### 37.11b Frontend — Journal Link Drawer

**File:** `apps/frontend/src/components/journals/JournalLinkDrawer.tsx`

Allows users to search and link an existing journal to the current entity. Opened from the "Link Existing" button in `JournalList`.

---

### 37.12 Frontend — Page Entry Form

**File:** `apps/frontend/src/components/journals/PageEntryForm.tsx`

Conversational entry form:
- Rich text area for body content
- "Attach Photo" button (camera capture on mobile, file picker on desktop)
- "Attach File" button for videos/documents
- Auto-captures GPS coordinates if permission granted
- Location label (auto-filled via reverse geocoding or manual)
- Timestamp defaults to now, editable for backdating entries

---

### 37.13 Frontend — Page Timeline Component

**File:** `apps/frontend/src/components/journals/PageTimeline.tsx`

Renders pages as a vertical timeline:
- Date separators for multi-day journals
- Each entry shows: avatar/user, time, body text, photo thumbnails (click to expand), attachment list, map pin link
- Infinite scroll / pagination for journals with many pages
- Photo lightbox for full-size viewing

---

### 37.14 Frontend — Integration Points (Entity Detail Tabs)

Add a **"Journals" tab** to the following entity detail pages. The tab renders the `<JournalList>` component, showing all journals *linked* to that entity and providing both "New Journal" and "Link Existing" actions:

| Parent Entity | Page File | Tab Label | Props |
|---------------|-----------|-----------|-------|
| Job | `apps/frontend/src/components/jobs/tabs/JobJournalsTab.tsx` | Journals | `parentType="job"` `parentId={jobId}` |
| Estimates | Quote detail component | Journals | `parentType="quote"` `parentId={quoteId}` |
| Invoice | Invoice detail component | Journals | `parentType="invoice"` `parentId={invoiceId}` |

Each tab:
- Displays a card grid of journals (thumbnail, name, page count, last updated)
- **"New Journal"** button creates a journal and immediately links it to the entity
- **"Link Existing"** button opens a search drawer to link an existing journal
- **Unlink** action (per card) removes the association without deleting the journal
- Click a journal card to navigate to `/journals/[id]` detail view
- Shows an empty state with illustration when no journals are linked yet

The tab should be positioned after existing content tabs (e.g., after Attachments or Activity) using the same tab component pattern already used in those detail pages.

---

### 37.15 API Client Functions

**File:** `apps/frontend/src/lib/api-client.ts` (journals section)

```typescript
// Journal CRUD
getJournals(params?: { page?: number; limit?: number; status?: string }): Promise<PaginatedResponse<Journal>>;
getJournal(id: string): Promise<Journal>;  // includes entityLinks
createJournal(data: { name: string; description?: string; address?: object; latitude?: number; longitude?: number }): Promise<Journal>;
updateJournal(id: string, data: Partial<JournalUpdate>): Promise<Journal>;
deleteJournal(id: string): Promise<{ deleted: boolean }>;

// Entity linking
getJournalsByEntity(entityType: string, entityId: string): Promise<Journal[]>;
linkJournalToEntity(journalId: string, entityType: string, entityId: string): Promise<unknown>;
unlinkJournalFromEntity(journalId: string, entityType: string, entityId: string): Promise<{ unlinked: boolean }>;

// Pages
getJournalPages(journalId: string, params?: { limit?: number; offset?: number }): Promise<{ data: JournalPage[]; total: number }>;
getJournalPage(journalId: string, pageId: string): Promise<JournalPage>;
createJournalPage(journalId: string, data: CreatePageInput): Promise<JournalPage>;
updateJournalPage(journalId: string, pageId: string, data: Partial<UpdatePageInput>): Promise<JournalPage>;
deleteJournalPage(journalId: string, pageId: string): Promise<{ deleted: boolean }>;

// Attachments
createJournalPageAttachment(journalId: string, pageId: string, data: CreateAttachmentInput): Promise<JournalPageAttachment>;
deleteJournalPageAttachment(journalId: string, pageId: string, attachmentId: string): Promise<{ deleted: boolean }>;
```

---

### 37.16 Sidebar Navigation

**File:** `apps/frontend/src/components/layout/AppSidebar.tsx`

Add "Journals" entry to the **OPERATIONS** group, positioned **immediately before Tasks**:

```typescript
{
  label: 'OPERATIONS',
  defaultOpen: true,
  items: [
    { title: 'Journals', href: '/journals', icon: BookOpen },   // ← NEW
    { title: 'Tasks', href: '/tasks', icon: CheckSquare },
    { title: 'Schedule', href: '/schedule', icon: Calendar },
    { title: 'Messages', href: '/messages', icon: MessageSquare },
    { title: 'Appointments', href: '/appointments', icon: CalendarCheck },
    { title: 'Contacts', href: '/contacts', icon: Users },
    { title: 'Documents', href: '/admin/documents', icon: FolderOpen },
  ],
},
```

Import `BookOpen` from `lucide-react`.

This provides a standalone journals list page showing all journals, with entity link badges indicating which entities each journal is linked to.

---

### 37.17 Standalone Journals List Page

**File:** `apps/frontend/src/app/(app)/journals/page.tsx`

Features:
- Card grid with: Thumbnail, Name, Entity link badges (Job/Quote/Invoice), Pages count, Location, Last Updated
- Filters: status, date range
- Search by name/description
- Quick actions: archive, delete
- Click-through to journal detail page

---

## Non-Functional Requirements

### Performance
- Page attachments streamed (not buffered in memory)
- Thumbnail images served via CDN-cached URLs
- Journal pages paginated (default 20 per request)
- Database indexes support parent-type queries and chronological ordering

### Security
- All endpoints tenant-scoped (existing auth guard pattern)
- File uploads validated: MIME type whitelist, max size enforcement
- Storage keys include tenant isolation prefix
- Signed URLs for private attachment downloads (time-limited)

### Mobile Considerations
- GPS capture uses browser Geolocation API with graceful fallback
- Photo capture supports camera input on mobile (`capture="environment"`)
- Offline-capable entry creation (future enhancement — store locally, sync when online)

---

## Acceptance Criteria

- [ ] Journal CRUD works independently (no parent required at creation time)
- [ ] Journals can be linked to and unlinked from Jobs, Quotes, and Invoices
- [ ] A journal can be linked to multiple entities simultaneously
- [ ] Entity detail pages show linked journals with "Link Existing" and "New Journal" actions
- [ ] Unlinking a journal does not delete it
- [ ] Journal pages display in chronological timeline format
- [ ] Photos and files upload successfully with progress indication
- [ ] GPS coordinates captured automatically when permission granted
- [ ] Thumbnail displayed in journal list views
- [ ] Address/location shown on journal and page entries
- [ ] Journal tab appears on job, quote, and invoice detail pages
- [ ] Standalone journals list page works with filters and shows entity link badges
- [ ] Soft-delete cascades correctly (journal → pages → attachments; links removed on journal delete)
- [ ] File size limits enforced (configurable per tenant)
- [ ] All endpoints tenant-scoped and auth-protected

---

## Future Enhancements

- **Offline sync** — capture entries offline on mobile, sync when connectivity returns
- **Real-time collaboration** — multiple users adding pages to the same journal simultaneously
- **Export** — generate PDF report from journal (formatted timeline with embedded photos)
- **Templates** — pre-defined journal structures (e.g., "Site Inspection" with required fields)
- **Tagging** — tag pages for filtering (e.g., "damage", "progress", "completion")
- **Map view** — visualize all geo-tagged pages on a map
- **AI summarization** — auto-generate journal summary from page entries
