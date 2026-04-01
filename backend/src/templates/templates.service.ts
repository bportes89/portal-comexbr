import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProjectAccess(params: {
    userId: string;
    projectId: string;
  }) {
    const membership = await this.prisma.projectMember.findFirst({
      where: { userId: params.userId, projectId: params.projectId },
      select: { id: true },
    });
    if (membership) return;

    const owned = await this.prisma.project.findFirst({
      where: { id: params.projectId, ownerId: params.userId },
      select: { id: true },
    });
    if (!owned) throw new Error('Forbidden');
  }

  async list(params: { userId: string; projectId?: string }) {
    const projectId = params.projectId?.trim()
      ? params.projectId.trim()
      : undefined;
    if (projectId)
      await this.ensureProjectAccess({ userId: params.userId, projectId });

    return this.prisma.messageTemplate.findMany({
      where: {
        userId: params.userId,
        ...(projectId ? { projectId } : { projectId: null }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    userId: string;
    projectId?: string;
    name: string;
    content: string;
  }) {
    const name = data.name.trim();
    const content = data.content.trim();
    if (!name || !content) throw new Error('Invalid template');

    const projectId = data.projectId?.trim()
      ? data.projectId.trim()
      : undefined;
    if (projectId)
      await this.ensureProjectAccess({ userId: data.userId, projectId });

    return this.prisma.messageTemplate.create({
      data: {
        userId: data.userId,
        name,
        content,
        ...(projectId ? { projectId } : {}),
      },
    });
  }

  async update(data: {
    id: string;
    userId: string;
    projectId?: string;
    name?: string;
    content?: string;
  }) {
    const projectId = data.projectId?.trim()
      ? data.projectId.trim()
      : undefined;
    if (projectId)
      await this.ensureProjectAccess({ userId: data.userId, projectId });

    const existing = await this.prisma.messageTemplate.findFirst({
      where: {
        id: data.id,
        userId: data.userId,
        ...(projectId ? { projectId } : { projectId: null }),
      },
      select: { id: true },
    });
    if (!existing) throw new Error('Not found');

    const updates: { name?: string; content?: string } = {};
    if (typeof data.name === 'string' && data.name.trim())
      updates.name = data.name.trim();
    if (typeof data.content === 'string' && data.content.trim())
      updates.content = data.content.trim();
    if (Object.keys(updates).length === 0) return { updated: false };

    await this.prisma.messageTemplate.update({
      where: { id: data.id },
      data: updates,
    });
    return { updated: true };
  }

  async remove(params: { id: string; userId: string; projectId?: string }) {
    const projectId = params.projectId?.trim()
      ? params.projectId.trim()
      : undefined;
    if (projectId)
      await this.ensureProjectAccess({ userId: params.userId, projectId });

    const existing = await this.prisma.messageTemplate.findFirst({
      where: {
        id: params.id,
        userId: params.userId,
        ...(projectId ? { projectId } : { projectId: null }),
      },
      select: { id: true },
    });
    if (!existing) return { deleted: false };

    await this.prisma.messageTemplate.delete({ where: { id: params.id } });
    return { deleted: true };
  }
}
