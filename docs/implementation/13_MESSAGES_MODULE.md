# 13 — Messages Module

## Objective

Implement the Messages module for job-level communication between Insurance and Vendor teams. Messages can require acknowledgement and are routed between claim/job contexts.

---

## Steps

### 13.1 Module Structure

```
src/modules/messages/
├── messages.module.ts
├── messages.controller.ts
├── messages.service.ts
├── messages-sync.service.ts
├── dto/
│   ├── create-message.dto.ts
│   ├── message-query.dto.ts
│   └── message-response.dto.ts
├── mappers/
│   └── message.mapper.ts
└── interfaces/
    └── message.interface.ts
```

### 13.2 Controller Endpoints

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/messages` | Create message | Insurance, Vendor |
| `GET` | `/messages` | List messages (local DB) | All authenticated |
| `GET` | `/messages/:id` | Get message detail | Insurance, Vendor |
| `POST` | `/messages/:id/acknowledge` | Acknowledge message | Insurance, Vendor |

### 13.3 Service Layer

```typescript
@Injectable()
export class MessagesService {
  async create(params: { dto: CreateMessageDto }): Promise<MessageResponseDto>;
  async findAll(params: { query: MessageQueryDto }): Promise<PaginatedResponse<MessageResponseDto>>;
  async findOne(params: { id: string }): Promise<MessageResponseDto>;
  async findByJob(params: { jobId: string }): Promise<MessageResponseDto[]>;
  async acknowledge(params: { id: string }): Promise<MessageResponseDto>;
}
```

### 13.4 Message Routing

Messages have `from` and `to` contexts that specify claim or job:

```typescript
export class CreateMessageDto {
  @IsOptional() @IsUUID() fromClaimId?: string;
  @IsOptional() @IsUUID() fromJobId?: string;
  @IsOptional() @IsUUID() toClaimId?: string;
  @IsOptional() @IsUUID() toJobId?: string;
  @IsOptional() @IsString() toAssigneeTypeExternalReference?: string;
  @IsString() subject: string;
  @IsString() body: string;
  @IsOptional() @IsBoolean() acknowledgementRequired?: boolean;
}
```

### 13.5 Acknowledge Endpoint (Phase 5)

> **Phase dependency:** `POST /messages/{id}/acknowledge` is a **Phase 5** endpoint. Gate this behind a feature flag or phase-aware configuration. Return 501 Not Implemented if the phase is not yet active.

Per API spec (`POST /messages/{id}/acknowledge`), no body is required:

```typescript
async acknowledge(params: { id: string }): Promise<MessageResponseDto> {
  const cwResponse = await this.crunchworkService.acknowledgeMessage({
    tenantId: this.tenantContext.getCrunchworkTenantId(),
    messageId: params.id,
  });
  // Sync: set acknowledged_at and acknowledged_by_user_id
  return this.messagesSyncService.syncFromApi({ ... });
}
```

### 13.6 Webhook Integration

The `NEW_MESSAGE` webhook event triggers local sync:
- Only messages sent to the recipient trigger webhooks
- Webhook handler fetches full message via `GET /messages/{id}` and syncs

---

## Acceptance Criteria

- [ ] `POST /messages` creates message in Crunchwork and persists locally
- [ ] `POST /messages/:id/acknowledge` marks message as acknowledged
- [ ] Messages filterable by job, claim, acknowledgement status
- [ ] `NEW_MESSAGE` webhook syncs messages locally
- [ ] Message routing between claim/job contexts works correctly
