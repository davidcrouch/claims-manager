import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AgentService } from './agent.service';
import type { CreateAgentDto, UpdateAgentDto } from './agent.types';

@ApiTags('agents')
@Controller('agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get()
  @RequirePermission('ai.read')
  @ApiOperation({ summary: 'List agents visible to the current user' })
  @ApiQuery({
    name: 'chatEnabled',
    required: false,
    enum: ['true', 'false'],
  })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('chatEnabled') chatEnabled?: string,
  ) {
    const chatFilter =
      chatEnabled !== undefined ? chatEnabled === 'true' : undefined;
    return this.agentService.listVisibleAgents(user, { chatEnabled: chatFilter });
  }

  @Get(':id')
  @RequirePermission('ai.read')
  @ApiOperation({ summary: 'Get agent by ID' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const agent = await this.agentService.getAgentById(id, user);
    if (!agent) {
      throw new NotFoundException(`Agent not found: ${id}`);
    }
    return agent;
  }

  @Post()
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Create a new chat agent' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAgentDto,
  ) {
    return this.agentService.createAgent(dto, user);
  }

  @Put(':id')
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Update an existing agent' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: Omit<UpdateAgentDto, 'id'>,
  ) {
    const result = await this.agentService.updateAgent({ ...dto, id }, user);
    if (!result.ok) {
      throw new NotFoundException(result.error);
    }
    return result.agent;
  }

  @Delete(':id')
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Delete an agent' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const result = await this.agentService.deleteAgent(id, user);
    if (!result.ok) {
      throw new NotFoundException(result.error);
    }
    return { ok: true };
  }
}
