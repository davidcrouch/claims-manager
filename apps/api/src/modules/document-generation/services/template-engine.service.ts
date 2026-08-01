import { Injectable, Logger } from '@nestjs/common';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class TemplateEngineService {
  private readonly logger = new Logger('TemplateEngineService');

  populate(params: {
    templateBuffer: Buffer;
    data: TemplateData;
  }): Buffer {
    const logPrefix = 'TemplateEngineService.populate';
    this.logger.debug(`${logPrefix} — populating template (${params.templateBuffer.length} bytes)`);

    const zip = new PizZip(params.templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{', end: '}' },
    });

    doc.render(params.data);

    const output = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    }) as Buffer;

    this.logger.debug(`${logPrefix} — generated populated docx (${output.length} bytes)`);
    return output;
  }

  getTemplateTags(params: { templateBuffer: Buffer }): string[] {
    const logPrefix = 'TemplateEngineService.getTemplateTags';
    const zip = new PizZip(params.templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{', end: '}' },
    });

    const tags = doc.getFullText().match(/\{([^}]+)\}/g) ?? [];
    const unique = [...new Set(tags.map((t) => t.slice(1, -1)))];
    this.logger.debug(`${logPrefix} — found ${unique.length} unique tags`);
    return unique;
  }
}
