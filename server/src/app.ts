import { Module, ValidationPipe, INestApplication } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import helmet from "helmet";
import {
  PublicController,
  LoginController,
  AdminController,
} from "./controllers";
import { CatalogService } from "./catalog";
import { BookingsService } from "./bookings";
import { AdminGuard, Errors } from "./common";
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET || !process.env.ADMIN_PASSWORD)
)
  throw new Error("Production requires JWT_SECRET and ADMIN_PASSWORD");
@Module({
  imports: [
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        "local-development-only-change-before-deploying",
      signOptions: { expiresIn: "8h" },
    }),
  ],
  controllers: [PublicController, LoginController, AdminController],
  providers: [CatalogService, BookingsService, AdminGuard],
})
export class AppModule {}
export function configure(app: INestApplication) {
  app.use(helmet());
  app.enableCors({
    origin: process.env.WEB_ORIGIN || "http://localhost:5173",
    allowedHeaders: ["Content-Type", "Authorization", "x-booking-token"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new Errors());
  // Bounded process-local rate limiter. Replace with a shared store when running multiple API replicas.
  const hits = new Map<string, { count: number; until: number }>();
  let lastSweep = 0;
  app.use((req: any, res: any, next: any) => {
    const now = Date.now();
    if (now - lastSweep > 60000) {
      for (const [key, v] of hits) if (v.until < now) hits.delete(key);
      lastSweep = now;
    }
    const key = req.ip + ":" + (req.path.includes("/login") ? "login" : "api");
    const old = hits.get(key);
    const v = old && old.until > now ? old : { count: 0, until: now + 60000 };
    v.count++;
    hits.set(key, v);
    if (v.count > (key.endsWith("login") ? 10 : 300))
      return res
        .status(429)
        .json({
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again in a minute.",
          },
        });
    next();
  });
}
