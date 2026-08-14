import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const KINDS = ['income', 'expense'] as const;
export type Kind = (typeof KINDS)[number];

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsIn(KINDS)
  kind!: Kind;
}
