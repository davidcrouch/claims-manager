# 15 — Appointments Module

## Objective

Implement the Appointments module for scheduling site visits and digital meetings linked to jobs. Appointments have attendees (contacts or users), location types, and can be cancelled.

---

## Steps

### 15.1 Module Structure

```
src/modules/appointments/
├── appointments.module.ts
├── appointments.controller.ts
├── appointments.service.ts
├── appointments-sync.service.ts
├── dto/
│   ├── create-appointment.dto.ts
│   ├── update-appointment.dto.ts
│   ├── cancel-appointment.dto.ts
│   └── appointment-response.dto.ts
├── mappers/
│   └── appointment.mapper.ts
└── interfaces/
    └── appointment.interface.ts
```

### 15.2 Controller Endpoints

| Method | Route | Description | Phase | Auth | Notes |
|--------|-------|-------------|-------|------|-------|
| `POST` | `/appointments` | Create appointment | 1 | Vendor | |
| `GET` | `/appointments/:id` | Get appointment detail | **3** | Insurance, Vendor | Gate: Phase 3 |
| `POST` | `/appointments/:id` | Update appointment | **2** | Vendor | Gate: Phase 2 |
| `POST` | `/appointments/:id/cancel` | Cancel appointment | **5** | Vendor | Gate: Phase 5 — feature flag |

> **Phase gating:** Endpoints at Phase 2+ should degrade gracefully. Return 501 Not Implemented or a descriptive error if the corresponding Crunchwork phase is not yet active.

### 15.3 Service Layer

```typescript
@Injectable()
export class AppointmentsService {
  async create(params: { dto: CreateAppointmentDto }): Promise<AppointmentResponseDto>;
  async findOne(params: { id: string }): Promise<AppointmentResponseDto>;
  async findByJob(params: { jobId: string }): Promise<AppointmentResponseDto[]>;
  async update(params: { id: string; dto: UpdateAppointmentDto }): Promise<AppointmentResponseDto>;
  async cancel(params: { id: string; dto: CancelAppointmentDto }): Promise<AppointmentResponseDto>;
}
```

### 15.4 Create Appointment DTO

Per the API spec (Section 3.3.12 - JSON Body - Create Appointment):

```typescript
export class CreateAppointmentDto {
  @IsUUID() jobId: string;
  @IsString() name: string;
  @IsEnum(['ONSITE', 'DIGITAL']) location: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsString() appointmentTypeExternalReference?: string;
  @IsOptional() @IsString() specialistVisitTypeExternalReference?: string;
  @ValidateNested({ each: true })
  @Type(() => CreateAttendeeDto)
  attendees: CreateAttendeeDto[];
}

export class CreateAttendeeDto {
  @IsEnum(['CONTACT', 'USER']) attendeeType: string;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsUUID() contactId?: string;
  @IsOptional() @IsEmail() email?: string;
}
```

### 15.5 Cancel DTO

```typescript
export class CancelAppointmentDto {
  @IsString() reason: string;
}
```

### 15.6 Sync Service

```typescript
async syncFromApi(params: {
  tenantId: string;
  apiAppointment: CrunchworkAppointmentDto;
}): Promise<Appointment> {
  // 1. Upsert appointment record
  // 2. Link to job
  // 3. Resolve lookups: appointment_type, specialist_visit_type
  // 4. Store cancellation_details JSONB (if cancelled)
  // 5. Sync attendees → appointment_attendees table
}
```

### 15.7 Appointments in Job Context

Appointments are also returned as a nested array in the Job object from the API. The sync service handles both standalone appointment responses and embedded appointment arrays from job responses.

---

## Acceptance Criteria

- [ ] `POST /appointments` creates appointment in Crunchwork and persists locally
- [ ] Attendees properly linked to contacts and users
- [ ] `POST /appointments/:id/cancel` cancels with reason
- [ ] Location constraint enforced (ONSITE or DIGITAL)
- [ ] Appointments accessible via job context
