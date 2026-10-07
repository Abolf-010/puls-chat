import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CallGateway } from './call.gateway';
import { CallService } from './call.service';
import { CallManager } from './call.manager';
import { CallLog, CallLogSchema } from './call-log.schema';
import { CallLogService } from './call-log.service';
import { CallLogController } from './call-log.controller';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: CallLog.name, schema: CallLogSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [CallLogController],
  providers: [CallManager, CallLogService, CallService, CallGateway],
  exports: [CallService, CallManager, CallLogService],
})
export class CallModule {}
