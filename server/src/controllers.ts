import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  ParseIntPipe,
  UnauthorizedException,
  HttpCode,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { CatalogService } from "./catalog";
import { BookingsService } from "./bookings";
import { equal } from "./common";
import {
  BookingDto,
  LoginDto,
  VenueDto,
  SlotDto,
  SlotPatchDto,
  GenerateDto,
  VenueQueryDto,
  DateQueryDto,
  BookingQueryDto,
} from "./dtos";
import { AuthService, UserRequest } from "./auth";
import { Request, Response } from "express";
import { Public, Roles } from "./access";
import { today } from "./time";
@Controller("api")
export class PublicController {
  constructor(
    private catalog: CatalogService,
    private bookings: BookingsService,
  ) {}
  @Public()
  @Get("health")
  health() {
    return { status: "ok", timezone: "Asia/Kolkata" };
  }
  @Public()
  @Get("venues")
  venues(@Query() q: VenueQueryDto) {
    return this.catalog.venues(q);
  }
  @Public()
  @Get("venue-filters")
  filters() {
    return this.catalog.filters();
  }
  @Public()
  @Get("venues/:id")
  venue(@Param("id", ParseIntPipe) id: number) {
    return this.catalog.venue(id);
  }
  @Public()
  @Get("venues/:id/slots")
  slots(@Param("id", ParseIntPipe) id: number, @Query() q: DateQueryDto) {
    return this.catalog.slots(id, q.date || today());
  }
  @Post("bookings") @Roles("customer") book(
    @Body() b: BookingDto,
    @Req() req: UserRequest,
  ) {
    return this.bookings.create(b, req.user);
  }
  @Get("bookings") @Roles("customer") mine(@Req() req: UserRequest) {
    return this.bookings.mine(req.user.id);
  }
  @Get("bookings/:reference") @Roles("customer") get(
    @Param("reference") ref: string,
    @Req() req: UserRequest,
  ) {
    return this.bookings.get(ref, req.user.id);
  }
  @Post("bookings/:reference/cancel")
  @HttpCode(200)
  @Roles("customer")
  cancel(@Param("reference") ref: string, @Req() req: UserRequest) {
    return this.bookings.cancel(ref, req.user.id);
  }
}
@Controller("api/admin")
export class LoginController {
  constructor(
    private jwt: JwtService,
    private auth: AuthService,
  ) {}
  @Public()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() b: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (
      !equal(b.username, process.env.ADMIN_USERNAME || "admin") ||
      !equal(b.password, process.env.ADMIN_PASSWORD || "PlayWithHudle!2026")
    )
      throw new UnauthorizedException("Incorrect username or password");
    await this.auth.logout(req, res);
    return {
      token: this.jwt.sign(
        { role: "admin", sub: process.env.ADMIN_USERNAME || "admin" },
        {
          issuer: "hudle-api",
          audience: "hudle-admin",
          algorithm: "HS256",
        },
      ),
      username: process.env.ADMIN_USERNAME || "admin",
    };
  }
}
@Controller("api/admin")
@Roles("admin")
export class AdminController {
  constructor(
    private catalog: CatalogService,
    private bookings: BookingsService,
  ) {}
  @Get("me") me() {
    return { role: "admin", username: process.env.ADMIN_USERNAME || "admin" };
  }
  @Get("venues") venues() {
    return this.catalog.venues({}, true);
  }
  @Post("venues") create(@Body() b: VenueDto) {
    return this.catalog.saveVenue(b);
  }
  @Put("venues/:id") edit(
    @Param("id", ParseIntPipe) id: number,
    @Body() b: VenueDto,
  ) {
    return this.catalog.saveVenue(b, id);
  }
  @Delete("venues/:id") remove(@Param("id", ParseIntPipe) id: number) {
    return this.catalog.deactivate(id);
  }
  @Get("venues/:id/slots") slots(
    @Param("id", ParseIntPipe) id: number,
    @Query() q: DateQueryDto,
  ) {
    return this.catalog.slots(id, q.date || today(), true);
  }
  @Post("venues/:id/slots") add(
    @Param("id", ParseIntPipe) id: number,
    @Body() b: SlotDto,
  ) {
    return this.catalog.addSlot(id, b);
  }
  @Post("venues/:id/slots/generate") generate(
    @Param("id", ParseIntPipe) id: number,
    @Body() b: GenerateDto,
  ) {
    return this.catalog.generate(id, b);
  }
  @Patch("slots/:id") patch(
    @Param("id", ParseIntPipe) id: number,
    @Body() b: SlotPatchDto,
  ) {
    return this.catalog.editSlot(id, b);
  }
  @Delete("slots/:id") delete(@Param("id", ParseIntPipe) id: number) {
    return this.catalog.editSlot(id, {}, true);
  }
  @Get("bookings") bookingsList(@Query() q: BookingQueryDto) {
    return this.bookings.list(q);
  }
}
