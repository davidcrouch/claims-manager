import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContext } from '../../tenant/tenant-context';
import { GuideService } from './guide.service';

@Controller('guides')
@UseGuards(JwtAuthGuard)
export class GuideController {
  constructor(
    private readonly guideService: GuideService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Get()
  async listGuides() {
    const tenantId = this.tenantContext.getTenantId();
    return this.guideService.listGuides(tenantId);
  }

  @Get('search')
  async searchGuides(
    @Query('q') query: string,
    @Query('route') route?: string,
    @Query('topK') topK?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    if (!query?.trim()) return [];
    const hits = await this.guideService.searchGuides(query, tenantId, {
      topK: topK ? parseInt(topK, 10) : undefined,
      routeBoost: route,
    });
    return hits.map((hit) => ({
      slug: hit.guideSlug,
      title: hit.guideTitle,
      description: hit.guideDescription,
      heading: hit.headingPath,
      excerpt: hit.chunkContent,
      similarity: hit.similarity,
      routes: hit.guideRoutes,
    }));
  }

  @Get('by-route')
  async getGuidesByRoute(@Query('route') route: string) {
    const tenantId = this.tenantContext.getTenantId();
    if (!route?.trim()) return [];
    return this.guideService.getGuidesByRoute(tenantId, route);
  }

  @Get(':slug')
  async getGuide(@Param('slug') slug: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.guideService.getGuideContent(tenantId, slug);
  }

  @Get(':slug/content')
  async getGuideContent(@Param('slug') slug: string) {
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.guideService.getGuideContent(tenantId, slug);
    if (!doc) return { content: null };
    return { content: doc.content, title: doc.title, slug: doc.slug };
  }
}
