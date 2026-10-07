import { IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class createUserDto {
  /**
   * Unique handle for login / @mention.
   * 3–24 chars: a-z, 0-9, underscore.
   */
  @IsString()
  @Length(3, 24)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username may only contain letters, numbers, and underscore',
  })
  username!: string;

  /** Display name shown in UI — not unique */
  @IsString()
  @Length(1, 40)
  displayName!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(0, 160)
  bio?: string;

  @IsOptional()
  @IsString()
  profilePic?: string;

  /** @deprecated use username — kept for old clients */
  @IsOptional()
  @IsString()
  userName?: string;
}
