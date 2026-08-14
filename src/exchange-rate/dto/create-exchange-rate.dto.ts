import { IsISO8601, IsNumber, IsPositive, IsString, Length } from 'class-validator';

export class CreateExchangeRateDto {
  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsISO8601()
  date!: string;

  /** 1 đơn vị ngoại tệ = bao nhiêu VND. */
  @IsNumber()
  @IsPositive()
  rate!: number;
}
