import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureMessageQueueFromRedis } from './queue/probe-redis-queue';

async function bootstrap() {
  await configureMessageQueueFromRedis();
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Enable CORS for frontend integration
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
