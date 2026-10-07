import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "users/schemas/user.schema";
import { AuthController } from "./auth.controller";
import { loginService } from "./auth.service";
import {JwtModule} from '@nestjs/jwt'
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtStrategy } from "./jwt.strategy";
import { SessionModule } from "session/session.module";

@Module({
    imports:[
        MongooseModule.forFeature([
            {
            name:User.name,
            schema:UserSchema,
        }
        ]),
        JwtModule.registerAsync({
            imports:[ConfigModule],
            useFactory:(configservice:ConfigService)=>({
                secret:configservice.getOrThrow<string>('JWT_SECRET'),

                signOptions:{
                    expiresIn:'15m'
                }
            }),
            inject:[ConfigService]
        }),
        SessionModule
    ],
    providers:[
        loginService,
        JwtStrategy
    ],
    controllers:[AuthController],
})
export class AuthModule{}