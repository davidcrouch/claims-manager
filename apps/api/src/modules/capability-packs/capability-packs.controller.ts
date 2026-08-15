import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import JSZip from 'jszip';
import { parse as parseYaml } from 'yaml';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { PackInstallService } from './pack-install.service';
import type { InstallPackDto } from './pack-manifest.types';

@ApiTags('Capability Packs')
@Controller('capability-packs')
export class CapabilityPacksController {
  constructor(private readonly installService: PackInstallService) {}

  @Get()
  @RequirePermission(P.ai.read)
  @ApiOperation({ summary: 'List capability pack catalog (builtin + uploads)' })
  listCatalog() {
    return this.installService.listCatalog();
  }

  @Get('installed')
  @RequirePermission(P.ai.read)
  @ApiOperation({ summary: 'List installed capability packs for tenant' })
  listInstalled() {
    return this.installService.listInstalled();
  }

  @Get('uploads')
  @RequirePermission(P.ai.read)
  @ApiOperation({ summary: 'List uploaded pack bundles' })
  listUploads() {
    return this.installService.listUploads();
  }

  @Get('preview')
  @RequirePermission(P.ai.read)
  @ApiOperation({ summary: 'Preview agents, skills, and integrations in a pack' })
  preview(
    @Query('packId') packId?: string,
    @Query('version') version?: string,
    @Query('uploadId') uploadId?: string,
  ) {
    return this.installService.preview({ packId, version, uploadId });
  }

  @Post('install')
  @RequirePermission(P.ai.admin)
  @ApiOperation({ summary: 'Install a builtin or uploaded capability pack' })
  install(@Body() body: InstallPackDto) {
    return this.installService.install(body);
  }

  @Post('upgrade/:installId')
  @RequirePermission(P.ai.admin)
  @ApiOperation({ summary: 'Upgrade an installed pack to the latest catalog version' })
  upgrade(@Param('installId') installId: string) {
    return this.installService.upgrade(installId);
  }

  @Delete(':installId')
  @RequirePermission(P.ai.admin)
  @ApiOperation({ summary: 'Uninstall a capability pack' })
  uninstall(
    @Param('installId') installId: string,
    @Query('force') force?: string,
  ) {
    return this.installService.uninstall(installId, force === 'true' || force === '1');
  }

  @Get('drift/:installId')
  @RequirePermission(P.ai.admin)
  @ApiOperation({ summary: 'Report drift between pack source and installed artefacts' })
  drift(@Param('installId') installId: string) {
    return this.installService.getDrift(installId);
  }

  @Post('upload')
  @RequirePermission(P.ai.admin)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a pack zip or JSON bundle' })
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { bundleJson?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    let bundle: unknown;
    if (file?.buffer) {
      const name = (file.originalname || '').toLowerCase();
      if (name.endsWith('.json')) {
        bundle = JSON.parse(file.buffer.toString('utf8'));
      } else {
        bundle = await zipToBundle(file.buffer);
      }
    } else if (body.bundleJson) {
      bundle = JSON.parse(body.bundleJson);
    } else {
      return { error: 'file or bundleJson required' };
    }
    return this.installService.uploadBundle({ bundle, userId: user.sub });
  }
}

async function zipToBundle(buffer: Buffer): Promise<{
  manifest: unknown;
  files: Record<string, string>;
}> {
  const zip = await JSZip.loadAsync(buffer);
  const files: Record<string, string> = {};
  let manifestRaw: string | null = null;

  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const normalized = name.replace(/^\/+/, '');
    const content = await entry.async('string');
    files[normalized] = content;
    if (normalized === 'pack.yaml' || normalized.endsWith('/pack.yaml')) {
      manifestRaw = content;
      if (normalized.includes('/')) {
        // flatten nested root folder
        const prefix = normalized.slice(0, normalized.lastIndexOf('/') + 1);
        for (const [k, v] of Object.entries({ ...files })) {
          if (k.startsWith(prefix)) {
            files[k.slice(prefix.length)] = v;
          }
        }
      }
    }
  }

  if (!manifestRaw && files['pack.yaml']) manifestRaw = files['pack.yaml'];
  if (!manifestRaw) {
    throw new Error('Zip missing pack.yaml');
  }
  const manifest = parseYaml(manifestRaw);
  return { manifest, files };
}
