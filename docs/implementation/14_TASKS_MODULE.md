# 14 — Tasks Module

## Objective

Implement the Tasks module for creating and managing tasks associated with claims or jobs. Tasks have priorities, statuses, assignees, and due dates.

---

## Steps

### 14.1 Module Structure

```
src/modules/tasks/
├── tasks.module.ts
├── tasks.controller.ts
├── tasks.service.ts
├── tasks-sync.service.ts
├── dto/
│   ├── create-task.dto.ts
│   ├── update-task.dto.ts
│   ├── task-query.dto.ts
│   └── task-response.dto.ts
├── mappers/
│   └── task.mapper.ts
└── interfaces/
    └── task.interface.ts
```

### 14.2 Controller Endpoints

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/tasks` | Create task | Vendor |
| `GET` | `/tasks` | List tasks (local DB) | All authenticated |
| `GET` | `/tasks/:id` | Get task detail | Insurance, Vendor |
| `POST` | `/tasks/:id` | Update task | Vendor |

### 14.3 Service Layer

```typescript
@Injectable()
export class TasksService {
  async create(params: { dto: CreateTaskDto }): Promise<TaskResponseDto>;
  async findAll(params: { query: TaskQueryDto }): Promise<PaginatedResponse<TaskResponseDto>>;
  async findOne(params: { id: string }): Promise<TaskResponseDto>;
  async findByJob(params: { jobId: string }): Promise<TaskResponseDto[]>;
  async findByClaim(params: { claimId: string }): Promise<TaskResponseDto[]>;
  async update(params: { id: string; dto: UpdateTaskDto }): Promise<TaskResponseDto>;
}
```

### 14.4 Task Entity Constraints

From the DB design:
- Must have either `claimId` or `jobId` (check constraint)
- Priority: `Low`, `Medium`, `High`, `Critical`
- Status: `Open`, `Completed`, `Failed`

### 14.5 Create Task DTO

```typescript
export class CreateTaskDto {
  @IsOptional() @IsUUID() claimId?: string;
  @IsOptional() @IsUUID() jobId?: string;
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsEnum(['Low', 'Medium', 'High', 'Critical']) priority?: string;
  @IsOptional() @IsString() taskTypeExternalReference?: string;
  @IsOptional() @IsString() assignedToExternalReference?: string;
}
```

### 14.6 Webhook Events

- `NEW_TASK`: Only tasks allocated to the recipient
- `UPDATE_TASK`: Status and detail updates

---

## Acceptance Criteria

- [ ] `POST /tasks` creates task in Crunchwork and persists locally
- [ ] Task list filterable by status, priority, job, claim
- [ ] Task status transitions enforced (Open → Completed/Failed)
- [ ] `NEW_TASK` and `UPDATE_TASK` webhooks sync tasks locally
- [ ] Either claimId or jobId required on creation
