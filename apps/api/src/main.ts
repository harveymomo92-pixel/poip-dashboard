import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true
  });
  app.enableShutdownHooks();

  const port = Number.parseInt(process.env.API_PORT ?? "4000", 10);
  await app.listen(port);
}

await bootstrap();
