import { UnauthorizedException,Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as argon2 from 'argon2';
import { loginDto } from "./dto/login.dto";
import { UserDocument,User } from "users/schemas/user.schema";
import { JwtService } from "@nestjs/jwt";
import { SessionService } from "session/session.service";
import { ConfigService } from "@nestjs/config";


@Injectable()
export class loginService{
    constructor(@InjectModel(User.name) private readonly userModel :Model<UserDocument>,private readonly jwtService:JwtService,private readonly SessionService:SessionService,private readonly configService:ConfigService){}



    async refresh(refreshToken:string){
        const refreshSecret=this.configService.get<string>('JWT_REFRESH_SECRET')
        const payload=await this.jwtService.verifyAsync(refreshToken,{
            secret:refreshSecret,
        })
        const session=await this.SessionService.findSession(payload.sessionId)
        
        if(!session){
            throw new UnauthorizedException('Invalid session')
        }
        if(session.revokedAt){
            throw new UnauthorizedException('Session revoked')
        }
        const isValid=await argon2.verify(session.refreshTokenHash,refreshToken)
        if(!isValid){
            await this.SessionService.recokeSession(payload.sessionId,payload.sub)
            throw new UnauthorizedException('Invalid refresh token')
        }
        const accessSecret=this.configService.get<string>('JWT_SECRET')
        const accessToken=await this.jwtService.signAsync({
            sub:payload.sub
        },
        {
            secret:accessSecret,
            expiresIn:'15m'
        }
        )
        const newRefreshToken=await this.jwtService.signAsync(
            {
                sub:payload.sub,
                sessionId:payload.sessionId
            },
            {
                secret:refreshSecret,
                expiresIn:'7d'
            }
        )
        const newRefreshTokenHash=await argon2.hash(newRefreshToken)
        await this.SessionService.updateRefreshTokenHash(payload.sessionId,newRefreshTokenHash)

        return {refreshToken:newRefreshToken,accessToken:accessToken}
    }
    async login(data:loginDto){
        const user= await this.userModel.findOne({
            username:data.userName,
        })

        if(!user){
            throw new UnauthorizedException('Invalid Username or Password')
        }

        const passValid=await argon2.verify(user.password,data.password)

        if(!passValid){
            throw new UnauthorizedException('Invalid Username or Password')
            
        }
        
        const payload={
            sub:user.userId,
            username:user.username
        }



        const accessToken=await this.jwtService.signAsync(payload,{
            expiresIn:'15m'
        })
        const expiresAt =new Date(Date.now()+7*24*60*60*1000)
        const session=await this.SessionService.createSession(
            user.userId,
            'abc',
            expiresAt
        )
        const refreshPayload={
            sub:user.userId,
            sessionId:session._id
        }   
        const refreshSecret=this.configService.get<string>('JWT_REFRESH_SECRET')
        const refreshToken=await this.jwtService.signAsync(refreshPayload,{
            secret:refreshSecret,
            expiresIn:'7d',
        })
        const refreshTokenHash=await argon2.hash(refreshToken)
        this.SessionService.updateRefreshTokenHash(session._id.toString(),refreshTokenHash)

        return {accessToken,refreshToken}

    }


    async logout(refreshToken){
        const refreshSecret=this.configService.get<string>('JWT_REFRESH_SECRET')
        const payload= await this.jwtService.verifyAsync(
            refreshToken,
            {
                secret:refreshSecret
            }
        )

        const sessionId = payload.sessionId || payload.sessinId;
        if (!sessionId) {
            throw new UnauthorizedException('Invalid refresh token payload');
        }
        await this.SessionService.recokeSession(String(sessionId), String(payload.sub));
        return {
            message:'logged out successfully'
        }
    }
    async logoutAll(userId:string){
        await this.SessionService.revokeAllSessions(userId);
        return {
            message:"Logged out from all devices"
        }
    }

    async getSessions(userId:string){
        return this.SessionService.getUserSession(userId)
    }

    async logoutSession(userId:string,sessionId:string){
        const session =await this.SessionService.recokeSession(sessionId,userId)
        if(!session){
            throw new UnauthorizedException('Sessin is not found')
        }
        return {
            message:"Session revoked successfully"
        }
    }
}