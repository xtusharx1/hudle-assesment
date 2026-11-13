import {
  IsString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsEmail,
  Matches,
  Length,
  IsBoolean,
  IsIn,
  ValidateBy,
  ValidateIf,
  IsDateString,
} from "class-validator";
import { Transform } from "class-transformer";
export class BookingDto {
  @IsInt() @Min(1) slotId!: number;
  @IsOptional() @IsInt() @Min(0) @Max(10000000) expectedPrice?: number;
}
export class RegisterDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/\S/)
  @Length(2, 100)
  name!: string;
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @Length(3, 254)
  email!: string;
  @Matches(/^[6-9]\d{9}$/) phone!: string;
  @IsString() @Length(10, 128) password!: string;
}
export class UserLoginDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @Length(3, 254)
  email!: string;
  @IsString() @Length(1, 128) password!: string;
}

export class LoginDto {
  @IsString() @Length(1, 100) username!: string;
  @IsString() @Length(1, 200) password!: string;
}
export class VenueDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 150)
  name!: string;
  @IsIn([
    "Badminton",
    "Football",
    "Tennis",
    "Basketball",
    "Cricket",
    "Swimming",
    "Table Tennis",
    "Pickleball",
  ])
  sport!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  location!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(5, 300)
  address!: string;
  @IsOptional() @IsString() @Length(0, 3000) description?: string;
  @IsOptional()
  @ValidateBy({
    name: "imageUrl",
    validator: {
      validate(value: unknown) {
        if (typeof value !== "string") return false;
        if (/^\/images\/[a-z]+\.jpg$/.test(value)) return true;
        try {
          const url = new URL(value);
          return (
            url.protocol === "https:" &&
            Boolean(url.hostname) &&
            !url.username &&
            !url.password
          );
        } catch {
          return false;
        }
      },
      defaultMessage: () =>
        "image_url must be a valid HTTPS URL or a bundled image path",
    },
  })
  @Length(0, 1000)
  image_url?: string;
  @IsInt() @Min(0) @Max(10000000) price_per_hour!: number;
}
export class VenueUpdateDto extends VenueDto {
  @ValidateIf((_, value) => value !== undefined) declare name: string;
  @ValidateIf((_, value) => value !== undefined) declare sport: string;
  @ValidateIf((_, value) => value !== undefined) declare location: string;
  @ValidateIf((_, value) => value !== undefined) declare address: string;
  @ValidateIf((_, value) => value !== undefined) declare price_per_hour: number;
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  is_active?: boolean;
}

export class SlotDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) start_time!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) end_time!: string;
  @IsInt() @Min(0) @Max(10000000) price!: number;
}
export class SlotPatchDto {
  @IsOptional() @IsBoolean() is_blocked?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10000000) price?: number;
}
export class GenerateDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) opens!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) closes!: string;
  @IsInt() @Min(30) @Max(240) duration!: number;
}

export class VenueQueryDto {
  @IsOptional() @IsString() @Length(0, 40) sport?: string;
  @IsOptional() @IsString() @Length(0, 100) location?: string;
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(0, 100)
  q?: string;
}
export class DateQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date?: string;
}
export class BookingQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    value === ""
      ? undefined
      : typeof value === "string"
        ? Number(value)
        : value,
  )
  @IsInt()
  @Min(1)
  venueId?: number;
  @IsOptional()
  @Transform(({ value }) => (value === "" ? undefined : value))
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date?: string;
  @IsOptional()
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsIn(["CONFIRMED", "CANCELLED"])
  status?: string;
}
