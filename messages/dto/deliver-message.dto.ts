import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeliverMessageDto {
  @IsString()
  @IsNotEmpty()
  messageId!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}
