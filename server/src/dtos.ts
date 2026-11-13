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
} from "class-validator";
import { Transform } from "class-transformer";
export class BookingDto {
  @IsInt() @Min(1) slotId!: number;
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
  @IsString() @Length(2, 150) name!: string;
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
  @IsString() @Length(2, 100) location!: string;
  @IsString() @Length(5, 300) address!: string;
  @IsOptional() @IsString() @Length(0, 3000) description?: string;
  @IsOptional()
  @Matches(/^(https:\/\/|\/images\/[a-z]+\.jpg$)/)
  @Length(0, 1000)
  image_url?: string;
  @IsInt() @Min(0) @Max(10000000) price_per_hour!: number;
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
