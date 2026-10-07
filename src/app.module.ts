import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {ServeStaticModule} from '@nestjs/serve-static';
import { join } from 'path';
import { CallModule } from 'call/call.module';
import { UserModule } from 'users/user.module';
import {MongooseModule} from '@nestjs/mongoose'
import { AuthModule } from 'auth/auth.module';
import {ConfigModule} from '@nestjs/config'
import { ConversationModule } from 'conversations/convertation.module';
import {  MessageModule } from 'messages/message.module';
import { PresenceModule } from 'presence-redis/presence.module';
import { PushModule } from 'push/push.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      `mongodb://127.0.0.1:27017/chatApp`
    ),
    ConfigModule.forRoot({
      isGlobal:true
    }),
    ServeStaticModule.forRoot({
      rootPath:join(__dirname,'../..','public/login.html'),
      serveRoot:'/login'
    }),
    ServeStaticModule.forRoot({
      rootPath:join(process.cwd(),'uploads'),
      serveRoot:'/uploads'
    }),
        ServeStaticModule.forRoot({
      rootPath:join(__dirname,'../..','public/'),
      serveRoot:'/'
    }),
    CallModule,
    UserModule,
    AuthModule,
    ConversationModule,
    MessageModule,
    PresenceModule,
    PushModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
