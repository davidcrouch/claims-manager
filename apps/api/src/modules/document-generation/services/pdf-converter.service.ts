import { Injectable, Logger } from '@nestjs/common';
import { OfficeConverterService } from '../../../common/office/office-converter.service';

@Injectable()
export class PdfConverterService {
  private readonly logger = new Logger('PdfConverterService');

  constructor(private readonly officeConverter: OfficeConverterService) {}

  isAvailable(): boolean {
    return this.officeConverter.isAvailable();
  }

  async convertDocxToPdf(params: { docxBuffer: Buffer }): Promise<Buffer> {
    const logPrefix = 'PdfConverterService.convertDocxToPdf';
    this.logger.debug(`${logPrefix} — converting docx (${params.docxBuffer.length} bytes) to pdf`);
    const pdfBuffer = await this.officeConverter.convertToPdf({
      buffer: params.docxBuffer,
      sourceFileName: 'source.docx',
    });
    this.logger.debug(`${logPrefix} — conversion complete (${pdfBuffer.length} bytes)`);
    return pdfBuffer;
  }
}
