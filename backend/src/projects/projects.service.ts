import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class ProjectsService {
  private static demoProjectsByUser = new Map<string, ProjectRecord[]>();

  constructor(private readonly prisma: PrismaService) {}

  private async ensureUser(userId: string) {
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@demo.portal-comexbr.local`,
        password: 'demo',
        name: 'Demo User',
      },
    });
  }

  private async logAudit(data: {
    userId: string;
    projectId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          projectId: data.projectId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          metadata: data.metadata
            ? (data.metadata as Prisma.InputJsonValue)
            : undefined,
        },
      });
    } catch {
      return;
    }
  }

  private async ensureProjectAccess(params: {
    userId: string;
    projectId: string;
  }) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: params.projectId,
        OR: [
          { ownerId: params.userId },
          { members: { some: { userId: params.userId } } },
        ],
      },
      select: { id: true, ownerId: true },
    });
    if (!project) throw new Error('Forbidden');
    return project;
  }

  private async ensureProjectOwner(params: {
    userId: string;
    projectId: string;
  }) {
    const project = await this.prisma.project.findFirst({
      where: { id: params.projectId, ownerId: params.userId },
      select: { id: true, ownerId: true },
    });
    if (!project) throw new Error('Forbidden');
    return project;
  }

  async createForUser(data: { name: string; userId: string }) {
    try {
      await this.ensureUser(data.userId);
      const project = await this.prisma.project.create({
        data: {
          name: data.name,
          ownerId: data.userId,
          members: {
            create: {
              userId: data.userId,
              role: 'OWNER',
            },
          },
        },
      });
      await this.logAudit({
        userId: data.userId,
        projectId: project.id,
        action: 'project.create',
        entityType: 'Project',
        entityId: project.id,
        metadata: { name: data.name },
      });
      return project;
    } catch {
      return this.createInMemory(data);
    }
  }

  async findAll(userId?: string) {
    try {
      if (userId) {
        return await this.prisma.project.findMany({
          where: {
            OR: [{ ownerId: userId }, { members: { some: { userId } } }],
          },
          orderBy: { createdAt: 'desc' },
        });
      }
      return await this.prisma.project.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      if (userId) return ProjectsService.demoProjectsByUser.get(userId) ?? [];
      return Array.from(ProjectsService.demoProjectsByUser.values()).flat();
    }
  }

  async update(id: string, data: { name?: string }) {
    try {
      return await this.prisma.project.update({
        where: { id },
        data,
      });
    } catch {
      for (const [
        userId,
        projects,
      ] of ProjectsService.demoProjectsByUser.entries()) {
        const idx = projects.findIndex((p) => p.id === id);
        if (idx === -1) continue;
        const updated: ProjectRecord = {
          ...projects[idx],
          name: data.name ?? projects[idx].name,
          updatedAt: new Date(),
        };
        const next = [...projects];
        next[idx] = updated;
        ProjectsService.demoProjectsByUser.set(userId, next);
        return updated;
      }
      throw new Error('Project not found');
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.project.delete({ where: { id } });
    } catch {
      for (const [
        userId,
        projects,
      ] of ProjectsService.demoProjectsByUser.entries()) {
        const idx = projects.findIndex((p) => p.id === id);
        if (idx === -1) continue;
        const removed = projects[idx];
        ProjectsService.demoProjectsByUser.set(
          userId,
          projects.filter((p) => p.id !== id),
        );
        return removed;
      }
      throw new Error('Project not found');
    }
  }

  async removeForUser(params: { id: string; userId: string }) {
    await this.ensureProjectOwner({
      userId: params.userId,
      projectId: params.id,
    });
    const removed = await this.prisma.project.delete({
      where: { id: params.id },
    });
    await this.logAudit({
      userId: params.userId,
      projectId: params.id,
      action: 'project.delete',
      entityType: 'Project',
      entityId: params.id,
    });
    return removed;
  }

  async listMembers(params: { projectId: string; userId: string }) {
    await this.ensureProjectAccess({
      userId: params.userId,
      projectId: params.projectId,
    });
    const members = await this.prisma.projectMember.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    return members.map((m) => ({
      id: m.id,
      role: m.role,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
    }));
  }

  async addMember(params: {
    projectId: string;
    userId: string;
    email: string;
    role?: string;
  }) {
    await this.ensureProjectOwner({
      userId: params.userId,
      projectId: params.projectId,
    });

    const email = params.email.trim().toLowerCase();
    if (!email) throw new Error('Invalid email');

    const user =
      (await this.prisma.user.findFirst({ where: { email } })) ??
      (await this.prisma.user.create({
        data: {
          id: randomUUID(),
          email,
          password: 'invited',
          name: email.split('@')[0] ?? null,
        },
      }));

    const role = params.role && params.role.length > 0 ? params.role : 'MEMBER';

    const member = await this.prisma.projectMember.upsert({
      where: {
        userId_projectId: { userId: user.id, projectId: params.projectId },
      },
      update: { role },
      create: { userId: user.id, projectId: params.projectId, role },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    await this.logAudit({
      userId: params.userId,
      projectId: params.projectId,
      action: 'project.member.upsert',
      entityType: 'ProjectMember',
      entityId: member.id,
      metadata: { memberUserId: user.id, email, role: member.role },
    });

    return {
      id: member.id,
      role: member.role,
      userId: member.user.id,
      email: member.user.email,
      name: member.user.name,
    };
  }

  async updateMemberRole(params: {
    projectId: string;
    userId: string;
    memberId: string;
    role: string;
  }) {
    const project = await this.ensureProjectOwner({
      userId: params.userId,
      projectId: params.projectId,
    });

    const found = await this.prisma.projectMember.findFirst({
      where: { id: params.memberId, projectId: params.projectId },
      select: { id: true, userId: true },
    });
    if (!found) return { id: params.memberId, updated: false };
    if (found.userId === project.ownerId)
      return { id: params.memberId, updated: false };

    const role = params.role && params.role.length > 0 ? params.role : 'MEMBER';
    const updated = await this.prisma.projectMember.update({
      where: { id: params.memberId },
      data: { role },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    await this.logAudit({
      userId: params.userId,
      projectId: params.projectId,
      action: 'project.member.role.update',
      entityType: 'ProjectMember',
      entityId: params.memberId,
      metadata: { role },
    });

    return {
      id: updated.id,
      role: updated.role,
      userId: updated.user.id,
      email: updated.user.email,
      name: updated.user.name,
    };
  }

  async removeMember(params: {
    projectId: string;
    userId: string;
    memberId: string;
  }) {
    const project = await this.ensureProjectOwner({
      userId: params.userId,
      projectId: params.projectId,
    });

    const found = await this.prisma.projectMember.findFirst({
      where: { id: params.memberId, projectId: params.projectId },
      select: { id: true, userId: true },
    });
    if (!found) return { id: params.memberId, deleted: false };
    if (found.userId === project.ownerId)
      return { id: params.memberId, deleted: false };

    await this.prisma.projectMember.delete({ where: { id: params.memberId } });

    await this.logAudit({
      userId: params.userId,
      projectId: params.projectId,
      action: 'project.member.delete',
      entityType: 'ProjectMember',
      entityId: params.memberId,
      metadata: { memberUserId: found.userId },
    });

    return { id: params.memberId, deleted: true };
  }

  private createInMemory(data: {
    name: string;
    userId: string;
  }): ProjectRecord {
    const project: ProjectRecord = {
      id: randomUUID(),
      name: data.name,
      ownerId: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prev = ProjectsService.demoProjectsByUser.get(data.userId) ?? [];
    ProjectsService.demoProjectsByUser.set(data.userId, [project, ...prev]);
    return project;
  }
}

type ProjectRecord = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};
