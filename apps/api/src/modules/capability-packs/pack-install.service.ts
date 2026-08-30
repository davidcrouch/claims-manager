import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import {
  capabilityPackArtefact,
  capabilityPackInstall,
  capabilityPackUpload,
  promptTemplate,
} from '../../database/schema';
import { AgentRepository } from '../../database/repositories/agent.repository';
import { SkillRepository } from '../../database/repositories/skill.repository';
import { TenantContext } from '../../tenant/tenant-context';
import { PackCatalogService, contentHash } from './pack-catalog.service';
import { PackResolverService } from './pack-resolver.service';
import type {
  InstallPackDto,
  PackCatalogEntry,
  PackDriftItem,
  PackPreview,
  ResolvedPack,
} from './pack-manifest.types';
import type { PackAgent, PackPrompt, PackSkill } from './pack-manifest.types';

const LOG = 'PackInstallService';

@Injectable()
export class PackInstallService {
  private readonly logger = new Logger(LOG);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly tenantContext: TenantContext,
    private readonly catalog: PackCatalogService,
    private readonly resolver: PackResolverService,
    private readonly agentRepo: AgentRepository,
    private readonly skillRepo: SkillRepository,
  ) {}

  private tenantId(): string {
    return this.tenantContext.getTenantId();
  }

  async listCatalog(): Promise<PackCatalogEntry[]> {
    const tenantId = this.tenantId();
    const builtin = await this.catalog.listBuiltinCatalog();
    const uploads = await this.listUploadCatalogEntries(tenantId);
    const installed = await this.db
      .select()
      .from(capabilityPackInstall)
      .where(
        and(
          eq(capabilityPackInstall.tenantId, tenantId),
          inArray(capabilityPackInstall.status, ['active', 'upgrading', 'error']),
        ),
      );

    const byPack = new Map(installed.map((row) => [row.packId, row]));
    return [...builtin, ...uploads].map((entry) => {
      const row = byPack.get(entry.packId);
      return {
        ...entry,
        installed: row
          ? { installId: row.id, version: row.packVersion, status: row.status }
          : null,
      };
    });
  }

  async listInstalled() {
    const tenantId = this.tenantId();
    return this.db
      .select()
      .from(capabilityPackInstall)
      .where(eq(capabilityPackInstall.tenantId, tenantId));
  }

  async listUploads() {
    const tenantId = this.tenantId();
    return this.db
      .select({
        id: capabilityPackUpload.id,
        packId: capabilityPackUpload.packId,
        packVersion: capabilityPackUpload.packVersion,
        displayName: capabilityPackUpload.displayName,
        description: capabilityPackUpload.description,
        createdAt: capabilityPackUpload.createdAt,
      })
      .from(capabilityPackUpload)
      .where(eq(capabilityPackUpload.tenantId, tenantId));
  }

  async preview(dto: InstallPackDto): Promise<PackPreview> {
    const pack = await this.resolvePackForInstall(dto);
    return {
      packId: pack.manifest.id,
      version: pack.manifest.version,
      name: pack.manifest.name,
      description: pack.manifest.description ?? '',
      source: pack.source,
      uploadId: pack.uploadId,
      integrationRefs: pack.manifest.integrationRefs,
      agents: pack.agents.map(({ data }) => ({
        slug: data.slug,
        name: data.name,
        description: data.description,
        enabledTools: data.enabledTools,
        pinnedSkillSlugs: data.pinnedSkillSlugs,
        integrationRefs: data.integrationRefs,
      })),
      skills: pack.skills.map(({ data }) => ({
        slug: data.slug,
        name: data.name,
        description: data.description,
        category: data.category,
        triggerHints: data.triggerHints,
        requiredTools: data.requiredToolRefs.map(
          (ref) => `${ref.integration}/${ref.tool}`,
        ),
      })),
      prompts: pack.prompts.map(({ data }) => ({
        slug: data.slug,
        name: data.name,
        description: data.description,
        category: data.category,
      })),
    };
  }

  private async listUploadCatalogEntries(tenantId: string): Promise<PackCatalogEntry[]> {
    const rows = await this.db
      .select()
      .from(capabilityPackUpload)
      .where(eq(capabilityPackUpload.tenantId, tenantId));

    return rows.map((row) => {
      const pack = this.catalog.loadBundleJson(row.bundleJson, row.id);
      const entry = this.catalog.toCatalogEntry(pack);
      entry.uploadId = row.id;
      entry.source = 'upload';
      return entry;
    });
  }

  async uploadBundle(params: {
    bundle: unknown;
    userId?: string;
  }): Promise<{ uploadId: string; packId: string; version: string }> {
    const tenantId = this.tenantId();
    const pack = this.catalog.loadBundleJson(params.bundle);
    const [row] = await this.db
      .insert(capabilityPackUpload)
      .values({
        tenantId,
        packId: pack.manifest.id,
        packVersion: pack.manifest.version,
        displayName: pack.manifest.name,
        description: pack.manifest.description ?? null,
        bundleJson: params.bundle as Record<string, unknown>,
        manifestJson: pack.manifest,
        createdBy: params.userId ?? null,
      })
      .returning();

    this.logger.log(
      `[${LOG}.uploadBundle] uploaded ${pack.manifest.id}@${pack.manifest.version} id=${row!.id}`,
    );
    return {
      uploadId: row!.id,
      packId: pack.manifest.id,
      version: pack.manifest.version,
    };
  }

  async install(dto: InstallPackDto): Promise<{ installId: string }> {
    const tenantId = this.tenantId();
    const pack = await this.resolvePackForInstall(dto);

    const [existing] = await this.db
      .select()
      .from(capabilityPackInstall)
      .where(
        and(
          eq(capabilityPackInstall.tenantId, tenantId),
          eq(capabilityPackInstall.packId, pack.manifest.id),
          inArray(capabilityPackInstall.status, ['active', 'upgrading']),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(
        `Pack "${pack.manifest.id}" already installed (installId=${existing.id}). Use upgrade instead.`,
      );
    }

    const [installRow] = await this.db
      .insert(capabilityPackInstall)
      .values({
        tenantId,
        packId: pack.manifest.id,
        packVersion: pack.manifest.version,
        status: 'active',
        source: pack.source,
        displayName: pack.manifest.name,
        uploadId: pack.uploadId ?? null,
      })
      .returning();

    try {
      await this.materializePack(installRow!.id, pack);
    } catch (err) {
      await this.db
        .update(capabilityPackInstall)
        .set({
          status: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
          updatedAt: new Date(),
        })
        .where(eq(capabilityPackInstall.id, installRow!.id));
      throw err;
    }

    return { installId: installRow!.id };
  }

  async upgrade(installId: string): Promise<{ installId: string }> {
    const tenantId = this.tenantId();
    const [install] = await this.db
      .select()
      .from(capabilityPackInstall)
      .where(
        and(
          eq(capabilityPackInstall.id, installId),
          eq(capabilityPackInstall.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!install) throw new NotFoundException('Install not found');

    const pack =
      install.source === 'upload' && install.uploadId
        ? await this.loadUploadPack(install.uploadId)
        : await this.catalog.loadBuiltinPack(install.packId);

    await this.db
      .update(capabilityPackInstall)
      .set({ status: 'upgrading', updatedAt: new Date(), errorMessage: null })
      .where(eq(capabilityPackInstall.id, installId));

    try {
      await this.materializePack(installId, pack, { upgrade: true });
      await this.db
        .update(capabilityPackInstall)
        .set({
          status: 'active',
          packVersion: pack.manifest.version,
          displayName: pack.manifest.name,
          updatedAt: new Date(),
        })
        .where(eq(capabilityPackInstall.id, installId));
    } catch (err) {
      await this.db
        .update(capabilityPackInstall)
        .set({
          status: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
          updatedAt: new Date(),
        })
        .where(eq(capabilityPackInstall.id, installId));
      throw err;
    }

    return { installId };
  }

  async uninstall(installId: string, force = false): Promise<{ ok: boolean }> {
    const tenantId = this.tenantId();
    const [install] = await this.db
      .select()
      .from(capabilityPackInstall)
      .where(
        and(
          eq(capabilityPackInstall.id, installId),
          eq(capabilityPackInstall.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!install) throw new NotFoundException('Install not found');

    const drift = await this.getDrift(installId);
    const blocked = drift.filter((d) => d.status === 'modified');
    if (blocked.length && !force) {
      throw new ConflictException(
        `Pack has ${blocked.length} modified artefact(s). Pass force=true to uninstall anyway.`,
      );
    }

    const artefacts = await this.db
      .select()
      .from(capabilityPackArtefact)
      .where(eq(capabilityPackArtefact.installId, installId));

    for (const art of artefacts) {
      if (art.artefactType === 'agent') {
        await this.agentRepo.delete(art.artefactId, tenantId);
      } else if (art.artefactType === 'skill') {
        await this.skillRepo.delete(art.artefactId, tenantId);
      } else if (art.artefactType === 'prompt_template') {
        await this.db
          .delete(promptTemplate)
          .where(
            and(eq(promptTemplate.id, art.artefactId), eq(promptTemplate.tenantId, tenantId)),
          );
      }
    }

    await this.db
      .delete(capabilityPackArtefact)
      .where(eq(capabilityPackArtefact.installId, installId));

    await this.db
      .update(capabilityPackInstall)
      .set({ status: 'disabled', updatedAt: new Date() })
      .where(eq(capabilityPackInstall.id, installId));

    return { ok: true };
  }

  async getDrift(installId: string): Promise<PackDriftItem[]> {
    const tenantId = this.tenantId();
    const [install] = await this.db
      .select()
      .from(capabilityPackInstall)
      .where(
        and(
          eq(capabilityPackInstall.id, installId),
          eq(capabilityPackInstall.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!install) throw new NotFoundException('Install not found');

    const pack =
      install.source === 'upload' && install.uploadId
        ? await this.loadUploadPack(install.uploadId)
        : await this.catalog.loadBuiltinPack(install.packId);

    const artefacts = await this.db
      .select()
      .from(capabilityPackArtefact)
      .where(eq(capabilityPackArtefact.installId, installId));

    const expectedKeys = new Map<string, { yamlHash: string; projectionHash: string }>();
    for (const a of pack.agents) {
      expectedKeys.set(`agent:${a.data.slug}`, {
        yamlHash: a.hash,
        projectionHash: this.hashAgentProjection(a.data),
      });
    }
    for (const s of pack.skills) {
      expectedKeys.set(`skill:${s.data.slug}`, {
        yamlHash: s.hash,
        projectionHash: this.hashSkillProjection(s.data),
      });
    }
    for (const p of pack.prompts) {
      expectedKeys.set(`prompt_template:${p.data.slug}`, {
        yamlHash: p.hash,
        projectionHash: this.hashPromptProjection(p.data),
      });
    }

    const items: PackDriftItem[] = [];
    const seen = new Set<string>();

    for (const art of artefacts) {
      const key = art.sourceKey ?? `${art.artefactType}:${art.artefactId}`;
      seen.add(key);
      const expected = expectedKeys.get(key);
      const actualHash = await this.hashArtefactRow(art.artefactType, art.artefactId, tenantId);
      let status: PackDriftItem['status'] = 'match';
      if (!actualHash) status = 'missing';
      else if (expected && actualHash !== expected.projectionHash) status = 'modified';
      items.push({
        artefactType: art.artefactType as PackDriftItem['artefactType'],
        artefactId: art.artefactId,
        sourceKey: art.sourceKey,
        status,
        expectedHash: expected?.projectionHash ?? art.sourceHash ?? null,
        actualHash,
      });
    }

    for (const [key, hashes] of expectedKeys) {
      if (seen.has(key)) continue;
      items.push({
        artefactType: key.split(':')[0] as PackDriftItem['artefactType'],
        artefactId: '',
        sourceKey: key,
        status: 'orphan',
        expectedHash: hashes.projectionHash,
        actualHash: null,
      });
    }

    return items;
  }

  private hashAgentProjection(data: PackAgent): string {
    return contentHash(
      JSON.stringify({
        slug: data.slug,
        name: data.name,
        systemPrompt: data.systemPrompt,
      }),
    );
  }

  private hashSkillProjection(data: PackSkill): string {
    return contentHash(
      JSON.stringify({
        name: data.name,
        instructionPrompt: data.instructionPrompt,
        triggerHints: data.triggerHints,
        requiredToolRefs: data.requiredToolRefs,
      }),
    );
  }

  private hashPromptProjection(data: PackPrompt): string {
    return contentHash(JSON.stringify({ name: data.name, templateText: data.templateText }));
  }

  private async resolvePackForInstall(dto: InstallPackDto): Promise<ResolvedPack> {
    if (dto.uploadId) {
      return this.loadUploadPack(dto.uploadId);
    }
    if (!dto.packId) {
      throw new BadRequestException('packId or uploadId is required');
    }
    return this.catalog.loadBuiltinPack(dto.packId, dto.version);
  }

  private async loadUploadPack(uploadId: string): Promise<ResolvedPack> {
    const tenantId = this.tenantId();
    const [row] = await this.db
      .select()
      .from(capabilityPackUpload)
      .where(
        and(
          eq(capabilityPackUpload.id, uploadId),
          eq(capabilityPackUpload.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException('Upload not found');
    return this.catalog.loadBundleJson(row.bundleJson, row.id);
  }

  private async materializePack(
    installId: string,
    pack: ResolvedPack,
    opts?: { upgrade?: boolean },
  ): Promise<void> {
    const tenantId = this.tenantId();
    const integrationNames = [
      ...new Set([
        ...pack.manifest.integrationRefs,
        ...pack.agents.flatMap((a) => a.data.integrationRefs),
      ]),
    ];

    const connMap = await this.resolver.resolveIntegrationConnections({
      tenantId,
      integrationNames,
    });
    const allConnIds = [...new Set([...connMap.values()].map((v) => v.connectionId))];
    await this.resolver.ensureManifests(allConnIds);

    const skillIdBySlug = new Map<string, string>();

    for (const entry of pack.skills) {
      const sourceKey = `skill:${entry.data.slug}`;
      const existingArt = opts?.upgrade
        ? await this.findArtefactBySourceKey(installId, sourceKey)
        : null;

      if (existingArt) {
        await this.skillRepo.update(existingArt.artefactId, tenantId, {
          name: entry.data.name,
          description: entry.data.description ?? null,
          triggerHints: entry.data.triggerHints,
          instructionPrompt: entry.data.instructionPrompt,
          requiredToolRefs: entry.data.requiredToolRefs,
          invocationMode: entry.data.invocationMode,
          includeHistory: entry.data.includeHistory,
          historyMessageCount: entry.data.historyMessageCount ?? 5,
          category: entry.data.category,
          visibility: entry.data.visibility,
          packInstallId: installId,
          inputSchema: entry.data.inputSchema ?? null,
          outputSchema: entry.data.outputSchema ?? null,
        });
        await this.db
          .update(capabilityPackArtefact)
          .set({ sourceHash: entry.hash })
          .where(eq(capabilityPackArtefact.id, existingArt.id));
        skillIdBySlug.set(entry.data.slug, existingArt.artefactId);
      } else {
        const created = await this.skillRepo.insert({
          tenantId,
          name: entry.data.name,
          description: entry.data.description ?? null,
          triggerHints: entry.data.triggerHints,
          instructionPrompt: entry.data.instructionPrompt,
          requiredToolRefs: entry.data.requiredToolRefs,
          invocationMode: entry.data.invocationMode,
          includeHistory: entry.data.includeHistory,
          historyMessageCount: entry.data.historyMessageCount ?? 5,
          category: entry.data.category,
          visibility: entry.data.visibility,
          packInstallId: installId,
          inputSchema: entry.data.inputSchema ?? null,
          outputSchema: entry.data.outputSchema ?? null,
          embedding: null,
        });
        await this.db.insert(capabilityPackArtefact).values({
          installId,
          artefactType: 'skill',
          artefactId: created.id,
          sourceHash: entry.hash,
          sourceKey,
        });
        skillIdBySlug.set(entry.data.slug, created.id);
      }
    }

    for (const entry of pack.prompts) {
      const sourceKey = `prompt_template:${entry.data.slug}`;
      const existingArt = opts?.upgrade
        ? await this.findArtefactBySourceKey(installId, sourceKey)
        : null;
      if (existingArt) {
        await this.db
          .update(promptTemplate)
          .set({
            name: entry.data.name,
            description: entry.data.description ?? null,
            templateText: entry.data.templateText,
            variables: entry.data.variables,
            category: entry.data.category,
            updatedAt: new Date(),
          })
          .where(eq(promptTemplate.id, existingArt.artefactId));
        await this.db
          .update(capabilityPackArtefact)
          .set({ sourceHash: entry.hash })
          .where(eq(capabilityPackArtefact.id, existingArt.id));
      } else {
        const [created] = await this.db
          .insert(promptTemplate)
          .values({
            tenantId,
            name: entry.data.name,
            description: entry.data.description ?? null,
            templateText: entry.data.templateText,
            variables: entry.data.variables,
            category: entry.data.category,
          })
          .returning();
        await this.db.insert(capabilityPackArtefact).values({
          installId,
          artefactType: 'prompt_template',
          artefactId: created!.id,
          sourceHash: entry.hash,
          sourceKey,
        });
      }
    }

    for (const entry of pack.agents) {
      const refs = entry.data.integrationRefs.length
        ? entry.data.integrationRefs
        : pack.manifest.integrationRefs;
      const connectionIds = refs
        .map((name) => connMap.get(name)?.connectionId)
        .filter((id): id is string => !!id);

      const enabledTools = await this.resolver.resolveEnabledToolRefs({
        connectionIds,
        toolPatterns: entry.data.enabledTools,
      });

      const pinnedSkills = entry.data.pinnedSkillSlugs
        .map((slug) => skillIdBySlug.get(slug))
        .filter((id): id is string => !!id);

      const sourceKey = `agent:${entry.data.slug}`;
      const existingArt = opts?.upgrade
        ? await this.findArtefactBySourceKey(installId, sourceKey)
        : null;

      if (existingArt) {
        await this.agentRepo.update(existingArt.artefactId, tenantId, {
          name: entry.data.name,
          description: entry.data.description ?? null,
          type: entry.data.type,
          chatEnabled: entry.data.chatEnabled,
          provider: entry.data.provider,
          model: entry.data.model,
          temperature: String(entry.data.temperature),
          maxTokens: entry.data.maxTokens,
          systemPrompt: entry.data.systemPrompt,
          visibility: entry.data.visibility,
          connectionIds,
          enabledToolRefs: enabledTools,
          pinnedSkills,
          semanticSkills: entry.data.semanticSkills,
          supportsVision: entry.data.supportsVision,
          maxSteps: entry.data.maxSteps,
          autonomousMode: entry.data.autonomousMode,
          pauseAfterToolSteps: entry.data.pauseAfterToolSteps,
          maxDurationSeconds: entry.data.maxDurationSeconds,
          packInstallId: installId,
        });
        await this.db
          .update(capabilityPackArtefact)
          .set({ sourceHash: entry.hash })
          .where(eq(capabilityPackArtefact.id, existingArt.id));
      } else {
        const existingSlug = await this.agentRepo.findBySlug(tenantId, entry.data.slug);
        if (existingSlug) {
          throw new ConflictException(
            `Agent slug "${entry.data.slug}" already exists outside this pack`,
          );
        }
        const created = await this.agentRepo.create({
          tenantId,
          slug: entry.data.slug,
          name: entry.data.name,
          description: entry.data.description ?? null,
          type: entry.data.type,
          chatEnabled: entry.data.chatEnabled,
          provider: entry.data.provider,
          model: entry.data.model,
          temperature: String(entry.data.temperature),
          maxTokens: entry.data.maxTokens,
          systemPrompt: entry.data.systemPrompt,
          visibility: entry.data.visibility,
          connectionIds,
          enabledToolRefs: enabledTools,
          pinnedSkills,
          semanticSkills: entry.data.semanticSkills,
          supportsVision: entry.data.supportsVision,
          maxSteps: entry.data.maxSteps,
          autonomousMode: entry.data.autonomousMode,
          pauseAfterToolSteps: entry.data.pauseAfterToolSteps,
          maxDurationSeconds: entry.data.maxDurationSeconds,
          isDefault: entry.data.isDefault,
          packInstallId: installId,
        });
        await this.db.insert(capabilityPackArtefact).values({
          installId,
          artefactType: 'agent',
          artefactId: created.id,
          sourceHash: entry.hash,
          sourceKey,
        });
      }
    }

    this.logger.log(
      `[${LOG}.materializePack] install=${installId} agents=${pack.agents.length} skills=${pack.skills.length}`,
    );
  }

  private async findArtefactBySourceKey(installId: string, sourceKey: string) {
    const [row] = await this.db
      .select()
      .from(capabilityPackArtefact)
      .where(
        and(
          eq(capabilityPackArtefact.installId, installId),
          eq(capabilityPackArtefact.sourceKey, sourceKey),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async hashArtefactRow(
    type: string,
    id: string,
    tenantId: string,
  ): Promise<string | null> {
    if (type === 'agent') {
      const row = await this.agentRepo.findById(id, tenantId);
      if (!row) return null;
      return contentHash(
        JSON.stringify({
          slug: row.slug,
          name: row.name,
          systemPrompt: row.systemPrompt,
        }),
      );
    }
    if (type === 'skill') {
      const row = await this.skillRepo.findById(id, tenantId);
      if (!row) return null;
      return contentHash(
        JSON.stringify({
          name: row.name,
          instructionPrompt: row.instructionPrompt,
          triggerHints: row.triggerHints,
          requiredToolRefs: row.requiredToolRefs,
        }),
      );
    }
    if (type === 'prompt_template') {
      const [row] = await this.db
        .select()
        .from(promptTemplate)
        .where(and(eq(promptTemplate.id, id), eq(promptTemplate.tenantId, tenantId)))
        .limit(1);
      if (!row) return null;
      return contentHash(JSON.stringify({ name: row.name, templateText: row.templateText }));
    }
    return null;
  }
}
