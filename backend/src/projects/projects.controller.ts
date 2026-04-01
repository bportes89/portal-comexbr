import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  async create(@Body() data: { name: string; userId: string }) {
    try {
      return await this.projectsService.createForUser(data);
    } catch (error: unknown) {
      this.logger.error(error);
      return { created: false };
    }
  }

  @Get()
  async findAll(@Query('userId') userId?: string) {
    try {
      return await this.projectsService.findAll(userId);
    } catch (error: unknown) {
      this.logger.error(error);
      return [];
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: { name?: string }) {
    try {
      return await this.projectsService.update(id, data);
    } catch (error: unknown) {
      this.logger.error(error);
      return { id, updated: false };
    }
  }

  @Get(':id/members')
  async listMembers(@Param('id') id: string, @Query('userId') userId?: string) {
    if (!userId) return [];
    try {
      return await this.projectsService.listMembers({ projectId: id, userId });
    } catch (error: unknown) {
      this.logger.error(error);
      return [];
    }
  }

  @Post(':id/members')
  async addMember(
    @Param('id') id: string,
    @Body()
    data: { userId: string; email: string; role?: string },
  ) {
    try {
      return await this.projectsService.addMember({
        projectId: id,
        userId: data.userId,
        email: data.email,
        role: data.role,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { added: false };
    }
  }

  @Patch(':id/members/:memberId')
  async updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body()
    data: { userId: string; role: string },
  ) {
    try {
      return await this.projectsService.updateMemberRole({
        projectId: id,
        userId: data.userId,
        memberId,
        role: data.role,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { id: memberId, updated: false };
    }
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Query('userId') userId?: string,
  ) {
    if (!userId) return { id: memberId, deleted: false };
    try {
      return await this.projectsService.removeMember({
        projectId: id,
        userId,
        memberId,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { id: memberId, deleted: false };
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Query('userId') userId?: string) {
    if (userId) {
      try {
        return await this.projectsService.removeForUser({ id, userId });
      } catch (error: unknown) {
        this.logger.error(error);
        return { id, deleted: false };
      }
    }
    try {
      return await this.projectsService.remove(id);
    } catch (error: unknown) {
      this.logger.error(error);
      return { id, deleted: false };
    }
  }
}
