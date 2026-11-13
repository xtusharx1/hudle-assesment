import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { AuthService, UserRequest } from "./auth";
import { PUBLIC_KEY, ROLE_KEY, Role } from "./access";

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLE_KEY, targets);
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_KEY,
      targets,
    );
    // Method roles override a public controller. Unannotated routes stay closed.
    if (!roles && isPublic) return true;
    const req = context
      .switchToHttp()
      .getRequest<UserRequest & { principal?: { role: Role; id: string } }>();
    let role: Role;
    if (req.headers.authorization !== undefined) {
      const match = /^Bearer ([^ ]+)$/i.exec(req.headers.authorization);
      if (!match)
        throw new UnauthorizedException("Invalid authorization header");
      let payload;
      try {
        payload = this.jwt.verify(match[1], {
          issuer: "hudle-api",
          audience: "hudle-admin",
          algorithms: ["HS256"],
        });
        if (payload.role !== "admin" || typeof payload.sub !== "string")
          throw new Error();
      } catch {
        throw new UnauthorizedException("Please sign in as an admin");
      }
      role = "admin";
      req.principal = { role, id: payload.sub };
    } else {
      // Role and identity come from the verified, live session, never a form field.
      req.user = await this.auth.authenticate(req);
      role = "customer";
      req.principal = { role, id: String(req.user.id) };
    }
    if (!roles?.includes(role))
      throw new ForbiddenException("Your account cannot access this resource");
    return true;
  }
}
