import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { CallGateway } from 'call/call.gateway';
import { Socket } from 'socket.io';


@Controller('hello')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
};

// @Controller('socket')
// export class Call{
//     constructor(private readonly appService: CallGateway) {}

//     @Get()
//     handleConnection(){
//       return this.appService.handleDisconnect()
//     }
    
// }
