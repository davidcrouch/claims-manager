# 04 — Authentication Module

## Objective

Implement OAuth2 bearer token validation for incoming requests from the Next.js frontend. The project has its own auth server that issues JWT access tokens containing user identity, roles, and `tenantId`. This module validates those JWTs and attaches the authenticated user context to every request.

---

## Steps

### 4.1 Module Structure

```
src/auth/
├── auth.module.ts
├── auth.controller.ts          # optional: token introspection, user info
├── auth.service.ts
├── strategies/
│   └── jwt.strategy.ts         # Passport JWT strategy (own auth server JWKS)
├── guards/
│   ├── jwt-auth.guard.ts       # applies JWT validation
│   └── roles.guard.ts          # role-based access (Admin, Vendor, etc.)
├── decorators/
│   ├── current-user.decorator.ts
│   ├── public.decorator.ts     # mark routes as public (no auth)
│   └── roles.decorator.ts
├── interfaces/
│   └── jwt-payload.interface.ts
└── dto/
    └── token-response.dto.ts
```

### 4.2 JWT Strategy (Project Auth Server)

The project's own auth server issues JWTs with:
- `sub` — user ID
- `email` — user email
- `roles` — array of role strings (e.g., `["Admin"]`, `["Vendor"]`)
- `tenantId` — the tenant UUID embedded directly in the token

Use `passport-jwt` with JWKS verification against the auth server's public keys:

```typescript
// strategies/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer: configService.get('auth.issuerUrl'),
      audience: configService.get('auth.audience'),
      algorithms: ['RS256'],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksUri: configService.get('auth.jwksUri'),
      }),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles || [],
      tenantId: payload.tenantId,
    };
  }
}
```

### 4.3 Additional Dependencies

```bash
pnpm add jwks-rsa passport-jwt
pnpm add -D @types/passport-jwt
```

### 4.4 JWT Auth Guard

```typescript
// guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

Register as global guard in `AuthModule`:

```typescript
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
]
```

### 4.5 Roles Guard

```typescript
// guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { roles } = context.switchToHttp().getRequest().user;
    return requiredRoles.some((role) => roles.includes(role));
  }
}
```

### 4.6 Custom Decorators

```typescript
// decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    return data ? user?.[data] : user;
  },
);

// decorators/public.decorator.ts
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// decorators/roles.decorator.ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

### 4.7 AuthenticatedUser Interface

```typescript
export interface AuthenticatedUser {
  sub: string;          // user ID from auth server
  email: string;
  roles: string[];      // e.g. ['Admin'], ['Vendor'], ['ClaimsManager']
  tenantId: string;     // tenant UUID from JWT — used to resolve Crunchwork active-tenant-id
}
```

### 4.8 JWT Payload Interface

```typescript
export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  tenantId: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}
```

### 4.9 Tenant Flow: JWT → Crunchwork Header

The `tenantId` in the JWT is used by the Tenant Module (doc 06) to:
1. Look up the local `tenants` table to find the corresponding `crunchwork_tenant_id`
2. Pass that value as the `active-tenant-id` header on all Crunchwork API calls

```
Frontend → Authorization: Bearer <jwt containing tenantId>
  → NestJS extracts tenantId from JWT
    → TenantService resolves crunchwork_tenant_id from local tenants table
      → CrunchworkService sends: active-tenant-id: <crunchwork_tenant_id>
```

### 4.10 Module Registration

```typescript
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    AuthService,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
```

---

## Acceptance Criteria

- [ ] Requests without `Authorization: Bearer <token>` receive 401
- [ ] Valid JWTs from the project auth server are accepted and user is resolved
- [ ] `tenantId` extracted from JWT and available in request context
- [ ] `@Public()` decorator bypasses auth for specific routes (e.g., health, webhooks)
- [ ] `@Roles('Admin')` restricts access by role
- [ ] `@CurrentUser()` extracts authenticated user in controllers
- [ ] Invalid/expired tokens receive 401 with descriptive message
- [ ] JWKS keys are cached and rate-limited to avoid excessive calls to auth server
