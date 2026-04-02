import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('job/:jobId')
  async findByJob(@Param('jobId') jobId: string) {
    return this.appointmentsService.findByJob({ jobId });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne({ id });
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.appointmentsService.create({ body });
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.appointmentsService.update({ id, body });
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.appointmentsService.cancel({ id, body });
  }
}
