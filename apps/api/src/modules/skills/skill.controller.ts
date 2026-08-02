import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { SkillService } from './skill.service';
import type { CreateSkillDto, TestMatchRequest, UpdateSkillDto } from './skill.types';

@ApiTags('skills')
@Controller('skills')
export class SkillController {
  constructor(private readonly skillService: SkillService) {}

  @Get()
  @RequirePermission('ai.read')
  @ApiOperation({ summary: 'List skills visible to the current tenant' })
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.skillService.listVisible(user);
  }

  @Post('test-match')
  @RequirePermission('ai.read')
  @ApiOperation({ summary: 'Test skill matching for a message' })
  async testMatch(@Body() body: TestMatchRequest) {
    return this.skillService.testMatch(body);
  }

  @Post(':id/test-invoke')
  @RequirePermission('ai.read')
  @ApiOperation({ summary: 'Test invoke a skill with a sample message' })
  @ApiParam({ name: 'id', type: 'string' })
  async testInvoke(
    @Param('id') id: string,
    @Body() body: { message: string },
  ) {
    const result = await this.skillService.testInvoke(id, body.message);
    return result;
  }

  @Get(':id')
  @RequirePermission('ai.read')
  @ApiOperation({ summary: 'Get a skill by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  async getById(@Param('id') id: string) {
    const skill = await this.skillService.findById(id);
    if (!skill) throw new NotFoundException('Skill not found');
    return skill;
  }

  @Post()
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Create a new skill' })
  async create(@Body() body: CreateSkillDto, @CurrentUser() user: AuthenticatedUser) {
    return this.skillService.create(body, user);
  }

  @Put(':id')
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Update a skill' })
  @ApiParam({ name: 'id', type: 'string' })
  async update(
    @Param('id') id: string,
    @Body() body: Omit<UpdateSkillDto, 'id'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.skillService.update({ ...body, id }, user);
    if (!result) throw new NotFoundException('Skill not found');
    return result;
  }

  @Delete(':id')
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Delete a skill' })
  @ApiParam({ name: 'id', type: 'string' })
  async delete(@Param('id') id: string) {
    const deleted = await this.skillService.delete(id);
    if (!deleted) throw new NotFoundException('Skill not found');
    return { success: true };
  }
}
