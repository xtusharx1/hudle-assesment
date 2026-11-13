import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule, configure } from "./app";
import { db } from "./database/source";
import { extendDemoSlots } from "./database/demo-slots";
import { baseSchedules } from "./database/demo-data";
import { varietySchedules } from "./database/variety";
async function main() {
  await db.initialize();
  const schedules = [...baseSchedules, ...varietySchedules];
  await extendDemoSlots(db, schedules);
  const app = await NestFactory.create(AppModule);
  configure(app);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3001), "0.0.0.0");
  const timer = setInterval(
    () => {
      void extendDemoSlots(db, schedules).catch((error) =>
        console.error("Demo slot extension failed", error),
      );
    },
    60 * 60 * 1000,
  );
  timer.unref();
  app.getHttpServer().on("close", () => clearInterval(timer));
  console.log(`Hudle API ready on port ${process.env.PORT || 3001}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
