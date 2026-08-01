import { Injectable, Logger } from '@nestjs/common';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const expressionParser = require('docxtemplater/expressions.js');
import type { TemplateData } from '../types/document-types';

@Injectable()
export class TemplateEngineService {
  private readonly logger = new Logger('TemplateEngineService');

  private readonly parser = expressionParser.configure({ csp: true });

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
      parser: this.parser,
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
      parser: this.parser,
    });

    const tags = doc.getFullText().match(/\{([^}]+)\}/g) ?? [];
    const unique = [...new Set(tags.map((t) => t.slice(1, -1)))];
    this.logger.debug(`${logPrefix} — found ${unique.length} unique tags`);
    return unique;
  }
}
