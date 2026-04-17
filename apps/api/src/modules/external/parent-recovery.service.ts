import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ExternalObjectService } from './external-object.service';
import { ExternalObjectsRepository } from '../../database/repositories';
import { EntityMapperRegistry } from './entity-mapper.registry';
import { ParentNotProjectedError } from './errors/parent-not-projected.error';

export interface RecoveryOutcome {
  recovered: boolean;
  attempted: Array<{
    providerEntityType: string;
    providerEntityId: string;
    ok: boolean;
    reason?: string;
  }>;
}

/**
 * When a child projection fails because its parent row does not exist yet
 * (typical cause: child webhook arrived before parent webhook), this service
 * tries to fetch the parent entity from the provider (Crunchwork) and project
 * it inline so the child projection can be retried immediately.
 *
 * This is a best-effort optimisation. If recovery fails — e.g. the parent
 * fetch 404s, the parent itself has unresolved parents, or any other error —
 * we log and return without throwing, so the caller can fall back to a
 * deferred retry via WebhookRetryService.
 *
 * IMPORTANT: this runs OUTSIDE any transaction so we can issue HTTP calls. It
 * commits the parent's external_object + internal entity row in a fresh TX.
 * The subsequent child retry will then find the parent via resolveFK.
 */
@Injectable()
export class ParentRecoveryService {
  private readonly logger = new Logger('ParentRecoveryService');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly crunchworkService: CrunchworkService,
    private readonly externalObjectService: ExternalObjectService,
    private readonly externalObjectsRepo: ExternalObjectsRepository,
    private readonly mapperRegistry: EntityMapperRegistry,
  ) {}

  async recover(params: {
    tenantId: string;
    connectionId: string;
    providerCode: string;
    error: ParentNotProjectedError;
    sourceEventId?: string;
  }): Promise<RecoveryOutcome> {
    const logPrefix = 'ParentRecoveryService.recover';
    const outcome: RecoveryOutcome = { recovered: false, attempted: [] };

    const parents = params.error.resolvableParents();
    if (parents.length === 0) {
      this.logger.debug(
        `${logPrefix} — no resolvable parents for child=${params.error.childEntityType}/${params.error.childExternalObjectId}`,
      );
      return outcome;
    }

    for (const parent of parents) {
      const tag = `${parent.providerEntityType}/${parent.providerEntityId}`;
      this.logger.log(
        `${logPrefix} — attempting inline recovery parent=${tag} for child=${params.error.childEntityType}`,
      );

      try {
        const fullPayload = await this.crunchworkService.fetchEntityByType({
          connectionId: params.connectionId,
          entityType: parent.providerEntityType,
          entityId: parent.providerEntityId,
        });

        await this.db.transaction(async (tx) => {
          const { externalObject } =
            await this.externalObjectService.upsertFromFetch({
              tenantId: params.tenantId,
              connectionId: params.connectionId,
              providerCode: params.providerCode,
              providerEntityType: parent.providerEntityType,
              providerEntityId: parent.providerEntityId,
              normalizedEntityType: parent.providerEntityType,
              payload: fullPayload,
              sourceEventId: params.sourceEventId,
              tx,
            });

          const mapper = this.mapperRegistry.get({
            entityType: parent.providerEntityType,
          });
          if (!mapper) {
            throw new Error(
              `${logPrefix} — no mapper registered for parent entityType=${parent.providerEntityType}`,
            );
          }

          await mapper.map({
            externalObject: externalObject as unknown as Record<
              string,
              unknown
            >,
            tenantId: params.tenantId,
            connectionId: params.connectionId,
            tx,
          });
        });

        this.logger.log(
          `${logPrefix} — recovered parent=${tag} inline for child=${params.error.childEntityType}`,
        );
        outcome.attempted.push({
          providerEntityType: parent.providerEntityType,
          providerEntityId: parent.providerEntityId,
          ok: true,
        });
        outcome.recovered = true;
        // Only need one parent to resolve for the child to succeed (task
        // requires claim OR job per chk_task_parent). Stop after first win.
        return outcome;
      } catch (err) {
        const msg = (err as Error).message;
        this.logger.warn(
          `${logPrefix} — inline recovery failed for parent=${tag}: ${msg}`,
        );
        outcome.attempted.push({
          providerEntityType: parent.providerEntityType,
          providerEntityId: parent.providerEntityId,
          ok: false,
          reason: msg,
        });
      }
    }

    return outcome;
  }
}
