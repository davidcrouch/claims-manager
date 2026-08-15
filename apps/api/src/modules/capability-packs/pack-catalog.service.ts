import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { parse as parseYaml } from 'yaml';
import {
  packAgentSchema,
  packManifestSchema,
  packPromptSchema,
  packSkillSchema,
  type PackCatalogEntry,
  type PackManifest,
  type ResolvedPack,
} from './pack-manifest.types';

const LOG = 'PackCatalogService';

export function contentHash(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function defaultPacksRoot(): string {
  const fromEnv = process.env.PACKS_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  // Prefer apps/api/packs (cwd when running the API is usually apps/api)
  return path.resolve(process.cwd(), 'packs');
}

@Injectable()
export class PackCatalogService {
  private readonly logger = new Logger(LOG);

  getPacksRoot(): string {
    return defaultPacksRoot();
  }

  async listBuiltinCatalog(): Promise<PackCatalogEntry[]> {
    const root = this.getPacksRoot();
    let dirs: string[] = [];
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch (err) {
      this.logger.warn(
        `[${LOG}.listBuiltinCatalog] packs root missing or unreadable: ${root} — ${String(err)}`,
      );
      return [];
    }

    const out: PackCatalogEntry[] = [];
    for (const dir of dirs) {
      try {
        const resolved = await this.loadBuiltinPack(dir);
        out.push(this.toCatalogEntry(resolved));
      } catch (err) {
        this.logger.warn(
          `[${LOG}.listBuiltinCatalog] skip ${dir}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  async loadBuiltinPack(packId: string, version?: string): Promise<ResolvedPack> {
    const root = path.join(this.getPacksRoot(), packId);
    const manifestRaw = await fs.readFile(path.join(root, 'pack.yaml'), 'utf8');
    const manifest = packManifestSchema.parse(parseYaml(manifestRaw));
    if (manifest.id !== packId) {
      throw new Error(`Pack folder "${packId}" does not match manifest id "${manifest.id}"`);
    }
    if (version && manifest.version !== version) {
      throw new Error(
        `Requested version ${version} but builtin pack is ${manifest.version}`,
      );
    }
    return this.resolveFromFiles(root, manifest, 'builtin');
  }

  /**
   * Bundle shape:
   * { manifest: PackManifest, files: Record<relativePath, string> }
   */
  loadBundleJson(bundle: unknown, uploadId?: string): ResolvedPack {
    if (!bundle || typeof bundle !== 'object') {
      throw new Error('Invalid pack bundle');
    }
    const obj = bundle as { manifest?: unknown; files?: Record<string, string> };
    const manifest = packManifestSchema.parse(obj.manifest);
    const files = obj.files ?? {};
    return this.resolveFromMap(manifest, files, 'upload', uploadId);
  }

  private async resolveFromFiles(
    root: string,
    manifest: PackManifest,
    source: 'builtin' | 'upload',
  ): Promise<ResolvedPack> {
    const read = async (rel: string) =>
      fs.readFile(path.join(root, rel), 'utf8');

    const agents = [];
    for (const ref of manifest.agents) {
      const raw = await read(ref.file);
      agents.push({
        key: ref.file,
        hash: contentHash(raw),
        data: packAgentSchema.parse(parseYaml(raw)),
        raw,
      });
    }

    const skills = [];
    for (const ref of manifest.skills) {
      const raw = await read(ref.file);
      skills.push({
        key: ref.file,
        hash: contentHash(raw),
        data: packSkillSchema.parse(parseYaml(raw)),
        raw,
      });
    }

    const prompts = [];
    for (const ref of manifest.prompts) {
      const raw = await read(ref.file);
      prompts.push({
        key: ref.file,
        hash: contentHash(raw),
        data: packPromptSchema.parse(parseYaml(raw)),
        raw,
      });
    }

    return { source, rootDir: root, manifest, agents, skills, prompts };
  }

  private resolveFromMap(
    manifest: PackManifest,
    files: Record<string, string>,
    source: 'builtin' | 'upload',
    uploadId?: string,
  ): ResolvedPack {
    const get = (rel: string) => {
      const raw = files[rel] ?? files[rel.replace(/^\.\//, '')];
      if (raw == null) throw new Error(`Pack file missing in bundle: ${rel}`);
      return raw;
    };

    const agents = manifest.agents.map((ref) => {
      const raw = get(ref.file);
      return {
        key: ref.file,
        hash: contentHash(raw),
        data: packAgentSchema.parse(parseYaml(raw)),
        raw,
      };
    });
    const skills = manifest.skills.map((ref) => {
      const raw = get(ref.file);
      return {
        key: ref.file,
        hash: contentHash(raw),
        data: packSkillSchema.parse(parseYaml(raw)),
        raw,
      };
    });
    const prompts = manifest.prompts.map((ref) => {
      const raw = get(ref.file);
      return {
        key: ref.file,
        hash: contentHash(raw),
        data: packPromptSchema.parse(parseYaml(raw)),
        raw,
      };
    });

    return { source, uploadId, manifest, agents, skills, prompts };
  }

  toCatalogEntry(pack: ResolvedPack): PackCatalogEntry {
    return {
      packId: pack.manifest.id,
      version: pack.manifest.version,
      name: pack.manifest.name,
      description: pack.manifest.description ?? '',
      source: pack.source,
      uploadId: pack.uploadId,
      integrationRefs: pack.manifest.integrationRefs,
      agentCount: pack.agents.length,
      skillCount: pack.skills.length,
      promptCount: pack.prompts.length,
      installed: null,
    };
  }
}
