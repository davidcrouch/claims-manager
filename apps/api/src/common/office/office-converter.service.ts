import { Injectable, Logger } from '@nestjs/common';
import { convertWithOptions } from 'libreoffice-convert';
import { existsSync } from 'fs';
import { delimiter, join } from 'path';

const SOFFICE_CANDIDATES = [
  process.env.LIBREOFFICE_PATH,
  process.env.LIBRE_OFFICE_EXE,
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  '/opt/homebrew/bin/soffice',
  '/usr/local/bin/soffice',
  '/usr/bin/soffice',
  '/usr/bin/libreoffice',
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files\\LibreOffice\\program\\soffice.com',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
].filter((p): p is string => Boolean(p));

function sofficeFromPath(): string[] {
  const dirs = (process.env.PATH ?? '').split(delimiter);
  const names = process.platform === 'win32'
    ? ['soffice.exe', 'soffice.com', 'soffice']
    : ['soffice', 'libreoffice'];
  return dirs.flatMap((dir) => names.map((name) => join(dir, name)));
}

@Injectable()
export class OfficeConverterService {
  private readonly logger = new Logger('OfficeConverterService');

  async convertToPdf(params: {
    buffer: Buffer;
    sourceFileName?: string;
  }): Promise<Buffer> {
    return this.convert({
      buffer: params.buffer,
      format: 'pdf',
      sourceFileName: params.sourceFileName ?? 'source.docx',
    });
  }

  async convertToPng(params: {
    buffer: Buffer;
    sourceFileName?: string;
  }): Promise<Buffer> {
    return this.convert({
      buffer: params.buffer,
      format: 'png',
      sourceFileName: params.sourceFileName ?? 'source.docx',
    });
  }

  private async convert(params: {
    buffer: Buffer;
    format: 'pdf' | 'png';
    sourceFileName: string;
  }): Promise<Buffer> {
    const logPrefix = 'OfficeConverterService.convert';
    const sofficeBinaryPaths = [...SOFFICE_CANDIDATES, ...sofficeFromPath()].filter((p) =>
      existsSync(p),
    );
    if (sofficeBinaryPaths.length === 0) {
      throw new Error(
        'Could not find soffice binary. Install LibreOffice or set LIBREOFFICE_PATH.',
      );
    }

    this.logger.debug(
      `${logPrefix} — format=${params.format} bytes=${params.buffer.length} soffice=${sofficeBinaryPaths[0]}`,
    );

    const output = await new Promise<Buffer>((resolve, reject) => {
      convertWithOptions(
        params.buffer,
        params.format,
        undefined,
        {
          sofficeBinaryPaths,
          fileName: params.sourceFileName,
        },
        (err, result) => {
          if (err) reject(err);
          else if (!result?.length) reject(new Error(`${params.format} conversion returned empty buffer`));
          else resolve(result);
        },
      );
    });

    this.logger.debug(`${logPrefix} — format=${params.format} complete bytes=${output.length}`);
    return output;
  }
}
