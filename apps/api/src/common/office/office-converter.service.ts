import { Injectable, Logger } from '@nestjs/common';
import { convertWithOptions } from 'libreoffice-convert';
import { existsSync, readdirSync } from 'fs';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { delimiter, join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const SOFFICE_CANDIDATES = [
  process.env.LIBREOFFICE_PATH,
  process.env.LIBRE_OFFICE_EXE,
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  '/opt/homebrew/bin/soffice',
  '/usr/local/bin/soffice',
  '/usr/bin/soffice',
  '/usr/bin/libreoffice',
  'C:\\Program Files\\LibreOffice\\program\\soffice.com',
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
].filter((p): p is string => Boolean(p));

const WINWORD_CANDIDATES = [
  join(process.env['ProgramFiles'] ?? 'C:\\Program Files', 'Microsoft Office', 'root', 'Office16', 'WINWORD.EXE'),
  join(process.env['ProgramFiles'] ?? 'C:\\Program Files', 'Microsoft Office', 'Office16', 'WINWORD.EXE'),
  join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft Office', 'root', 'Office16', 'WINWORD.EXE'),
  join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft Office', 'Office16', 'WINWORD.EXE'),
];

const WORD_CONVERT_PS1 = `
param(
  [Parameter(Mandatory = $true)][string]$Docx,
  [Parameter(Mandatory = $true)][string]$Pdf
)
$ErrorActionPreference = 'Stop'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open($Docx, $false, $true)
  try {
    $wdFormatPDF = 17
    $doc.SaveAs2($Pdf, $wdFormatPDF)
  } finally {
    $doc.Close($false) | Out-Null
  }
} finally {
  $word.Quit() | Out-Null
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
`;

function sofficeFromPath(): string[] {
  const dirs = (process.env.PATH ?? '').split(delimiter);
  const names = process.platform === 'win32'
    ? ['soffice.com', 'soffice.exe', 'soffice']
    : ['soffice', 'libreoffice'];
  return dirs.flatMap((dir) => names.map((name) => join(dir, name)));
}

/** Versioned installs such as `C:\Program Files\LibreOffice 25\program\soffice.exe`. */
function sofficeFromProgramFolders(): string[] {
  if (process.platform !== 'win32') return [];
  const roots = [
    process.env['ProgramFiles'],
    process.env['ProgramFiles(x86)'],
    process.env.LOCALAPPDATA,
  ].filter((root): root is string => Boolean(root));

  const found: string[] = [];
  for (const root of roots) {
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!/^LibreOffice/i.test(name)) continue;
      for (const bin of ['soffice.com', 'soffice.exe']) {
        found.push(join(root, name, 'program', bin));
      }
    }
  }
  return found;
}

@Injectable()
export class OfficeConverterService {
  private readonly logger = new Logger('OfficeConverterService');
  private resolvedSoffice: string | null | undefined;
  private resolvedWinWord: string | null | undefined;
  private wordQueue: Promise<unknown> = Promise.resolve();

  isAvailable(): boolean {
    return this.resolveSofficeBinary() != null;
  }

  resolveSofficeBinary(): string | null {
    if (this.resolvedSoffice) return this.resolvedSoffice;
    const candidates = [
      ...SOFFICE_CANDIDATES,
      ...sofficeFromProgramFolders(),
      ...sofficeFromPath(),
    ];
    const found = candidates.find((p) => existsSync(p)) ?? null;
    if (found) this.resolvedSoffice = found;
    return found;
  }

  resolveWinWordBinary(): string | null {
    if (process.platform !== 'win32') return null;
    if (this.resolvedWinWord) return this.resolvedWinWord;
    const found = WINWORD_CANDIDATES.find((p) => existsSync(p)) ?? null;
    if (found) this.resolvedWinWord = found;
    return found;
  }

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
    const soffice = this.resolveSofficeBinary();
    if (soffice) {
      this.logger.debug(
        `${logPrefix} — format=${params.format} bytes=${params.buffer.length} soffice=${soffice}`,
      );
      const output = await this.convertWithLibreOffice({
        buffer: params.buffer,
        format: params.format,
        sourceFileName: params.sourceFileName,
        soffice,
      });
      this.logger.debug(`${logPrefix} — format=${params.format} complete bytes=${output.length}`);
      return output;
    }

    if (params.format === 'pdf' && this.resolveWinWordBinary()) {
      this.logger.debug(
        `${logPrefix} — format=pdf bytes=${params.buffer.length} using Microsoft Word`,
      );
      const output = await this.convertPdfWithWord(params.buffer);
      this.logger.debug(`${logPrefix} — format=pdf complete bytes=${output.length} via Word`);
      return output;
    }

    throw new Error(
      'No PDF converter available. Install LibreOffice or Microsoft Word.',
    );
  }

  private convertWithLibreOffice(params: {
    buffer: Buffer;
    format: 'pdf' | 'png';
    sourceFileName: string;
    soffice: string;
  }): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      convertWithOptions(
        params.buffer,
        params.format,
        undefined,
        {
          sofficeBinaryPaths: [params.soffice],
          fileName: params.sourceFileName,
        },
        (err, result) => {
          if (err) reject(err);
          else if (!result?.length) reject(new Error(`${params.format} conversion returned empty buffer`));
          else resolve(result);
        },
      );
    });
  }

  private convertPdfWithWord(buffer: Buffer): Promise<Buffer> {
    const run = async () => {
      const dir = await mkdtemp(join(tmpdir(), 'cm-word-pdf-'));
      const docxPath = join(dir, 'source.docx');
      const pdfPath = join(dir, 'source.pdf');
      const scriptPath = join(dir, 'convert.ps1');
      try {
        await writeFile(docxPath, buffer);
        await writeFile(scriptPath, WORD_CONVERT_PS1, 'utf8');
        await execFileAsync(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            scriptPath,
            '-Docx',
            docxPath,
            '-Pdf',
            pdfPath,
          ],
          { timeout: 120_000, windowsHide: true },
        );
        if (!existsSync(pdfPath)) {
          throw new Error('Microsoft Word did not produce a PDF');
        }
        return await readFile(pdfPath);
      } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => undefined);
      }
    };

    const queued = this.wordQueue.then(run, run);
    this.wordQueue = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }
}
