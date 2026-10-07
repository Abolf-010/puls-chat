import { IsString,MinLength } from "class-validator";

export class loginDto{
    @IsString()
    userName!:string;
    @IsString()
    @MinLength(8)
    password!:string;
    @IsString()
    device!:string;
}
