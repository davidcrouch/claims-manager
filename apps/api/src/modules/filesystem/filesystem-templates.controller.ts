import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { FilesystemTemplatesService } from './filesystem-templates.service';
import {
  CreateFilesystemTemplateDto,
  UpdateFilesystemTemplateDto,
  ReplaceCategoriesDto,
} from './dto';

@Controller('filesystem-templates')
export class FilesystemTemplatesController {
  constructor(private readonly templatesService: FilesystemTemplatesService) {}

  @Get()
  async findAll() {
    return this.templatesService.findAll();
  }

  @Post()
  async create(@Body() dto: CreateFilesystemTemplateDto) {
    return this.templatesService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFilesystemTemplateDto,
  ) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  async archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.archive(id);
  }

  @Put(':id/categories')
  async replaceCategories(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceCategoriesDto,
  ) {
    return this.templatesService.replaceCategories(id, dto);
  }
}
