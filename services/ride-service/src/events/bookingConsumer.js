import { Kafka } from 'kafkajs';
import rideService from '../services/ride.service.js';

let consumer;

async function startBookingConsumer(env) {
  if (!env.kafkaEnabled || env.kafkaBrokers.length === 0) {
    console.log('[ride-service] Kafka disabled for booking consumer');
    return;
  }

  const kafka = new Kafka({ clientId: `${env.kafkaClientId}-booking`, brokers: env.kafkaBrokers });
  consumer = kafka.consumer({ groupId: `${env.kafkaGroupId}-booking-v2` });

  await consumer.connect();
  await consumer.subscribe({ topics: ['ride.created', 'ride.assigned'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        if (!message.value) return;
        const payload = JSON.parse(message.value.toString());
        const type = payload.type || payload.event_type;

        console.log(`[ride-service/KAFKA] Received message on topic [${topic}] (partition ${partition}):`, {
          type,
          bookingId: payload.bookingId,
          rideId: payload.rideId
        });

        if (type === 'RideCreated') {
          console.log(`[ride-service] Received RideCreated event for Booking: ${payload.bookingId}`);

          await rideService.createRide({
            rideId: payload.rideId,
            bookingId: payload.bookingId,
            userId: payload.userId,
            pickup: payload.pickup,
            destination: payload.drop || payload.destination,
            priceSnapshot: payload.priceSnapshot,
            quoteId: payload.quoteId,
            status: 'SEARCHING'
          });

        } else if (type === 'DriverSelected') {
          console.log(`[ride-service] Received DriverSelected event for Booking: ${payload.bookingId}`);

          let ride = await rideService.getRideById(payload.rideId || payload.bookingId);

          if (!ride) {
            console.log(`[ride-service] Ride ${payload.bookingId} not found. Creating on-the-fly from DriverSelected event.`);
            ride = await rideService.createRide({
              rideId: payload.rideId || payload.bookingId,
              bookingId: payload.bookingId,
              userId: payload.userId || 'USR-UNKNOWN',
              pickup: payload.pickup || { lat: 0, lng: 0, address: "Đang xác định" },
              destination: payload.drop || payload.destination || { lat: 0, lng: 0, address: "Đang xác định" },
              priceSnapshot: payload.price || 0,
              distanceKm: payload.distance_km || 0,
              rideType: payload.ride_type || 'bike',
              status: 'WAITING_FOR_ACCEPTANCE',
              driverId: payload.driverId
            });
          } else {
            // Cập nhật đầy đủ thông tin để UI Driver không bị thiếu
            ride.driverId = payload.driverId;
            ride.status = 'WAITING_FOR_ACCEPTANCE';

            if (payload.price) ride.priceSnapshot = payload.price;
            if (payload.distance_km) ride.distanceKm = payload.distance_km;

            if (ride.save) {
              await ride.save();
            } else {
              Object.assign(ride, {
                driverId: payload.driverId,
                status: 'WAITING_FOR_ACCEPTANCE',
                priceSnapshot: payload.price || ride.priceSnapshot,
                distanceKm: payload.distance_km || ride.distanceKm
              });
            }
          }
          console.log(`[ride-service] Updated Ride ${ride.rideId} with driver ${payload.driverId} and data from AI`);
        }

      } catch (error) {
        console.error('[ride-service] Error processing RideCreated event:', error.message);
      }
    }
  });
}

async function stopBookingConsumer() {
  if (consumer) {
    await consumer.disconnect();
  }
}

export {
  startBookingConsumer,
  stopBookingConsumer
};
