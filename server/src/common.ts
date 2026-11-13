import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "crypto";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const equal = (a: string, b: string) =>
  timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
@Catch()
export class Errors implements ExceptionFilter {
  catch(e: any, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status = e instanceof HttpException ? e.getStatus() : 500;
    const payload = e instanceof HttpException ? e.getResponse() : undefined;
    const message =
      typeof payload === "object" ? (payload as any).message : payload;
    if (status === 500) console.error(e);
    response.status(status).json({
      error: {
        code:
          (
            {
              400: "VALIDATION_ERROR",
              401: "UNAUTHORIZED",
              403: "FORBIDDEN",
              404: "NOT_FOUND",
              409: "CONFLICT",
              429: "RATE_LIMITED",
            } as any
          )[status] || "INTERNAL_ERROR",
        message: message || "An unexpected error occurred",
      },
    });
  }
}
