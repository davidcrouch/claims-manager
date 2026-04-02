# 17 — Attachments Module

## Objective

Implement the Attachments module for uploading, downloading, and managing file attachments. Attachments are polymorphic — they can be linked to claims, jobs, POs, quotes, reports, and other entities via `relatedRecordType` and `relatedRecordId`.

---

## Steps

### 17.1 Module Structure

```
src/modules/attachments/
├── attachments.module.ts
├── attachments.controller.ts
├── attachments.service.ts
├── attachments-sync.service.ts
├── dto/
│   ├── create-attachment.dto.ts
│   ├── update-attachment.dto.ts
│   ├── attachment-query.dto.ts
│   └── attachment-response.dto.ts
├── mappers/
│   └── attachment.mapper.ts
└── interfaces/
    └── attachment.interface.ts
```

### 17.2 Controller Endpoints

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/attachments` | Create attachment (upload) | Vendor |
| `GET` | `/attachments/:id` | Get attachment metadata | Insurance, Vendor |
| `POST` | `/attachments/:id` | Update attachment metadata | Vendor |
| `GET` | `/attachments/:id/download` | Download attachment file | Insurance, Vendor |

### 17.3 Service Layer

```typescript
@Injectable()
export class AttachmentsService {
  async create(params: { dto: CreateAttachmentDto; file?: Express.Multer.File }): Promise<AttachmentResponseDto>;
  async findOne(params: { id: string }): Promise<AttachmentResponseDto>;
  async findByRelatedRecord(params: {
    relatedRecordType: string;
    relatedRecordId: string;
  }): Promise<AttachmentResponseDto[]>;
  async update(params: { id: string; dto: UpdateAttachmentDto }): Promise<AttachmentResponseDto>;
  async download(params: { id: string }): Promise<StreamableFile>;
}
```

### 17.4 File vs Metadata Transfer

Per the API spec (Section 3.4.1), attachments support two transfer modes:

1. **File Transfer**: Multipart form data with actual file bytes
2. **Metadata Transfer**: JSON body with file URL for the API to fetch

The controller handles both via `@UseInterceptors(FileInterceptor('file'))`.

### 17.5 Attachment Types

Per the API spec, valid `relatedRecordType` values:
- `Claim`, `Job`, `PurchaseOrder`, `Quote`, `Report`, `Tender`, `Invoice`, `Contact`, `Vendor`, `PulseJob`

### 17.6 Create Attachment DTO

```typescript
export class CreateAttachmentDto {
  @IsString() relatedRecordType: string;
  @IsUUID() relatedRecordId: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() documentTypeExternalReference?: string;
  @IsOptional() @IsUrl() fileUrl?: string;  // for metadata transfer mode
}
```

### 17.7 Download Proxy

The download endpoint proxies the Crunchwork `GET /attachments/{id}/download` and streams the response:

```typescript
async download(params: { id: string }): Promise<StreamableFile> {
  const stream = await this.crunchworkService.downloadAttachment({
    tenantId: this.tenantContext.getCrunchworkTenantId(),
    attachmentId: params.id,
  });
  return new StreamableFile(stream);
}
```

### 17.8 Webhook Events

- `NEW_ATTACHMENT`: Vendor-created attachments
- `UPDATE_ATTACHMENT`: Metadata updates

---

## Acceptance Criteria

- [ ] File upload via multipart form data works
- [ ] Metadata-only creation (with fileUrl) works
- [ ] Download streams file from Crunchwork API
- [ ] Attachments correctly linked to parent entities
- [ ] Document type lookup resolved correctly
- [ ] Attachment list by related record works
