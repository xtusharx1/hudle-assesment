import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule, configure } from "./app";
import { db } from "./database/source";
async function main() {
  await db.initialize();
  const app = await NestFactory.create(AppModule);
  configure(app);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3001), "0.0.0.0");
  console.log("Hudle API ready at http://localhost:3001/api");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
