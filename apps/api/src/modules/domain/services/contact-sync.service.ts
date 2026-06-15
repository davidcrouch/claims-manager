import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import type { RawContact } from '../transformers/transformer.interface';
import { ContactsRepository, type ContactInsert } from '../../../database/repositories';
import { ClaimContactsRepository, type ClaimContactInsert } from '../../../database/repositories';
import { LookupResolutionService } from './lookup-resolution.service';
import { JobContactsRepository, type JobContactInsert } from '../../../database/repositories/job-contacts.repository';
import { nameFromLookup } from '../transformers/transform-utils';

type EntityJoinRepo = {
  upsert(params: { data: Record<string, unknown>; tx?: DrizzleDbOrTx }): Promise<unknown>;
};

@Injectable()
export class ContactSyncService implements OnModuleInit {
  private readonly logger = new Logger('ContactSyncService');
  private joinRepos: Record<string, EntityJoinRepo> = {};

  constructor(
    private readonly contactsRepo: ContactsRepository,
    private readonly lookupResolution: LookupResolutionService,
    @Optional() private readonly claimContactsRepo?: ClaimContactsRepository,
    @Optional() private readonly jobContactsRepo?: JobContactsRepository,
  ) {}

  onModuleInit(): void {
    if (this.claimContactsRepo) this.joinRepos['claim'] = this.claimContactsRepo;
    if (this.jobContactsRepo) this.joinRepos['job'] = this.jobContactsRepo;
    this.logger.log(
      `ContactSyncService.onModuleInit — join repos: ${Object.keys(this.joinRepos).join(', ') || '(none)'}`,
    );
  }

  registerJoinRepo(entityType: string, repo: EntityJoinRepo): void {
    this.joinRepos[entityType] = repo;
  }

  async syncForEntity(params: {
    entityType: string;
    entityId: string;
    tenantId: string;
    contacts: RawContact[];
    strategy: 'additive' | 'replace';
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    const joinRepo = this.joinRepos[params.entityType];
    if (!joinRepo) {
      this.logger.warn(
        `ContactSyncService.syncForEntity — no join repo registered for entityType=${params.entityType}`,
      );
      return;
    }

    let sortIndex = 0;
    for (const raw of params.contacts) {
      if (!raw.externalReference) continue;

      // Resolve contact type lookup
      let typeLookupId: string | undefined;
      if (raw.typeField) {
        const resolved = await this.lookupResolution.resolveField({
          tenantId: params.tenantId,
          domain: raw.typeDomain ?? 'contact_type',
          field: raw.typeField,
          tx: params.tx,
        });
        typeLookupId = resolved ?? undefined;
      }

      // Resolve preferred contact method lookup
      let preferredMethodLookupId: string | undefined;
      if (raw.preferredMethodField) {
        const resolved = await this.lookupResolution.resolveField({
          tenantId: params.tenantId,
          domain: raw.preferredMethodDomain ?? 'contact_method',
          field: raw.preferredMethodField,
          tx: params.tx,
        });
        preferredMethodLookupId = resolved ?? undefined;
      }

      // Upsert contact row
      const contact = await this.contactsRepo.upsertByExternalReference({
        data: {
          tenantId: params.tenantId,
          externalReference: raw.externalReference,
          firstName: raw.firstName,
          lastName: raw.lastName,
          email: raw.email,
          mobilePhone: raw.mobilePhone,
          homePhone: raw.homePhone,
          workPhone: raw.workPhone,
          notes: raw.notes,
          typeLookupId,
          preferredContactMethodLookupId: preferredMethodLookupId,
          contactPayload: raw.sourcePayload,
        },
        tx: params.tx,
      });

      // Build join table data
      const entityIdField = `${params.entityType}Id`;
      await joinRepo.upsert({
        data: {
          tenantId: params.tenantId,
          [entityIdField]: params.entityId,
          contactId: contact.id,
          sortIndex,
          sourcePayload: {
            typeName: nameFromLookup(raw.typeField),
            preferredMethodName: nameFromLookup(raw.preferredMethodField),
            raw: raw.sourcePayload,
          },
        },
        tx: params.tx,
      });

      sortIndex += 1;
    }
  }
}
