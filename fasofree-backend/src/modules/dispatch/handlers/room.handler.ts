import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { WsEvents, WsRooms } from '../constants/dispatch-events.enum';

@Injectable()
export class RoomHandler {
  private readonly logger = new Logger(RoomHandler.name);

  handleJoinBusinessRoom(client: Socket, businessId: string) {
    const room = `${WsRooms.BUSINESS_PREFIX}${businessId}`;
    client.join(room);
    this.logger.debug(`Socket ${client.id} joined business room: ${room}`);
    return { event: WsEvents.JOINED_ROOM, room };
  }

  handleJoinOrderTracking(client: Socket, orderId: string) {
    const room = `${WsRooms.ORDER_PREFIX}${orderId}`;
    client.join(room);
    this.logger.debug(
      `Socket ${client.id} joined order tracking room: ${room}`,
    );
    return { event: WsEvents.JOINED_ROOM, room };
  }
}
