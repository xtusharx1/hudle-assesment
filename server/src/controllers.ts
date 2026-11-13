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
  ParseIntPipe,
  UseGuards,
  UnauthorizedException,
  HttpCode,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { CatalogService } from "./catalog";
import { BookingsService } from "./bookings";
import { AdminGuard, equal } from "./common";
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
import { UserGuard, UserRequest } from "./auth";
import { today } from "./time";
@Controller("api")
export class PublicController {
  constructor(
    private catalog: CatalogService,
    private bookings: BookingsService,
  ) {}
  @Get("health") health() {
    return { status: "ok", timezone: "Asia/Kolkata" };
  }
  @Get("venues") venues(@Query() q: VenueQueryDto) {
    return this.catalog.venues(q);
  }
  @Get("venue-filters") filters() {
    return this.catalog.filters();
  }
  @Get("venues/:id") venue(@Param("id", ParseIntPipe) id: number) {
    return this.catalog.venue(id);
  }
  @Get("venues/:id/slots") slots(
    @Param("id", ParseIntPipe) id: number,
    @Query() q: DateQueryDto,
  ) {
    return this.catalog.slots(id, q.date || today());
  }
  @Post("bookings") @UseGuards(UserGuard) book(
    @Body() b: BookingDto,
    @Req() req: UserRequest,
  ) {
    return this.bookings.create(b, req.user);
  }
  @Get("bookings") @UseGuards(UserGuard) mine(@Req() req: UserRequest) {
    return this.bookings.mine(req.user.id);
  }
  @Get("bookings/:reference") @UseGuards(UserGuard) get(
    @Param("reference") ref: string,
    @Req() req: UserRequest,
  ) {
    return this.bookings.get(ref, req.user.id);
  }
  @Post("bookings/:reference/cancel")
  @HttpCode(200)
  @UseGuards(UserGuard)
  cancel(@Param("reference") ref: string, @Req() req: UserRequest) {
    return this.bookings.cancel(ref, req.user.id);
  }
}
@Controller("api/admin")
export class LoginController {
  constructor(private jwt: JwtService) {}
  @Post("login") @HttpCode(200) login(@Body() b: LoginDto) {
    if (
      !equal(b.username, process.env.ADMIN_USERNAME || "admin") ||
      !equal(b.password, process.env.ADMIN_PASSWORD || "PlayWithHudle!2026")
    )
      throw new UnauthorizedException("Incorrect username or password");
    return {
      token: this.jwt.sign({ role: "admin" }),
      username: process.env.ADMIN_USERNAME || "admin",
    };
  }
}
@Controller("api/admin")
@UseGuards(AdminGuard)
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
