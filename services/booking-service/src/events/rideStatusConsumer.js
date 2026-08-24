import { Kafka } from 'kafkajs';
import mongoose from 'mongoose';
import fetch from 'node-fetch';

const kafka = new Kafka({
    clientId: 'booking-service-status-observer',
    brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['kafka:9092']
});

const consumer = kafka.consumer({ groupId: 'booking-status-observer-group' });

export async function startRideStatusConsumer() {
    await consumer.connect();
    await consumer.subscribe({ topic: 'ride.status.changed', fromBeginning: false });

    console.log('🎧 [Status Observer] Listening for ride status updates on topic: ride.status.changed');

    await consumer.run({
        eachMessage: async ({ message }) => {
            try {
                const data = JSON.parse(message.value.toString());
                const { bookingId, rideId, status, userId, driverId } = data;
                
                console.log(`📡 [Status Observer] Ride ${rideId} (Booking ${bookingId}) changed status to ${status}`);

                // 1. Update Booking Status in MongoDB
                const Booking = mongoose.model('Booking');
                await Booking.findOneAndUpdate(
                    { bookingId: bookingId },
                    { 
                        status: status,
                        updatedAt: new Date()
                    }
                );

                // 2. Forward notification to Gateway (Realtime Hub)
                const gatewayUrl = process.env.API_GATEWAY_INTERNAL_URL || 'http://api-gateway:3000';
                const internalKey = process.env.REALTIME_INTERNAL_KEY || 'cab-realtime-internal-key';

                const notificationPayload = {
                    userIds: [userId, driverId].filter(Boolean),
                    event: {
                        type: 'ride.status.changed',
                        payload: {
                            bookingId,
                            rideId,
                            status,
                            driverId,
                            ...data
                        }
                    }
                };

                try {
                    const response = await fetch(`${gatewayUrl}/internal/realtime/publish`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-realtime-internal-key': internalKey
                        },
                        body: JSON.stringify(notificationPayload)
                    });

                    if (response.ok) {
                        console.log(`📡 [Status Observer] Status update notification sent to Gateway for booking ${bookingId}`);
                    }
                } catch (fetchError) {
                    console.error(`❌ [Status Observer] Error calling Gateway:`, fetchError.message);
                }

            } catch (error) {
                console.error('❌ [Status Observer] Error processing status update:', error.message);
            }
        }
    });
}
