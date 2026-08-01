import { Injectable, Logger } from '@nestjs/common';
import { promisify } from 'util';
import * as libre from 'libreoffice-convert';

const convertAsync = promisify(libre.convert);

@Injectable()
export class PdfConverterService {
  private readonly logger = new Logger('PdfConverterService');

  async convertDocxToPdf(params: { docxBuffer: Buffer }): Promise<Buffer> {
    const logPrefix = 'PdfConverterService.convertDocxToPdf';
    this.logger.debug(`${logPrefix} — converting docx (${params.docxBuffer.length} bytes) to pdf`);

    try {
      const pdfBuffer = await convertAsync(params.docxBuffer, '.pdf', undefined);
      this.logger.debug(`${logPrefix} — conversion complete (${pdfBuffer.length} bytes)`);
      return pdfBuffer;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `${logPrefix} — conversion failed: ${err.message}. Ensure LibreOffice is installed.`,
      );
      throw new Error(
        `PDF conversion failed: ${err.message}. LibreOffice must be installed on the host.`,
      );
    }
  }
}
