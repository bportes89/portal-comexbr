import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { randomUUID } from 'crypto';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Injectable()
export class GroupsService {
  private static demoGroupsByUser = new Map<string, GroupRecord[]>();

  constructor(
    private prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

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
      select: { id: true },
    });
    if (!project) throw new Error('Forbidden');
    return project;
  }

  async createForUser(data: {
    name: string;
    whatsappId: string;
    userId: string;
    projectId?: string;
  }) {
    try {
      await this.ensureUser(data.userId);
      if (data.projectId) {
        await this.ensureProjectAccess({
          userId: data.userId,
          projectId: data.projectId,
        });
      }
      return await this.prisma.group.create({
        data: {
          name: data.name,
          whatsappId: data.whatsappId,
          userId: data.userId,
          ...(data.projectId ? { projectId: data.projectId } : {}),
        },
      });
    } catch {
      return this.createInMemory(data);
    }
  }

  async findAll(params?: { userId?: string; projectId?: string }) {
    try {
      const userId = params?.userId;
      const projectId = params?.projectId;
      if (projectId && userId) {
        await this.ensureProjectAccess({ userId, projectId });
        return await this.prisma.group.findMany({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
        });
      }
      if (userId)
        return await this.prisma.group.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });
      return await this.prisma.group.findMany();
    } catch {
      const userId = params?.userId;
      const projectId = params?.projectId;
      if (userId) {
        const all = GroupsService.demoGroupsByUser.get(userId) ?? [];
        if (projectId) return all.filter((g) => g.projectId === projectId);
        return all;
      }
      return Array.from(GroupsService.demoGroupsByUser.values()).flat();
    }
  }

  async findOne(id: string) {
    try {
      return await this.prisma.group.findUnique({ where: { id } });
    } catch {
      for (const groups of GroupsService.demoGroupsByUser.values()) {
        const found = groups.find((g) => g.id === id);
        if (found) return found;
      }
      return null;
    }
  }

  async ensureGroupAccess(params: {
    groupId: string;
    userId: string;
    projectId?: string;
  }) {
    const group = await this.findOne(params.groupId);
    if (!group) throw new Error('Group not found');

    const projectId =
      params.projectId && params.projectId.length > 0
        ? params.projectId
        : undefined;

    if (projectId) {
      if (group.projectId !== projectId) throw new Error('Forbidden');
      await this.ensureProjectAccess({ userId: params.userId, projectId });
      return group;
    }

    if (group.projectId) {
      await this.ensureProjectAccess({
        userId: params.userId,
        projectId: group.projectId,
      });
      return group;
    }

    if (group.userId !== params.userId) throw new Error('Forbidden');
    return group;
  }

  async queueMessageToGroup(data: {
    groupId: string;
    instanceName: string;
    text: string;
    delay?: number;
    userId?: string;
    projectId?: string;
  }) {
    const group = await this.findOne(data.groupId);
    if (!group) throw new Error('Group not found');

    const session = await this.prisma.whatsappSession.findFirst({
      where: { name: data.instanceName },
      select: { userId: true, projectId: true },
    });
    if (!session) throw new Error('Instance not found');

    const effectiveProjectId =
      group.projectId ?? session.projectId ?? data.projectId;
    if (
      effectiveProjectId &&
      session.projectId &&
      session.projectId !== effectiveProjectId
    ) {
      throw new Error('Instance does not belong to project');
    }

    await this.ensureUser(session.userId);
    const existingContact = await this.prisma.contact.findFirst({
      where: {
        userId: session.userId,
        phone: group.whatsappId,
        tags: { has: 'system:group' },
        ...(effectiveProjectId ? { projectId: effectiveProjectId } : {}),
      },
    });
    const contact =
      existingContact ??
      (await this.prisma.contact.create({
        data: {
          name: group.name,
          phone: group.whatsappId,
          tags: ['system:group'],
          userId: session.userId,
          ...(effectiveProjectId ? { projectId: effectiveProjectId } : {}),
        },
      }));

    const message = await this.prisma.message.create({
      data: {
        content: data.text,
        status: 'PENDING',
        instanceName: data.instanceName,
        contactId: contact.id,
      },
      select: { id: true },
    });

    await this.whatsappService.queueMessage(
      data.instanceName,
      group.whatsappId,
      data.text,
      data.delay ?? 0,
      message.id,
    );
    return { status: 'queued' };
  }

  async queueMediaToGroup(data: {
    groupId: string;
    instanceName: string;
    mediaType: string;
    mimeType: string;
    media: string;
    fileName: string;
    caption?: string;
    delay?: number;
    userId?: string;
    projectId?: string;
  }) {
    const group = await this.findOne(data.groupId);
    if (!group) throw new Error('Group not found');

    const session = await this.prisma.whatsappSession.findFirst({
      where: { name: data.instanceName },
      select: { userId: true, projectId: true },
    });
    if (!session) throw new Error('Instance not found');

    const effectiveProjectId =
      group.projectId ?? session.projectId ?? data.projectId;
    if (
      effectiveProjectId &&
      session.projectId &&
      session.projectId !== effectiveProjectId
    ) {
      throw new Error('Instance does not belong to project');
    }

    await this.ensureUser(session.userId);
    const existingContact = await this.prisma.contact.findFirst({
      where: {
        userId: session.userId,
        phone: group.whatsappId,
        tags: { has: 'system:group' },
        ...(effectiveProjectId ? { projectId: effectiveProjectId } : {}),
      },
    });
    const contact =
      existingContact ??
      (await this.prisma.contact.create({
        data: {
          name: group.name,
          phone: group.whatsappId,
          tags: ['system:group'],
          userId: session.userId,
          ...(effectiveProjectId ? { projectId: effectiveProjectId } : {}),
        },
      }));

    const content =
      (data.caption && data.caption.trim().length > 0
        ? data.caption
        : data.fileName) || data.fileName;

    const message = await this.prisma.message.create({
      data: {
        content,
        status: 'PENDING',
        instanceName: data.instanceName,
        contactId: contact.id,
      },
      select: { id: true },
    });

    await this.whatsappService.queueMedia(
      data.instanceName,
      group.whatsappId,
      {
        mediaType: data.mediaType,
        mimeType: data.mimeType,
        media: data.media,
        fileName: data.fileName,
        caption: data.caption,
      },
      data.delay ?? 0,
      message.id,
    );
    return { status: 'queued' };
  }
  async queueSequenceToGroup(data: {
    groupId: string;
    instanceName: string;
    steps: Array<{ text: string; delayMs?: number }>;
    userId?: string;
    projectId?: string;
  }) {
    const group = await this.findOne(data.groupId);
    if (!group) throw new Error('Group not found');

    const session = await this.prisma.whatsappSession.findFirst({
      where: { name: data.instanceName },
      select: { userId: true, projectId: true },
    });
    if (!session) throw new Error('Instance not found');

    const effectiveProjectId =
      group.projectId ?? session.projectId ?? data.projectId;
    if (
      effectiveProjectId &&
      session.projectId &&
      session.projectId !== effectiveProjectId
    ) {
      throw new Error('Instance does not belong to project');
    }

    await this.ensureUser(session.userId);
    const contact =
      (await this.prisma.contact.findFirst({
        where: {
          userId: session.userId,
          phone: group.whatsappId,
          tags: { has: 'system:group' },
          ...(effectiveProjectId ? { projectId: effectiveProjectId } : {}),
        },
      })) ??
      (await this.prisma.contact.create({
        data: {
          name: group.name,
          phone: group.whatsappId,
          tags: ['system:group'],
          userId: session.userId,
          ...(effectiveProjectId ? { projectId: effectiveProjectId } : {}),
        },
      }));

    let cumulativeDelay = 0;
    for (const step of data.steps) {
      const stepDelay = typeof step.delayMs === 'number' ? step.delayMs : 0;
      cumulativeDelay += stepDelay;

      const message = await this.prisma.message.create({
        data: {
          content: step.text,
          status: 'PENDING',
          instanceName: data.instanceName,
          contactId: contact.id,
        },
        select: { id: true },
      });

      await this.whatsappService.queueMessage(
        data.instanceName,
        group.whatsappId,
        step.text,
        cumulativeDelay,
        message.id,
      );
    }

    return { status: 'queued', steps: data.steps.length };
  }

  private extractGroupJid(payload: unknown) {
    if (typeof payload === 'string' && payload.includes('@g.us'))
      return payload;
    if (!isRecord(payload)) return undefined;

    const id = typeof payload.id === 'string' ? payload.id : undefined;
    if (id && id.includes('@g.us')) return id;

    const groupJid =
      typeof payload.groupJid === 'string' ? payload.groupJid : undefined;
    if (groupJid && groupJid.includes('@g.us')) return groupJid;

    const remoteJid =
      typeof payload.remoteJid === 'string' ? payload.remoteJid : undefined;
    if (remoteJid && remoteJid.includes('@g.us')) return remoteJid;

    if (isRecord(payload.group)) {
      const nested = payload.group;
      const nestedId = typeof nested.id === 'string' ? nested.id : undefined;
      if (nestedId && nestedId.includes('@g.us')) return nestedId;
      const nestedJid =
        typeof nested.groupJid === 'string' ? nested.groupJid : undefined;
      if (nestedJid && nestedJid.includes('@g.us')) return nestedJid;
    }

    return undefined;
  }

  async createOnWhatsapp(data: {
    userId: string;
    projectId?: string;
    instanceName: string;
    name: string;
    participants: string[];
  }) {
    await this.ensureUser(data.userId);
    if (data.projectId) {
      await this.ensureProjectAccess({
        userId: data.userId,
        projectId: data.projectId,
      });
    }

    const subject = data.name.trim();
    if (!subject) throw new Error('Invalid subject');

    const participants = data.participants
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (participants.length === 0) throw new Error('Invalid participants');

    const res = await this.whatsappService.createGroup({
      instanceName: data.instanceName,
      subject,
      participants,
    });
    const groupJid = this.extractGroupJid(res);
    if (!groupJid) throw new Error('Could not determine groupJid');

    try {
      return await this.prisma.group.create({
        data: {
          name: subject,
          whatsappId: groupJid,
          userId: data.userId,
          ...(data.projectId ? { projectId: data.projectId } : {}),
        },
      });
    } catch {
      return this.createInMemory({
        name: subject,
        whatsappId: groupJid,
        userId: data.userId,
        projectId: data.projectId,
      });
    }
  }

  async getInviteCode(data: {
    groupId: string;
    userId: string;
    projectId?: string;
    instanceName: string;
  }) {
    const group = await this.ensureGroupAccess({
      groupId: data.groupId,
      userId: data.userId,
      projectId: data.projectId,
    });

    return await this.whatsappService.fetchInviteCode({
      instanceName: data.instanceName,
      groupJid: group.whatsappId,
    });
  }

  async sendInvite(data: {
    groupId: string;
    userId: string;
    projectId?: string;
    instanceName: string;
    numbers: string[];
    description?: string;
  }) {
    const group = await this.ensureGroupAccess({
      groupId: data.groupId,
      userId: data.userId,
      projectId: data.projectId,
    });

    const numbers = data.numbers
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (numbers.length === 0) throw new Error('Invalid numbers');

    return await this.whatsappService.sendGroupInvite({
      instanceName: data.instanceName,
      groupJid: group.whatsappId,
      numbers,
      description: data.description,
    });
  }
  async updateParticipants(data: {
    groupId: string;
    userId: string;
    projectId?: string;
    instanceName: string;
    action: 'add' | 'remove';
    participants: string[];
  }) {
    const group = await this.ensureGroupAccess({
      groupId: data.groupId,
      userId: data.userId,
      projectId: data.projectId,
    });

    const participants = data.participants
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (participants.length === 0) throw new Error('Invalid participants');

    return await this.whatsappService.updateGroupParticipants({
      instanceName: data.instanceName,
      groupJid: group.whatsappId,
      action: data.action,
      participants,
    });
  }

  async fetchWhatsappMetadata(data: {
    groupId: string;
    userId: string;
    projectId?: string;
    instanceName: string;
  }) {
    const group = await this.ensureGroupAccess({
      groupId: data.groupId,
      userId: data.userId,
      projectId: data.projectId,
    });

    return await this.whatsappService.fetchGroupInfos({
      instanceName: data.instanceName,
      groupJid: group.whatsappId,
    });
  }

  async updateWhatsappMetadata(data: {
    groupId: string;
    userId: string;
    projectId?: string;
    instanceName: string;
    subject?: string;
    description?: string;
  }) {
    const group = await this.ensureGroupAccess({
      groupId: data.groupId,
      userId: data.userId,
      projectId: data.projectId,
    });

    const updates: Record<string, unknown> = {};

    if (typeof data.subject === 'string' && data.subject.trim().length > 0) {
      const subject = data.subject.trim();
      await this.whatsappService.updateGroupSubject({
        instanceName: data.instanceName,
        groupJid: group.whatsappId,
        subject,
      });
      updates.name = subject;
    }

    if (
      typeof data.description === 'string' &&
      data.description.trim().length > 0
    ) {
      await this.whatsappService.updateGroupDescription({
        instanceName: data.instanceName,
        groupJid: group.whatsappId,
        description: data.description.trim(),
      });
    }

    if (Object.keys(updates).length > 0) {
      await this.update(data.groupId, updates as { name?: string });
    }

    return await this.whatsappService.fetchGroupInfos({
      instanceName: data.instanceName,
      groupJid: group.whatsappId,
    });
  }

  async importFromInstance(data: {
    userId: string;
    instanceName: string;
    projectId?: string;
  }) {
    const { userId, instanceName } = data;
    try {
      await this.ensureUser(userId);
      const projectId =
        data.projectId && data.projectId.length > 0
          ? data.projectId
          : undefined;
      if (projectId) {
        await this.ensureProjectAccess({ userId, projectId });
      }
      const evolutionGroups =
        await this.whatsappService.fetchAllGroups(instanceName);

      const existing = await this.prisma.group.findMany({
        where: projectId ? { projectId } : { userId },
        select: { whatsappId: true },
      });
      const existingSet = new Set(existing.map((g) => g.whatsappId));

      const toCreate = evolutionGroups
        .filter((g) => typeof g.id === 'string' && g.id.length > 0)
        .filter((g) => !existingSet.has(g.id))
        .map((g) => ({
          userId,
          whatsappId: g.id,
          name: g.subject && g.subject.length > 0 ? g.subject : g.id,
          projectId,
        }));

      if (toCreate.length > 0) {
        await this.prisma.group.createMany({ data: toCreate });
      }

      return {
        imported: toCreate.length,
        total: evolutionGroups.length,
      };
    } catch {
      const evolutionGroups =
        await this.whatsappService.fetchAllGroups(instanceName);
      const prev = GroupsService.demoGroupsByUser.get(userId) ?? [];
      const existingSet = new Set(prev.map((g) => g.whatsappId));

      let imported = 0;
      for (const g of evolutionGroups) {
        if (!g?.id) continue;
        if (existingSet.has(g.id)) continue;
        const name =
          g.subject && g.subject.length > 0 ? g.subject : String(g.id);
        this.createInMemory({
          userId,
          whatsappId: g.id,
          name,
          projectId: data.projectId,
        });
        existingSet.add(g.id);
        imported += 1;
      }

      return {
        imported,
        total: evolutionGroups.length,
      };
    }
  }

  async update(id: string, data: { name?: string; whatsappId?: string }) {
    try {
      return await this.prisma.group.update({
        where: { id },
        data,
      });
    } catch {
      for (const [userId, groups] of GroupsService.demoGroupsByUser.entries()) {
        const idx = groups.findIndex((g) => g.id === id);
        if (idx === -1) continue;
        const updated: GroupRecord = {
          ...groups[idx],
          name: data.name ?? groups[idx].name,
          whatsappId: data.whatsappId ?? groups[idx].whatsappId,
          updatedAt: new Date(),
        };
        const next = [...groups];
        next[idx] = updated;
        GroupsService.demoGroupsByUser.set(userId, next);
        return updated;
      }
      throw new Error('Group not found');
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.group.delete({ where: { id } });
    } catch {
      for (const [userId, groups] of GroupsService.demoGroupsByUser.entries()) {
        const idx = groups.findIndex((g) => g.id === id);
        if (idx === -1) continue;
        const removed = groups[idx];
        GroupsService.demoGroupsByUser.set(
          userId,
          groups.filter((g) => g.id !== id),
        );
        return removed;
      }
      throw new Error('Group not found');
    }
  }

  private createInMemory(data: {
    name: string;
    whatsappId: string;
    userId: string;
    projectId?: string;
  }): GroupRecord {
    const group: GroupRecord = {
      id: randomUUID(),
      name: data.name,
      whatsappId: data.whatsappId,
      userId: data.userId,
      projectId: data.projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prev = GroupsService.demoGroupsByUser.get(data.userId) ?? [];
    GroupsService.demoGroupsByUser.set(data.userId, [group, ...prev]);
    return group;
  }
}

type GroupRecord = {
  id: string;
  name: string;
  whatsappId: string;
  userId: string;
  projectId?: string;
  createdAt: Date;
  updatedAt: Date;
};
