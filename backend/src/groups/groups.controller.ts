import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
  private readonly logger = new Logger(GroupsController.name);

  constructor(private readonly groupsService: GroupsService) {}

  @Post('create-wa')
  async createOnWhatsapp(
    @Body()
    data: {
      userId: string;
      projectId?: string;
      instanceName: string;
      name: string;
      participants: string[];
    },
  ) {
    if (!data?.userId) return { created: false };
    try {
      return await this.groupsService.createOnWhatsapp(data);
    } catch (error: unknown) {
      this.logger.error(error);
      return { created: false };
    }
  }

  @Post()
  async create(
    @Body()
    data: {
      name: string;
      whatsappId: string;
      userId: string;
      projectId?: string;
    },
  ) {
    try {
      return await this.groupsService.createForUser(data);
    } catch (error: unknown) {
      this.logger.error(error);
      return { created: false };
    }
  }

  @Post('import')
  async importFromInstance(
    @Body()
    data: {
      userId: string;
      instanceName: string;
      projectId?: string;
    },
  ) {
    try {
      return await this.groupsService.importFromInstance(data);
    } catch (error: unknown) {
      this.logger.error(error);
      return { imported: 0, total: 0 };
    }
  }

  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
  ) {
    if (!userId) return [];
    try {
      return await this.groupsService.findAll({ userId, projectId });
    } catch (error: unknown) {
      this.logger.error(error);
      return [];
    }
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    data: {
      name?: string;
      whatsappId?: string;
      userId?: string;
      projectId?: string;
    },
  ) {
    if (!data.userId) return { id, updated: false };
    try {
      await this.groupsService.ensureGroupAccess({
        groupId: id,
        userId: data.userId,
        projectId: data.projectId,
      });
      return await this.groupsService.update(id, {
        name: data.name,
        whatsappId: data.whatsappId,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { id, updated: false };
    }
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
  ) {
    if (!userId) return { id, deleted: false };
    try {
      await this.groupsService.ensureGroupAccess({
        groupId: id,
        userId,
        projectId,
      });
      return await this.groupsService.remove(id);
    } catch (error: unknown) {
      this.logger.error(error);
      return { id, deleted: false };
    }
  }

  @Post(':id/send')
  async sendToGroup(
    @Param('id') id: string,
    @Body()
    data: {
      instanceName: string;
      text: string;
      delay?: number;
      userId?: string;
      projectId?: string;
    },
  ) {
    if (!data.userId) return { status: 'failed' };
    try {
      await this.groupsService.ensureGroupAccess({
        groupId: id,
        userId: data.userId,
        projectId: data.projectId,
      });
      return await this.groupsService.queueMessageToGroup({
        groupId: id,
        instanceName: data.instanceName,
        text: data.text,
        delay: data.delay,
        userId: data.userId,
        projectId: data.projectId,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { status: 'failed' };
    }
  }

  @Post(':id/send-media')
  async sendMediaToGroup(
    @Param('id') id: string,
    @Body()
    data: {
      instanceName: string;
      mediaType: string;
      mimeType: string;
      media: string;
      fileName: string;
      caption?: string;
      delay?: number;
      userId?: string;
      projectId?: string;
    },
  ) {
    if (!data.userId) return { status: 'failed' };
    try {
      await this.groupsService.ensureGroupAccess({
        groupId: id,
        userId: data.userId,
        projectId: data.projectId,
      });
      return await this.groupsService.queueMediaToGroup({
        groupId: id,
        instanceName: data.instanceName,
        mediaType: data.mediaType,
        mimeType: data.mimeType,
        media: data.media,
        fileName: data.fileName,
        caption: data.caption,
        delay: data.delay,
        userId: data.userId,
        projectId: data.projectId,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { status: 'failed' };
    }
  }

  @Post(':id/sequence')
  async sequenceToGroup(
    @Param('id') id: string,
    @Body()
    data: {
      instanceName: string;
      steps: Array<{ text: string; delayMs?: number }>;
      userId?: string;
      projectId?: string;
    },
  ) {
    if (!data.userId) return { status: 'failed' };
    try {
      await this.groupsService.ensureGroupAccess({
        groupId: id,
        userId: data.userId,
        projectId: data.projectId,
      });
      return await this.groupsService.queueSequenceToGroup({
        groupId: id,
        instanceName: data.instanceName,
        steps: data.steps,
        userId: data.userId,
        projectId: data.projectId,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { status: 'failed' };
    }
  }

  @Get(':id/invite-code')
  async getInviteCode(
    @Param('id') id: string,
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
    @Query('instanceName') instanceName?: string,
  ) {
    if (!userId || !instanceName) return { inviteUrl: null };
    try {
      return await this.groupsService.getInviteCode({
        groupId: id,
        userId,
        projectId,
        instanceName,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { inviteUrl: null };
    }
  }

  @Post(':id/invite')
  async sendInvite(
    @Param('id') id: string,
    @Body()
    data: {
      userId: string;
      projectId?: string;
      instanceName: string;
      numbers: string[];
      description?: string;
    },
  ) {
    if (!data?.userId || !data?.instanceName) return { sent: false };
    try {
      const res = await this.groupsService.sendInvite({
        groupId: id,
        userId: data.userId,
        projectId: data.projectId,
        instanceName: data.instanceName,
        numbers: data.numbers ?? [],
        description: data.description,
      });
      return { sent: true, result: res };
    } catch (error: unknown) {
      this.logger.error(error);
      return { sent: false };
    }
  }

  @Post(':id/participants')
  async updateParticipants(
    @Param('id') id: string,
    @Body()
    data: {
      userId: string;
      projectId?: string;
      instanceName: string;
      action: 'add' | 'remove';
      participants: string[];
    },
  ) {
    if (!data?.userId || !data?.instanceName) return { updated: false };
    try {
      const res = await this.groupsService.updateParticipants({
        groupId: id,
        userId: data.userId,
        projectId: data.projectId,
        instanceName: data.instanceName,
        action: data.action,
        participants: data.participants ?? [],
      });
      return { updated: true, result: res };
    } catch (error: unknown) {
      this.logger.error(error);
      return { updated: false };
    }
  }

  @Get(':id/metadata')
  async fetchMetadata(
    @Param('id') id: string,
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
    @Query('instanceName') instanceName?: string,
  ) {
    if (!userId || !instanceName) return null;
    try {
      return await this.groupsService.fetchWhatsappMetadata({
        groupId: id,
        userId,
        projectId,
        instanceName,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return null;
    }
  }

  @Put(':id/metadata')
  async updateMetadata(
    @Param('id') id: string,
    @Body()
    data: {
      userId: string;
      projectId?: string;
      instanceName: string;
      subject?: string;
      description?: string;
    },
  ) {
    if (!data?.userId || !data?.instanceName) return { updated: false };
    try {
      const res = await this.groupsService.updateWhatsappMetadata({
        groupId: id,
        userId: data.userId,
        projectId: data.projectId,
        instanceName: data.instanceName,
        subject: data.subject,
        description: data.description,
      });
      return { updated: true, metadata: res };
    } catch (error: unknown) {
      this.logger.error(error);
      return { updated: false };
    }
  }
}
