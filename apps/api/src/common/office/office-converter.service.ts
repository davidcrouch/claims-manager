import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readdirSync } from 'fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { delimiter, dirname, join } from 'path';
import { spawn } from 'child_process';
import { pathToFileURL } from 'url';

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

const CONVERT_TIMEOUT_MS = 60_000;

@Injectable()
export class OfficeConverterService {
  private readonly logger = new Logger('OfficeConverterService');
  private resolvedSoffice: string | null | undefined;
  private resolvedWinWord: string | null | undefined;
  private wordQueue: Promise<unknown> = Promise.resolve();
  private loQueue: Promise<unknown> = Promise.resolve();

  isAvailable(): boolean {
    return this.resolveSofficeBinary() != null || this.resolveWinWordBinary() != null;
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
    const run = () => this.convertWithLibreOfficeOnce(params);
    const queued = this.loQueue.then(run, run);
    this.loQueue = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }

  private async convertWithLibreOfficeOnce(params: {
    buffer: Buffer;
    format: 'pdf' | 'png';
    sourceFileName: string;
    soffice: string;
  }): Promise<Buffer> {
    const logPrefix = 'OfficeConverterService.convertWithLibreOfficeOnce';
    const dir = await mkdtemp(join(tmpdir(), 'cm-lo-'));
    const profileDir = join(dir, 'profile');
    const outDir = join(dir, 'out');
    const sourcePath = join(dir, params.sourceFileName);
    await mkdir(profileDir, { recursive: true });
    await mkdir(outDir, { recursive: true });
    await writeFile(sourcePath, params.buffer);

    const args = [
      '--headless',
      '--norestore',
      '--nolockcheck',
      '--nologo',
      '--nodefault',
      '--nofirststartwizard',
      `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
      '--convert-to',
      params.format,
      '--outdir',
      outDir,
      sourcePath,
    ];

    try {
      await this.runProcess(params.soffice, args, CONVERT_TIMEOUT_MS);
      const produced = (await readdir(outDir)).find((name) =>
        name.toLowerCase().endsWith(`.${params.format}`),
      );
      if (!produced) {
        throw new Error(`${params.format} conversion produced no output`);
      }
      const output = await readFile(join(outDir, produced));
      if (!output.length) {
        throw new Error(`${params.format} conversion returned empty buffer`);
      }
      this.logger.debug(
        `${logPrefix} — format=${params.format} complete bytes=${output.length}`,
      );
      return output;
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private runProcess(bin: string, args: string[], timeoutMs: number): Promise<void> {
    const logPrefix = 'OfficeConverterService.runProcess';
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, {
        cwd: dirname(bin),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk) => {
        stdout += String(chunk);
      });
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk);
      });

      let settled = false;
      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve();
      };

      const timer = setTimeout(() => {
        this.logger.warn(
          `${logPrefix} — timed out after ${timeoutMs}ms bin=${bin} pid=${child.pid}`,
        );
        this.killProcessTree(child.pid);
        finish(new Error(`Office conversion timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.on('error', (err) => finish(err));
      child.on('close', (code) => {
        if (code === 0) {
          finish();
          return;
        }
        const detail = (stderr || stdout).trim().slice(0, 500);
        finish(
          new Error(
            `Office converter exited ${code}${detail ? `: ${detail}` : ''}`,
          ),
        );
      });
    });
  }

  private killProcessTree(pid: number | undefined): void {
    if (!pid) return;
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      return;
    }
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* already gone */
      }
    }
  }

  private convertPdfWithWord(buffer: Buffer): Promise<Buffer> {
    const run = async () => {
      const logPrefix = 'OfficeConverterService.convertPdfWithWord';
      const dir = await mkdtemp(join(tmpdir(), 'cm-word-pdf-'));
      const docxPath = join(dir, 'source.docx');
      const pdfPath = join(dir, 'source.pdf');
      const scriptPath = join(dir, 'convert.ps1');
      try {
        await writeFile(docxPath, buffer);
        await writeFile(scriptPath, WORD_CONVERT_PS1, 'utf8');
        await this.runProcess(
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
          CONVERT_TIMEOUT_MS,
        );
        if (!existsSync(pdfPath)) {
          throw new Error('Microsoft Word did not produce a PDF');
        }
        this.logger.debug(`${logPrefix} — produced ${pdfPath}`);
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
