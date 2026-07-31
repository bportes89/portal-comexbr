import Redis from 'ioredis';
import { setMessageQueueEnabled } from './message-queue.state';

function parseRedisMajorVersion(info: string) {
  const match = /redis_version:(\d+)/.exec(info);
  return match ? Number(match[1]) : 0;
}

function buildRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    return new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });
  }

  const host = process.env.REDIS_HOST ?? '127.0.0.1';
  const port = Number(process.env.REDIS_PORT ?? 6379);

  return new Redis({
    host,
    port: Number.isNaN(port) ? 6379 : port,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    lazyConnect: true,
  });
}

export async function configureMessageQueueFromRedis() {
  if (process.env.MESSAGE_QUEUE_ENABLED === 'false') {
    setMessageQueueEnabled(false);
    console.warn(
      '[queue] MESSAGE_QUEUE_ENABLED=false — envio direto ativado (sem BullMQ).',
    );
    return false;
  }

  if (process.env.MESSAGE_QUEUE_ENABLED === 'true') {
    setMessageQueueEnabled(true);
    return true;
  }

  const client = buildRedisClient();
  try {
    await client.connect();
    const info = await client.info('server');
    const major = parseRedisMajorVersion(info);
    if (major < 5) {
      setMessageQueueEnabled(false);
      console.warn(
        `[queue] Redis ${major}.x incompatível com BullMQ (requer 5+). Envio direto ativado.`,
      );
      console.warn(
        '[queue] Instale Memurai Developer ou Redis 5+ para usar fila. Veja scripts/install-memurai-redis.ps1',
      );
      return false;
    }

    setMessageQueueEnabled(true);
    return true;
  } catch (error) {
    setMessageQueueEnabled(false);
    console.warn(
      `[queue] Redis indisponível (${String(error)}). Envio direto ativado.`,
    );
    return false;
  } finally {
    client.disconnect();
  }
}
