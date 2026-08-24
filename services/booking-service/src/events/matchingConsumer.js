import { Kafka } from 'kafkajs';
import mongoose from 'mongoose';
import fetch from 'node-fetch';

const kafka = new Kafka({
    clientId: 'booking-service-orchestrator',
    brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['kafka:9092']
});

const consumer = kafka.consumer({ groupId: 'booking-orchestration-group' });

export async function startMatchingConsumer() {
    await consumer.connect();
    await consumer.subscribe({ topic: 'driver.assigned', fromBeginning: false });

    console.log('🎧 [Orchestrator] Listening for AI Matching results on topic: driver.assigned');

    await consumer.run({
        eachMessage: async ({ message }) => {
            try {
                const data = JSON.parse(message.value.toString());
                const eventType = data.type || data.event_type;

                if (eventType === 'DriverSelected') {
                    const { bookingId, driverId, userId } = data;
                    console.log(`🤖 [Orchestrator] AI Selected driver ${driverId} for booking ${bookingId}`);

                    // 1. Update Booking Status in MongoDB
                    const Booking = mongoose.model('Booking');
                    const updatedBooking = await Booking.findOneAndUpdate(
                        { bookingId: bookingId },
                        { 
                            status: 'ASSIGNED',
                            driverId: driverId,
                            updatedAt: new Date()
                        },
                        { new: true }
                    );

                    if (!updatedBooking) {
                        console.warn(`⚠️ [Orchestrator] Booking ${bookingId} not found in database`);
                        return;
                    }

                    console.log(`✅ [Orchestrator] Booking ${bookingId} updated to ASSIGNED`);

                    // 2. Notify API Gateway (Realtime Hub)
                    // This will push WebSocket events to both Customer and Driver
                    const gatewayUrl = process.env.API_GATEWAY_INTERNAL_URL || 'http://api-gateway:3000';
                    const internalKey = process.env.REALTIME_INTERNAL_KEY || 'cab-realtime-internal-key';

                    const notificationPayload = {
                        userIds: [userId, driverId],
                        event: {
                            type: 'ride.assigned',
                            payload: {
                                bookingId,
                                rideId: bookingId,
                                driverId,
                                status: 'ASSIGNED',
                                pickup: {
                                    lat: updatedBooking.pickup.lat,
                                    lng: updatedBooking.pickup.lng,
                                    address: updatedBooking.pickup.address || "Vị trí đón khách"
                                },
                                destination: {
                                    lat: updatedBooking.drop.lat,
                                    lng: updatedBooking.drop.lng,
                                    address: updatedBooking.drop.address || "Điểm đến"
                                },
                                price: updatedBooking.priceSnapshot?.amount || updatedBooking.lockedPrice?.amount || 0,
                                priceSnapshot: updatedBooking.priceSnapshot?.amount || updatedBooking.lockedPrice?.amount || 0,
                                distanceKm: updatedBooking.distanceKm || 0,
                                distance_km: updatedBooking.distanceKm || 0,
                                rideType: updatedBooking.vehicleType || 'bike',
                                ride_type: updatedBooking.vehicleType || 'bike'
                            }
                        }
                    };

                    console.log(`📡 [Orchestrator] Notification Payload for booking ${bookingId}:`, JSON.stringify(notificationPayload.event.payload));

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
                            console.log(`📡 [Orchestrator] Realtime notification sent to Gateway for booking ${bookingId}`);
                        } else {
                            const errText = await response.text();
                            console.error(`❌ [Orchestrator] Gateway notification failed: ${errText}`);
                        }

                        // 3. Inform ride-service via Kafka (resilience)
                        const messageBroker = (await import('../utils/messageBroker.js')).default;
                        await messageBroker.publish('ride.assigned', {
                            ...data,
                            pickup: updatedBooking.pickup,
                            drop: updatedBooking.drop,
                            price: notificationPayload.event.payload.priceSnapshot,
                            distance_km: updatedBooking.distanceKm,
                            ride_type: updatedBooking.vehicleType
                        });
                        console.log(`📤 [Orchestrator] Published ride.assigned for ride-service to create ride record`);

                    } catch (fetchError) {
                        console.error(`❌ [Orchestrator] Error calling Gateway:`, fetchError.message);
                    }
                }
            } catch (error) {
                console.error('❌ [Orchestrator] Error processing matching event:', error.message);
            }
        }
    });
}
