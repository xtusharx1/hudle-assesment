import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ConflictException,
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  randomBytes,
  randomUUID,
  scrypt as derive,
  timingSafeEqual,
} from "crypto";
import { Request, Response } from "express";
import { db } from "./database/source";
import { hash } from "./common";
import { RegisterDto, UserLoginDto } from "./dtos";
export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
}
export type UserRequest = Request & { user: User };
const profile = (u: any): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
});
const cookie = (req: Request, name: string) => {
  const value = req.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(name + "="));
  try {
    return value ? decodeURIComponent(value.slice(name.length + 1)) : "";
  } catch {
    return "";
  }
};
const passwordKey = (password: string, salt: string): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    derive(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
const cookieOptions = (path: string) => ({
  httpOnly: true,
  secure:
    process.env.COOKIE_SECURE === "true" ||
    (process.env.COOKIE_SECURE !== "false" &&
      process.env.NODE_ENV === "production"),
  sameSite: "strict" as const,
  path,
});
@Injectable()
export class AuthService {
  constructor(private jwt: JwtService) {}
  async register(b: RegisterDto, res: Response) {
    const salt = randomBytes(16).toString("hex");
    const encoded = `scrypt$${salt}$${(await passwordKey(b.password, salt)).toString("hex")}`;
    let id: number;
    try {
      const result = await db.query(
        "INSERT INTO users(name,email,phone,password_hash) VALUES(?,?,?,?)",
        [b.name.trim(), b.email.toLowerCase(), b.phone, encoded],
      );
      id = result.insertId;
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY")
        throw new ConflictException(
          "An account with this email already exists. Please sign in.",
        );
      throw e;
    }
    const user = {
      id,
      name: b.name.trim(),
      email: b.email.toLowerCase(),
      phone: b.phone,
    };
    await this.session(user, res);
    return user;
  }
  async login(b: UserLoginDto, res: Response) {
    const [u] = await db.query("SELECT * FROM users WHERE email=?", [
      b.email.toLowerCase(),
    ]);
    const [, salt, encoded] = (
      u?.password_hash || `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`
    ).split("$");
    const key = await passwordKey(b.password, salt);
    if (!u || !timingSafeEqual(key, Buffer.from(encoded, "hex")))
      throw new UnauthorizedException("Incorrect email or password");
    await this.session(profile(u), res);
    return profile(u);
  }
  private async session(user: User, res: Response) {
    const id = randomUUID(),
      token = randomBytes(32).toString("base64url");
    await db.query(
      "INSERT INTO auth_sessions(id,user_id,refresh_hash,expires_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 DAY))",
      [id, user.id, hash(token)],
    );
    this.issue(user, id, token, res);
  }
  private issue(user: User, id: string, token: string, res: Response) {
    const access = this.jwt.sign(
      { role: "customer", sub: String(user.id), sid: id },
      {
        expiresIn: "15m",
        issuer: "hudle-api",
        audience: "hudle-customer",
        algorithm: "HS256",
      },
    );
    res.cookie("hudle_access", access, {
      ...cookieOptions("/api"),
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("hudle_refresh", token, {
      ...cookieOptions("/api/auth"),
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.setHeader("Cache-Control", "no-store");
  }
  async refresh(req: Request, res: Response) {
    const token = cookie(req, "hudle_refresh");
    if (!token) throw new UnauthorizedException("Please sign in");
    const fresh = randomBytes(32).toString("base64url");
    const result = await db.transaction(async (m) => {
      const [session] = await m.query(
        "SELECT * FROM auth_sessions WHERE refresh_hash=? AND expires_at>UTC_TIMESTAMP() FOR UPDATE",
        [hash(token)],
      );
      if (!session)
        throw new UnauthorizedException(
          "Your session has expired. Please sign in again.",
        );
      const [u] = await m.query("SELECT * FROM users WHERE id=?", [
        session.user_id,
      ]);
      await m.query("UPDATE auth_sessions SET refresh_hash=? WHERE id=?", [
        hash(fresh),
        session.id,
      ]);
      return { user: profile(u), id: session.id };
    });
    this.issue(result.user, result.id, fresh, res);
    return result.user;
  }
  async logout(req: Request, res: Response) {
    const token = cookie(req, "hudle_refresh");
    if (token)
      await db.query("DELETE FROM auth_sessions WHERE refresh_hash=?", [
        hash(token),
      ]);
    // Revoke by the signed session claim too: refresh cookies can be missing or stale.
    let access: { role?: string; sid?: string; sub?: string } | undefined;
    try {
      access = this.jwt.verify(cookie(req, "hudle_access"), {
        issuer: "hudle-api",
        audience: "hudle-customer",
        algorithms: ["HS256"],
        ignoreExpiration: true,
      });
    } catch {
      /* Logout remains idempotent for invalid cookies. */
    }
    if (access?.role === "customer" && access.sid && access.sub)
      await db.query("DELETE FROM auth_sessions WHERE id=? AND user_id=?", [
        access.sid,
        access.sub,
      ]);
    res.clearCookie("hudle_access", cookieOptions("/api"));
    res.clearCookie("hudle_refresh", cookieOptions("/api/auth"));
    res.setHeader("Cache-Control", "no-store");
    return { success: true };
  }
  async authenticate(req: Request): Promise<User> {
    try {
      const payload = this.jwt.verify(cookie(req, "hudle_access"), {
        issuer: "hudle-api",
        audience: "hudle-customer",
        algorithms: ["HS256"],
      });
      if (
        payload.role !== "customer" ||
        typeof payload.sid !== "string" ||
        !/^\d+$/.test(payload.sub)
      )
        throw new Error();
      const [u] = await db.query(
        "SELECT u.* FROM users u JOIN auth_sessions s ON s.user_id=u.id WHERE s.id=? AND u.id=? AND s.expires_at>UTC_TIMESTAMP()",
        [payload.sid, payload.sub],
      );
      if (!u) throw new Error();
      return profile(u);
    } catch {
      throw new UnauthorizedException("Please sign in to continue");
    }
  }
}
@Injectable()
export class UserGuard implements CanActivate {
  constructor(private auth: AuthService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<UserRequest>();
    req.user = await this.auth.authenticate(req);
    return true;
  }
}
@Controller("api/auth")
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post("register") register(
    @Body() b: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.register(b, res);
  }
  @Post("login") @HttpCode(200) login(
    @Body() b: UserLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(b, res);
  }
  @Post("refresh") @HttpCode(200) refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.refresh(req, res);
  }
  @Post("logout") @HttpCode(200) logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.logout(req, res);
  }
  @Get("me") @UseGuards(UserGuard) me(
    @Req() req: UserRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader("Cache-Control", "no-store");
    return req.user;
  }
}
