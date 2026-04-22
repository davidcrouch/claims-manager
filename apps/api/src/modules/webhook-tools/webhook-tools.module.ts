import { Module } from '@nestjs/common';
import { CrunchworkModule } from '../../crunchwork/crunchwork.module';
import { ExternalModule } from '../external/external.module';
import { ToolAuthGuard } from './tool-auth.guard';
import { WebhookEventReadController } from './controllers/webhook-event-read.controller';
import { CrunchworkFetchController } from './controllers/crunchwork-fetch.controller';
import { PayloadArchiveController } from './controllers/payload-archive.controller';
import { ExternalObjectUpsertController } from './controllers/external-object-upsert.controller';
import { EntityMapperController } from './controllers/entity-mapper.controller';
import { ProcessingLogUpdateController } from './controllers/processing-log-update.controller';

/**
 * Hosts the HTTP endpoints that back the `claims-manager-webhook` More0
 * app's inline-ts tool modules.
 *
 * Architectural note: the More0 app tree lives under `apps/api/more0/` and
 * ships as-is to the More0 platform, where each tool's `.ts` file runs in a
 * sandbox container. The sandbox can only import npm packages declared in
 * its `tool.json`; it cannot reach into this codebase. Each tool's sandbox
 * module therefore makes an outbound `fetch` to one of the endpoints
 * registered by this module, authenticating with `X-Tool-Secret`
 * (validated by {@link ToolAuthGuard}).
 *
 * Exposed HTTP routes (all under /api/v1/webhook-tools):
 *   - POST /events/read                     (webhook-event-read)
 *   - POST /crunchwork/fetch                (crunchwork-fetch)
 *   - POST /payloads/archive                (payload-archive)
 *   - POST /external-objects/upsert         (external-object-upsert)
 *   - POST /mappers/:entityType             (entity-mapper)
 *   - POST /processing-log/update           (processing-log-update)
 */
@Module({
  imports: [ExternalModule, CrunchworkModule],
  controllers: [
    WebhookEventReadController,
    CrunchworkFetchController,
    PayloadArchiveController,
    ExternalObjectUpsertController,
    EntityMapperController,
    ProcessingLogUpdateController,
  ],
  providers: [ToolAuthGuard],
})
export class WebhookToolsModule {}
