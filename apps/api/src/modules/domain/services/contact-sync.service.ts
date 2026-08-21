import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import type { RawContact } from '../transformers/transformer.interface';
import { ContactsRepository, type ContactInsert } from '../../../database/repositories';
import { ClaimContactsRepository } from '../../../database/repositories';
import { LookupResolutionService } from './lookup-resolution.service';
import { JobContactsRepository } from '../../../database/repositories/job-contacts.repository';
import { nameFromLookup } from '../transformers/transform-utils';
import { hasContactIdentity, isBlankContactValue } from '../../../common/contact-identity';

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
    private readonly claimContactsRepo: ClaimContactsRepository,
    private readonly jobContactsRepo: JobContactsRepository,
  ) {}

  onModuleInit(): void {
    this.joinRepos['claim'] = this.claimContactsRepo;
    this.joinRepos['job'] = this.jobContactsRepo;
    this.logger.log(
      `ContactSyncService.onModuleInit — join repos: ${Object.keys(this.joinRepos).join(', ')}`,
    );
  }

  registerJoinRepo(entityType: string, repo: EntityJoinRepo): void {
    this.joinRepos[entityType] = repo;
  }

  private resolveJoinRepo(entityType: string): EntityJoinRepo | undefined {
    if (entityType === 'claim') return this.claimContactsRepo;
    if (entityType === 'job') return this.jobContactsRepo;
    return this.joinRepos[entityType];
  }

  async syncForEntity(params: {
    entityType: string;
    entityId: string;
    tenantId: string;
    contacts: RawContact[];
    strategy: 'additive' | 'replace';
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    const joinRepo = this.resolveJoinRepo(params.entityType);
    if (!joinRepo) {
      this.logger.error(
        `ContactSyncService.syncForEntity — no join repo for entityType=${params.entityType}; refusing to drop contacts`,
      );
      throw new Error(
        `ContactSyncService.syncForEntity — no join repo registered for entityType=${params.entityType}`,
      );
    }

    this.logger.log(
      `ContactSyncService.syncForEntity — ${params.entityType}=${params.entityId} contacts=${params.contacts.length} strategy=${params.strategy}`,
    );

    let sortIndex = 0;
    let linked = 0;
    for (const raw of params.contacts) {
      if (
        !hasContactIdentity({
          externalReference: raw.externalReference,
          email: raw.email,
          mobilePhone: raw.mobilePhone,
          homePhone: raw.homePhone,
          workPhone: raw.workPhone,
          firstName: raw.firstName,
          lastName: raw.lastName,
        })
      ) {
        this.logger.debug(
          `ContactSyncService.syncForEntity — skipping contact with no identity signals for ${params.entityType}=${params.entityId}`,
        );
        continue;
      }

      // Resolve contact type lookup (ignore empty CW lookup stubs)
      let typeLookupId: string | undefined;
      if (this.hasResolvableLookup(raw.typeField)) {
        const resolved = await this.lookupResolution.resolveField({
          tenantId: params.tenantId,
          domain: raw.typeDomain ?? 'contact_type',
          field: raw.typeField,
          tx: params.tx,
        });
        typeLookupId = resolved ?? undefined;
      }

      let preferredMethodLookupId: string | undefined;
      if (this.hasResolvableLookup(raw.preferredMethodField)) {
        const resolved = await this.lookupResolution.resolveField({
          tenantId: params.tenantId,
          domain: raw.preferredMethodDomain ?? 'contact_method',
          field: raw.preferredMethodField,
          tx: params.tx,
        });
        preferredMethodLookupId = resolved ?? undefined;
      }

      const inbound: ContactInsert = {
        tenantId: params.tenantId,
        externalReference: raw.externalReference?.trim() || null,
        firstName: raw.firstName,
        lastName: raw.lastName,
        email: isBlankContactValue(raw.email) ? null : raw.email!.trim(),
        mobilePhone: raw.mobilePhone,
        homePhone: raw.homePhone,
        workPhone: raw.workPhone,
        notes: raw.notes,
        typeLookupId,
        preferredContactMethodLookupId: preferredMethodLookupId,
        contactPayload: raw.sourcePayload,
      };

      let contact = await this.contactsRepo.findMatchingContact({
        tenantId: params.tenantId,
        externalReference: inbound.externalReference,
        email: inbound.email,
        mobilePhone: inbound.mobilePhone,
        homePhone: inbound.homePhone,
        workPhone: inbound.workPhone,
        firstName: inbound.firstName,
        lastName: inbound.lastName,
        tx: params.tx,
      });

      if (contact) {
        contact = await this.contactsRepo.mergeFillBlanks({
          existing: contact,
          data: inbound,
          tx: params.tx,
        });
      } else {
        // Email unique: if create would collide, treat that row as the match
        if (inbound.email) {
          const byEmail = await this.contactsRepo.findByEmail({
            tenantId: params.tenantId,
            email: inbound.email,
            tx: params.tx,
          });
          if (byEmail) {
            contact = await this.contactsRepo.mergeFillBlanks({
              existing: byEmail,
              data: inbound,
              tx: params.tx,
            });
          }
        }

        if (!contact) {
          contact = await this.contactsRepo.create({
            data: inbound,
            tx: params.tx,
          });
        }
      }

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
      linked += 1;
    }

    this.logger.log(
      `ContactSyncService.syncForEntity — linked ${linked}/${params.contacts.length} contacts for ${params.entityType}=${params.entityId}`,
    );
  }

  /** True when CW sent a lookup object/string that can actually be resolved. */
  private hasResolvableLookup(field: unknown): boolean {
    if (field == null) return false;
    if (typeof field === 'string') return field.trim().length > 0;
    if (typeof field === 'object' && !Array.isArray(field)) {
      const obj = field as Record<string, unknown>;
      const ext =
        (typeof obj.externalReference === 'string' && obj.externalReference.trim()) ||
        (typeof obj.id === 'string' && obj.id.trim()) ||
        '';
      return ext.length > 0;
    }
    return false;
  }
}
