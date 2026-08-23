import { Injectable, Logger } from '@nestjs/common';
import createReport, { listCommands } from 'docx-templates';
import type { TemplateData } from '../types/document-types';
import { formatDocumentGenerationError } from '../utils/format-generation-error';
import { TEMPLATE_CMD_DELIMITER } from './template-engine.config';

type TemplateCommand = {
  type?: string;
  code?: string;
  raw?: string;
};

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

@Injectable()
export class TemplateEngineService {
  private readonly logger = new Logger('TemplateEngineService');

  async populate(params: {
    templateBuffer: Buffer;
    data: TemplateData;
  }): Promise<Buffer> {
    const logPrefix = 'TemplateEngineService.populate';
    this.logger.debug(`${logPrefix} — populating template (${params.templateBuffer.length} bytes)`);

    try {
      const output = await createReport({
        template: params.templateBuffer,
        data: params.data,
        cmdDelimiter: TEMPLATE_CMD_DELIMITER,
        failFast: true,
        processLineBreaks: true,
      });

      const buffer = Buffer.isBuffer(output) ? output : Buffer.from(output);
      this.logger.debug(`${logPrefix} — generated populated docx (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      const detail = formatDocumentGenerationError(error);
      this.logger.error(`${logPrefix} — ${detail}`);
      throw new Error(detail, { cause: error });
    }
  }

  async getTemplateTags(params: { templateBuffer: Buffer }): Promise<string[]> {
    const logPrefix = 'TemplateEngineService.getTemplateTags';
    const commands = (await listCommands(
      toArrayBuffer(params.templateBuffer),
      TEMPLATE_CMD_DELIMITER,
    )) as TemplateCommand[];

    const tags = new Set<string>();
    for (const command of commands) {
      const code = command.code?.trim();
      if (!code) continue;

      if (command.type === 'INS' || command.type === 'EQUALS') {
        tags.add(code);
        continue;
      }

      if (command.type === 'FOR') {
        tags.add(`FOR ${code}`);
      }
    }

    const unique = [...tags];
    this.logger.debug(`${logPrefix} — found ${unique.length} unique tags`);
    return unique;
  }
}
