# 06 — Multi-Tenancy Module

## Objective

Implement request-scoped tenant isolation so every database query and external API call is automatically scoped to the authenticated user's tenant.

---

## Steps

### 6.1 Module Structure

```
src/tenant/
├── tenant.module.ts
├── tenant.service.ts
├── tenant.middleware.ts        # extracts tenant from JWT
├── tenant-context.ts           # request-scoped context holder
├── decorators/
│   └── current-tenant.decorator.ts
└── interfaces/
    └── tenant-context.interface.ts
```

### 6.2 Tenant Context (Request-Scoped)

Use `@Injectable({ scope: Scope.REQUEST })` or `cls-hooked` / `AsyncLocalStorage` for request-scoped tenant context:

```typescript
@Injectable()
export class TenantContext {
  private tenantId: string;
  private crunchworkTenantId: string;

  setTenant(params: { tenantId: string; crunchworkTenantId: string }) {
    this.tenantId = params.tenantId;
    this.crunchworkTenantId = params.crunchworkTenantId;
  }

  getTenantId(): string {
    return this.tenantId;
  }

  getCrunchworkTenantId(): string {
    return this.crunchworkTenantId;
  }
}
```

### 6.3 Tenant Resolution — JWT is the Source of Truth

The project's own auth server includes `tenantId` directly in the JWT access token. This is the primary and trusted source for tenant identity.

**Resolution flow:**
1. JWT is validated by the Auth Module (doc 04)
2. `tenantId` is extracted from the JWT payload
3. Tenant Middleware looks up the local `tenants` table to map `tenantId` → `crunchwork_tenant_id`
4. The `crunchwork_tenant_id` is used as the `active-tenant-id` header on all Crunchwork API calls

**Multi-tenant users:** If the auth server supports users belonging to multiple tenants, the token issued for a session already contains the selected tenant. Switching tenants in the UI would trigger a new token from the auth server with the new `tenantId`. The API server does not need to validate tenant selection — it trusts the JWT.

### 6.4 Tenant Middleware

Runs after auth, resolves the Crunchwork tenant mapping from the JWT's `tenantId`:

```typescript
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly tenantService: TenantService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const user = req.user as AuthenticatedUser;
    if (!user) {
      next();
      return;
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'TenantMiddleware.use - no tenantId in JWT'
      );
    }

    // Look up the local tenant record to get the Crunchwork mapping
    const tenant = await this.tenantService.resolve({
      tenantId,
    });

    this.tenantContext.setTenant({
      tenantId: tenant.id,
      crunchworkTenantId: tenant.crunchworkTenantId,
    });

    next();
  }
}
```

### 6.5 Tenant Service

Manages the `tenants` table and maps between the JWT `tenantId` and the Crunchwork `active-tenant-id`:

```typescript
@Injectable()
export class TenantService {
  private readonly logger = new Logger('TenantService');

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async resolve(params: { tenantId: string }): Promise<Tenant> {
    // tenantId from JWT could match either the local id or the code column
    const tenant = await this.tenantRepo.findOne({
      where: [
        { id: params.tenantId },
        { code: params.tenantId },
      ],
    });
    if (!tenant) {
      this.logger.warn(
        `TenantService.resolve - unknown tenant: ${params.tenantId}`
      );
      throw new ForbiddenException(
        `TenantService.resolve - unknown tenant: ${params.tenantId}`
      );
    }
    if (!tenant.crunchworkTenantId) {
      this.logger.warn(
        `TenantService.resolve - tenant ${params.tenantId} has no Crunchwork mapping`
      );
    }
    return tenant;
  }
}
```

### 6.6 Tenant Entity

Maps between the local system and Crunchwork:

```typescript
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;  // matches the tenantId value embedded in JWTs

  @Column()
  name: string;

  @Column({ name: 'crunchwork_tenant_id', nullable: true })
  crunchworkTenantId: string;  // the active-tenant-id for CW API calls

  @Column({ name: 'client_code', nullable: true })
  clientCode: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### 6.6 Current Tenant Decorator

```typescript
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantContext;
  },
);
```

### 6.7 Tenant-Scoped Repository Pattern

Create a base service that automatically applies tenant filtering:

```typescript
export abstract class TenantScopedService<T extends TenantScopedEntity> {
  constructor(
    protected readonly repository: Repository<T>,
    protected readonly tenantContext: TenantContext,
  ) {}

  protected get tenantId(): string {
    return this.tenantContext.getTenantId();
  }

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find({
      ...options,
      where: { ...options?.where, tenantId: this.tenantId } as any,
    });
  }

  async findOne(id: string): Promise<T | null> {
    return this.repository.findOne({
      where: { id, tenantId: this.tenantId } as any,
    });
  }
}
```

### 6.8 Module Registration

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [TenantService, TenantContext],
  exports: [TenantService, TenantContext],
})
export class TenantModule {}
```

Apply middleware in `AppModule`:

```typescript
configure(consumer: MiddlewareConsumer) {
  consumer.apply(TenantMiddleware).forRoutes('*');
}
```

---

## Acceptance Criteria

- [ ] Every authenticated request has tenant context available
- [ ] Database queries are automatically tenant-scoped
- [ ] Crunchwork API calls use the correct `active-tenant-id`
- [ ] Requests with unknown tenant receive 403
- [ ] Tenant context is properly isolated between concurrent requests
- [ ] `tenantId` from JWT is resolved to the correct Crunchwork `active-tenant-id`
- [ ] Tenant without Crunchwork mapping logs a warning but does not crash
