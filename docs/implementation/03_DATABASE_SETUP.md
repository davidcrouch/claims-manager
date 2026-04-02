# 03 — Database & TypeORM Setup

## Objective

Configure TypeORM with PostgreSQL, create entity classes matching the schema in `docs/design/01_DB_DESIGN.md`, and establish the migration workflow.

---

## Steps

### 3.1 Data Source Configuration

Create `src/database/data-source.ts` for CLI migrations and `TypeOrmModule.forRootAsync()` for runtime.

```typescript
// src/database/data-source.ts
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/database/entities/**/*.entity.ts'],
  migrations: ['src/database/migrations/**/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
```

### 3.2 TypeORM Module Registration

```typescript
// app.module.ts
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    url: config.get('database.databaseUrl'),
    entities: [__dirname + '/database/entities/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/database/migrations/**/*{.ts,.js}'],
    synchronize: false,
    logging: config.get('app.nodeEnv') === 'development',
  }),
})
```

### 3.3 Entity Classes

Create TypeORM entities matching `01_DB_DESIGN.md`. Each entity lives in `src/database/entities/`.

#### Core Entities to Create

| File | Table | Notes |
|------|-------|-------|
| `tenant.entity.ts` | `tenants` | |
| `user.entity.ts` | `users` | FK → tenants |
| `lookup-value.entity.ts` | `lookup_values` | Domain-driven reference data |
| `external-reference-log.entity.ts` | `external_reference_resolution_log` | Audit trail |
| `contact.entity.ts` | `contacts` | Shared across claims/jobs |
| `claim.entity.ts` | `claims` | JSONB: address, policy, financial, vulnerability, contention |
| `claim-contact.entity.ts` | `claim_contacts` | Join table |
| `claim-assignee.entity.ts` | `claim_assignees` | |
| `vendor.entity.ts` | `vendors` | JSONB: address, contact_details |
| `vendor-allocation-rule.entity.ts` | `vendor_allocation_rules` | |
| `job.entity.ts` | `jobs` | JSONB: address, vendor_snapshot, temp_accom, specialist, etc. |
| `job-contact.entity.ts` | `job_contacts` | Join table |
| `task.entity.ts` | `tasks` | |
| `quote.entity.ts` | `quotes` | JSONB: quote_to, quote_for, quote_from, schedule, approval |
| `quote-group.entity.ts` | `quote_groups` | |
| `quote-combo.entity.ts` | `quote_combos` | |
| `quote-item.entity.ts` | `quote_items` | |
| `invoice.entity.ts` | `invoices` | |
| `purchase-order.entity.ts` | `purchase_orders` | JSONB: po_to, po_for, po_from, service_window, etc. |
| `po-group.entity.ts` | `purchase_order_groups` | |
| `po-combo.entity.ts` | `purchase_order_combos` | |
| `po-item.entity.ts` | `purchase_order_items` | |
| `message.entity.ts` | `messages` | |
| `appointment.entity.ts` | `appointments` | |
| `appointment-attendee.entity.ts` | `appointment_attendees` | |
| `report.entity.ts` | `reports` | JSONB: report_data, report_meta |
| `attachment.entity.ts` | `attachments` | Polymorphic via related_record_type |
| `inbound-webhook-event.entity.ts` | `inbound_webhook_events` | Raw event storage |

### 3.4 Entity Design Patterns

#### JSONB Columns

Use TypeORM `jsonb` column type:

```typescript
@Column({ type: 'jsonb', default: {} })
address: Record<string, any>;
```

#### Promoted Columns

Extract frequently-queried fields alongside JSONB:

```typescript
@Column({ name: 'address_postcode', nullable: true })
addressPostcode: string;

@Column({ type: 'jsonb', default: {} })
address: Record<string, any>;
```

#### Tenant Scoping

Every operational entity includes:

```typescript
@Column({ name: 'tenant_id' })
@Index()
tenantId: string;

@ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'tenant_id' })
tenant: Tenant;
```

#### Soft Deletes

Entities with `deleted_at`:

```typescript
@DeleteDateColumn({ name: 'deleted_at' })
deletedAt: Date | null;
```

#### Timestamps

```typescript
@CreateDateColumn({ name: 'created_at' })
createdAt: Date;

@UpdateDateColumn({ name: 'updated_at' })
updatedAt: Date;
```

### 3.5 Base Entity

Create `src/database/entities/base.entity.ts` with common fields:

```typescript
export abstract class TenantScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### 3.6 Initial Migration

Generate the initial migration from entity definitions:

```bash
pnpm typeorm migration:generate src/database/migrations/InitialSchema -d src/database/data-source.ts
pnpm typeorm migration:run -d src/database/data-source.ts
```

### 3.7 Extensions Migration

First migration should enable required PostgreSQL extensions:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
```

### 3.8 Index Strategy

Ensure all indexes from `01_DB_DESIGN.md` are defined via `@Index()` decorators or in the migration:

- Composite indexes on `(tenant_id, ...)` for all query patterns
- GIN indexes on JSONB columns (`custom_data`, `address`, `report_data`)
- Unique constraints on `(tenant_id, external_reference)` pairs

---

## Acceptance Criteria

- [ ] All 28+ entity classes created and compile without errors
- [ ] Migration generates correct DDL matching the DB design doc
- [ ] Migration runs successfully against a fresh PostgreSQL database
- [ ] All indexes and constraints from the design doc are present
- [ ] `data-source.ts` works for both CLI and runtime usage
