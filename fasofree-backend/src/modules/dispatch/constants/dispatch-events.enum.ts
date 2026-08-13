export enum WsEvents {
  // Événements entrants (Client -> Serveur)
  JOIN_BUSINESS_ROOM = 'joinBusinessRoom',
  JOIN_ORDER_TRACKING = 'joinOrderTracking',
  UPDATE_DRIVER_LOCATION = 'updateDriverLocation',

  // Événements sortants (Serveur -> Client)
  JOINED_ROOM = 'joinedRoom',
  DRIVER_LOCATION_UPDATED = 'driverLocationUpdated',
  NEW_ORDER_ALERT = 'newOrderAlert',
  DELIVERY_OPPORTUNITY = 'deliveryOpportunity',
  TARGETED_ORDER_OFFER = 'targeted_order_offer',
  DELIVERY_PIN_GENERATED = 'deliveryPinGenerated',
  DELIVERY_CONFIRMED = 'deliveryConfirmed',
  ORDER_DISPUTED = 'orderDisputed',
}

export enum WsRooms {
  AVAILABLE_DRIVERS = 'available_drivers',
  DRIVER_PREFIX = 'driver_',
  BUSINESS_PREFIX = 'business_',
  ORDER_PREFIX = 'order_',
}
