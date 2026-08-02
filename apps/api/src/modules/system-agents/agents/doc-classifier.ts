import { and, eq, isNull } from 'drizzle-orm';
import { Storage } from '@google-cloud/storage';
import {
  documents,
  filesystems,
  filesystemCategories,
} from '../../../database/schema';
import { registerSystemAgentTools } from '../system-agent-runner';
import { AgentRole } from '../agent-roles';
import type { ProviderToolDefinition } from '../providers/types';
import type { DrizzleDB } from '../../../database/drizzle.module';

const LOG = '[docClassifier]';
const CONTENT_PREVIEW_LINES = 100;
const CONFIDENCE_THRESHOLD = 0.6;

registerSystemAgentTools(AgentRole.DOCUMENT_CLASSIFIER, (db, context) => {
  const tenantId = context.tenantId;
  const documentId = context.documentId;

  const getDocumentInfo: ProviderToolDefinition = {
    name: 'get_document_info',
    description:
      'Get metadata and a content preview for the document being classified. ' +
      'Returns filename, MIME type, and the first ~100 lines of text content if available.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)))
        .limit(1);

      if (!doc) return { error: 'Document not found' };

      const info: Record<string, unknown> = {
        id: doc.id,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        fileSizeBytes: doc.fileSizeBytes,
      };

      if (doc.gcsBucket && doc.gcsObjectPath) {
        try {
          const content = await readContentPreview(
            doc.gcsBucket,
            doc.gcsObjectPath,
            doc.mimeType,
          );
          if (content) info.contentPreview = content;
        } catch {
          // preview is best-effort
        }
      }

      return info;
    },
  };

  const listFilesystemCategories: ProviderToolDefinition = {
    name: 'list_filesystem_categories',
    description:
      'List all filesystem categories including slugs, display names, descriptions, and folder paths.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const [fs] = await db
        .select()
        .from(filesystems)
        .where(and(eq(filesystems.tenantId, tenantId), isNull(filesystems.archivedAt)))
        .limit(1);

      if (!fs) return { error: 'No filesystem configured for this organisation' };

      const cats = await db
        .select()
        .from(filesystemCategories)
        .where(
          and(
            eq(filesystemCategories.filesystemId, fs.id),
            isNull(filesystemCategories.archivedAt),
          ),
        );

      const byId = new Map(cats.map((c) => [c.id, c]));
      const getPath = (catId: string): string => {
        const parts: string[] = [];
        let current = byId.get(catId);
        while (current) {
          parts.unshift(current.displayName);
          current = current.parentCategoryId
            ? byId.get(current.parentCategoryId)
            : undefined;
        }
        return parts.join(' / ');
      };

      return {
        categories: cats.map((c) => ({
          slug: c.slug,
          displayName: c.displayName,
          description: c.description,
          path: getPath(c.id),
        })),
      };
    },
  };

  const assignDocumentCategory: ProviderToolDefinition = {
    name: 'assign_document_category',
    description:
      'Assign the document to a filesystem category by slug with a confidence score (0-1). ' +
      'Only applied when confidence is above the threshold.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        confidence: { type: 'number' },
        reasoning: { type: 'string' },
      },
      required: ['slug', 'confidence', 'reasoning'],
    },
    execute: async (input) => {
      const slug = String(input.slug ?? '');
      const confidence = Number(input.confidence ?? 0);
      const reasoning = String(input.reasoning ?? '');

      const [fs] = await db
        .select()
        .from(filesystems)
        .where(and(eq(filesystems.tenantId, tenantId), isNull(filesystems.archivedAt)))
        .limit(1);
      if (!fs) return { error: 'No filesystem', assigned: false };

      const [cat] = await db
        .select()
        .from(filesystemCategories)
        .where(
          and(
            eq(filesystemCategories.filesystemId, fs.id),
            eq(filesystemCategories.slug, slug),
            isNull(filesystemCategories.archivedAt),
          ),
        )
        .limit(1);

      if (!cat) {
        return { error: `Category slug not found: ${slug}`, assigned: false, confidence, reasoning };
      }

      if (confidence < CONFIDENCE_THRESHOLD) {
        return {
          assigned: false,
          confidence,
          reasoning,
          message: `${LOG}: confidence below ${CONFIDENCE_THRESHOLD}`,
          suggestedSlug: slug,
        };
      }

      await db
        .update(documents)
        .set({ filesystemCategoryId: cat.id, updatedAt: new Date() })
        .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)));

      return {
        assigned: true,
        categoryId: cat.id,
        slug: cat.slug,
        displayName: cat.displayName,
        confidence,
        reasoning,
      };
    },
  };

  return {
    get_document_info: getDocumentInfo,
    list_filesystem_categories: listFilesystemCategories,
    assign_document_category: assignDocumentCategory,
  };
});

async function readContentPreview(
  bucket: string,
  objectPath: string,
  mimeType: string | null,
): Promise<string | null> {
  const textLike =
    !mimeType ||
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/pdf';

  if (!textLike && !mimeType?.includes('word')) return null;

  const storage = new Storage();
  const [buf] = await storage.bucket(bucket).file(objectPath).download({ start: 0, end: 64_000 });
  const text = buf.toString('utf8').replace(/\0/g, '');
  return text.split('\n').slice(0, CONTENT_PREVIEW_LINES).join('\n');
}

/** Side-effect import to register tools. */
export function ensureDocClassifierRegistered(_db?: DrizzleDB): void {
  // registration happens at module load via registerSystemAgentTools above
}
