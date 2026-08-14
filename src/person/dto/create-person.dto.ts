import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePersonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
