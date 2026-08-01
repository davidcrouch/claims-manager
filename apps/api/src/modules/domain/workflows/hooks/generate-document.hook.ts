import { Injectable, Logger } from '@nestjs/common';
import { DocumentGenerationService } from '../../../document-generation/document-generation.service';
import {
  ENTITY_TYPE_TO_DOCUMENT_TYPE,
  type DocumentType,
} from '../../../document-generation/types/document-types';
import type { OnEnterHook, WorkflowContext } from '../workflow.interface';

@Injectable()
export class GenerateDocumentHook implements OnEnterHook {
  name = 'generateDocument';
  private readonly logger = new Logger('GenerateDocumentHook');

  constructor(private readonly docGenService: DocumentGenerationService) {}

  async execute(context: WorkflowContext): Promise<void> {
    const logPrefix = 'GenerateDocumentHook.execute';
    const docType = ENTITY_TYPE_TO_DOCUMENT_TYPE[context.entityType] as DocumentType | undefined;
    if (!docType) {
      this.logger.warn(
        `${logPrefix} — no document type mapping for entityType="${context.entityType}", skipping`,
      );
      return;
    }

    this.logger.log(
      `${logPrefix} — generating document type=${docType} entityId=${context.entityId}`,
    );

    try {
      await this.docGenService.generate({
        documentType: docType,
        entityId: context.entityId,
        trigger: 'workflow',
        userId: context.userId,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `${logPrefix} — generation failed for ${docType}/${context.entityId}: ${err.message}`,
      );
    }
  }
}
