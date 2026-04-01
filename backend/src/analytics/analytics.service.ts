import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeRange(params: { from?: Date; to?: Date }) {
    const to = params.to ?? new Date();
    const from =
      params.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  async getOverview(params: {
    userId: string;
    projectId?: string;
    from?: Date;
    to?: Date;
  }) {
    const { from, to } = this.normalizeRange(params);

    const contactWhere: Record<string, unknown> = {
      userId: params.userId,
      ...(params.projectId ? { projectId: params.projectId } : {}),
    };

    const [contacts, groups, campaigns, sessionsConnected, events, messages] =
      await Promise.all([
        this.prisma.contact.count({ where: contactWhere }),
        this.prisma.group.count({
          where: {
            userId: params.userId,
            ...(params.projectId ? { projectId: params.projectId } : {}),
          },
        }),
        this.prisma.campaign.count({
          where: {
            userId: params.userId,
            ...(params.projectId ? { projectId: params.projectId } : {}),
          },
        }),
        this.prisma.whatsappSession.count({
          where: {
            userId: params.userId,
            status: 'CONNECTED',
            ...(params.projectId ? { projectId: params.projectId } : {}),
          },
        }),
        this.prisma.event.count({
          where: {
            userId: params.userId,
            createdAt: { gte: from, lte: to },
            ...(params.projectId ? { projectId: params.projectId } : {}),
          },
        }),
        this.prisma.message.groupBy({
          by: ['status'],
          where: {
            createdAt: { gte: from, lte: to },
            contact: contactWhere as never,
          },
          _count: { _all: true },
        }),
      ]);

    const byStatus: Record<string, number> = {};
    for (const row of messages) {
      byStatus[row.status] = row._count._all;
    }

    const sent = byStatus.SENT ?? 0;
    const delivered = byStatus.DELIVERED ?? 0;
    const read = byStatus.READ ?? 0;
    const failed = byStatus.FAILED ?? 0;
    const pending = byStatus.PENDING ?? 0;
    const total = sent + delivered + read + failed + pending;

    const activeCampaigns = await this.prisma.campaign.count({
      where: {
        userId: params.userId,
        status: 'PROCESSING',
        ...(params.projectId ? { projectId: params.projectId } : {}),
      },
    });

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        contacts,
        groups,
        campaigns,
        activeCampaigns,
        connectedNumbers: sessionsConnected,
        events,
        messages: {
          total,
          pending,
          sent,
          delivered,
          read,
          failed,
        },
      },
    };
  }

  async getMessageBreakdown(params: {
    userId: string;
    projectId?: string;
    instanceName?: string;
    campaignId?: string;
    from?: Date;
    to?: Date;
  }) {
    const { from, to } = this.normalizeRange(params);

    const contactWhere: Record<string, unknown> = {
      userId: params.userId,
      ...(params.projectId ? { projectId: params.projectId } : {}),
    };

    const rows = await this.prisma.message.groupBy({
      by: ['status', 'instanceName', 'campaignId'],
      where: {
        createdAt: { gte: from, lte: to },
        contact: contactWhere as never,
        ...(params.instanceName ? { instanceName: params.instanceName } : {}),
        ...(params.campaignId ? { campaignId: params.campaignId } : {}),
      },
      _count: { _all: true },
    });

    const totalsByStatus: Record<string, number> = {};
    const byInstance: Record<string, Record<string, number>> = {};
    const byCampaignId: Record<string, Record<string, number>> = {};

    for (const r of rows) {
      const status = r.status;
      const count = r._count._all;

      totalsByStatus[status] = (totalsByStatus[status] ?? 0) + count;

      const instanceKey = r.instanceName ?? 'unknown';
      byInstance[instanceKey] ??= {};
      byInstance[instanceKey][status] =
        (byInstance[instanceKey][status] ?? 0) + count;

      if (r.campaignId) {
        byCampaignId[r.campaignId] ??= {};
        byCampaignId[r.campaignId][status] =
          (byCampaignId[r.campaignId][status] ?? 0) + count;
      }
    }

    const campaignIds = Object.keys(byCampaignId);
    const campaigns = campaignIds.length
      ? await this.prisma.campaign.findMany({
          where: {
            id: { in: campaignIds },
            userId: params.userId,
            ...(params.projectId ? { projectId: params.projectId } : {}),
          },
          select: { id: true, name: true, instanceName: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const byCampaign = campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      instanceName: c.instanceName ?? undefined,
      counts: byCampaignId[c.id] ?? {},
    }));

    const pending = totalsByStatus.PENDING ?? 0;
    const sent = totalsByStatus.SENT ?? 0;
    const delivered = totalsByStatus.DELIVERED ?? 0;
    const read = totalsByStatus.READ ?? 0;
    const failed = totalsByStatus.FAILED ?? 0;
    const total = pending + sent + delivered + read + failed;
    const totalNonPending = sent + delivered + read + failed;

    const deliveryRate =
      totalNonPending > 0 ? (delivered + read) / totalNonPending : 0;
    const readRate = delivered + read > 0 ? read / (delivered + read) : 0;
    const failureRate = totalNonPending > 0 ? failed / totalNonPending : 0;

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      totalsByStatus,
      byInstance,
      byCampaign,
      derived: {
        total,
        totalNonPending,
        deliveryRate,
        readRate,
        failureRate,
      },
    };
  }

  async getFailures(params: {
    userId: string;
    projectId?: string;
    instanceName?: string;
    campaignId?: string;
    take: number;
    from?: Date;
    to?: Date;
  }) {
    const { from, to } = this.normalizeRange(params);

    const items = await this.prisma.message.findMany({
      where: {
        status: 'FAILED',
        createdAt: { gte: from, lte: to },
        ...(params.instanceName ? { instanceName: params.instanceName } : {}),
        ...(params.campaignId ? { campaignId: params.campaignId } : {}),
        contact: {
          userId: params.userId,
          ...(params.projectId ? { projectId: params.projectId } : {}),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(params.take, 1), 200),
      select: {
        id: true,
        status: true,
        instanceName: true,
        createdAt: true,
        campaignId: true,
        campaign: { select: { name: true } },
        contactId: true,
        contact: { select: { name: true, phone: true } },
      },
    });

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      items: items.map((m) => ({
        id: m.id,
        status: m.status,
        instanceName: m.instanceName ?? undefined,
        createdAt: m.createdAt.toISOString(),
        campaignId: m.campaignId ?? undefined,
        campaignName: m.campaign?.name ?? undefined,
        contactId: m.contactId,
        contactName: m.contact?.name ?? undefined,
        contactPhone: m.contact?.phone ?? undefined,
      })),
    };
  }

  async getGroupBreakdown(params: {
    userId: string;
    projectId?: string;
    instanceName?: string;
    from?: Date;
    to?: Date;
  }) {
    const { from, to } = this.normalizeRange(params);

    const contactWhere: Record<string, unknown> = {
      userId: params.userId,
      tags: { has: 'system:group' },
      ...(params.projectId ? { projectId: params.projectId } : {}),
    };

    const messageRows = await this.prisma.message.groupBy({
      by: ['status', 'contactId', 'instanceName'],
      where: {
        createdAt: { gte: from, lte: to },
        ...(params.instanceName ? { instanceName: params.instanceName } : {}),
        contact: contactWhere as never,
      },
      _count: { _all: true },
    });

    const contactIds = Array.from(
      new Set(messageRows.map((r) => r.contactId).filter(Boolean)),
    );

    const contacts = contactIds.length
      ? await this.prisma.contact.findMany({
          where: {
            id: { in: contactIds },
            userId: params.userId,
            tags: { has: 'system:group' },
            ...(params.projectId ? { projectId: params.projectId } : {}),
          },
          select: { id: true, name: true, phone: true, projectId: true },
        })
      : [];

    const groups = contacts.length
      ? await this.prisma.group.findMany({
          where: {
            whatsappId: { in: contacts.map((c) => c.phone) },
            userId: params.userId,
            ...(params.projectId ? { projectId: params.projectId } : {}),
          },
          select: { id: true, name: true, whatsappId: true },
        })
      : [];

    const groupByPhone = new Map(groups.map((g) => [g.whatsappId, g]));

    const countsByContactId: Record<string, Record<string, number>> = {};
    for (const r of messageRows) {
      const key = r.contactId;
      countsByContactId[key] ??= {};
      countsByContactId[key][r.status] =
        (countsByContactId[key][r.status] ?? 0) + r._count._all;
    }

    const eventWhere: Record<string, unknown> = {
      type: 'WHATSAPP_INBOUND',
      createdAt: { gte: from, lte: to },
      userId: params.userId,
      ...(params.projectId ? { projectId: params.projectId } : {}),
      ...(params.instanceName
        ? { metadata: { path: ['instanceName'], equals: params.instanceName } }
        : {}),
      contact: contactWhere as never,
      contactId: { in: contactIds },
    };

    const eventRows =
      contactIds.length > 0
        ? await this.prisma.event.groupBy({
            by: ['contactId'],
            where: eventWhere as never,
            _count: { _all: true },
          })
        : [];

    const responsesByContactId = new Map<string, number>();
    for (const r of eventRows) {
      if (!r.contactId) continue;
      responsesByContactId.set(r.contactId, r._count._all);
    }

    const items = contacts.map((c) => {
      const group = groupByPhone.get(c.phone);
      const counts = countsByContactId[c.id] ?? {};
      const responses = responsesByContactId.get(c.id) ?? 0;
      const totalSent =
        (counts.SENT ?? 0) +
        (counts.DELIVERED ?? 0) +
        (counts.READ ?? 0) +
        (counts.FAILED ?? 0) +
        (counts.PENDING ?? 0);

      return {
        groupId: group?.id ?? null,
        name: group?.name ?? c.name,
        whatsappId: group?.whatsappId ?? c.phone,
        countsByStatus: counts,
        responses,
        total: totalSent,
      };
    });

    items.sort((a, b) => b.total - a.total);

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      items,
    };
  }
}
