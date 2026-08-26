import Booking from '../models/Booking.js';
import messageBroker from '../utils/messageBroker.js';
import { getAndConsumeQuote } from '../utils/redis.js';
import { v4 as uuidv4 } from 'uuid';

const formatResponse = (message, data, req) => ({
    success: true,
    message,
    data,
    meta: {
        requestId: req.headers['x-request-id'] || uuidv4(),
        timestamp: new Date().toISOString()
    }
});

const VALID_PAYMENT_METHODS = ['CASH', 'CREDIT_CARD', 'E_WALLET'];

function serializeBooking(booking) {
    const value = booking?.toObject ? booking.toObject() : booking;
    const createdAt = value?.createdAt instanceof Date ? value.createdAt.toISOString() : value?.createdAt;
    return {
        ...value,
        booking_id: value?.bookingId,
        created_at: createdAt
    };
}

function normalizePaymentMethod(value) {
    if (!value) {
        return 'CASH';
    }

    const normalized = String(value).trim().toUpperCase();
    if (normalized === 'CASH' || normalized === 'CREDIT_CARD' || normalized === 'E_WALLET') {
        return normalized;
    }

    return normalized;
}

function resolveDropLocation(payload) {
    return payload.drop || payload.destination || null;
}

function isIdempotencyDuplicate(error, idempotencyKey) {
    if (error?.code !== 11000) return false;
    return error?.keyPattern?.idempotencyKey === 1
        || Object.prototype.hasOwnProperty.call(error?.keyValue || {}, 'idempotencyKey')
        || (String(error?.message || '').includes('idempotencyKey_1')
            && String(error.message).includes(String(idempotencyKey)));
}

function calculateDistanceKm(origin, destination) {
    const toRadians = (value) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRadians(destination.lat - origin.lat);
    const dLng = toRadians(destination.lng - origin.lng);
    const originLat = toRadians(origin.lat);
    const destinationLat = toRadians(destination.lat);

    const haversine =
        Math.sin(dLat / 2) ** 2 +
        Math.sin(dLng / 2) ** 2 * Math.cos(originLat) * Math.cos(destinationLat);

    const distance = 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    return Number(distance.toFixed(3));
}

// [TC3, TC6, TC11, TC12, TC14, TC19, TC25] Tạo mới chuyến xe
export const createBooking = async (req, res) => {
    try {
        const idempotencyKey = req.headers['idempotency-key'];

        // [TC19] Kiểm tra header Idempotency
        if (!idempotencyKey) {
            return res.status(400).json({ success: false, message: 'Missing Idempotency-Key header' });
        }

        const { userId, pickup, distanceKm, vehicleType, paymentMethod, quoteId } = req.body;
        const drop = resolveDropLocation(req.body);

        // [TC11] Validation: Thiếu trường bắt buộc
        if (!pickup || pickup.lat === undefined || pickup.lng === undefined) {
            return res.status(400).json({ success: false, message: 'pickup is required' });
        }
        if (!drop || drop.lat === undefined || drop.lng === undefined) {
            return res.status(400).json({ success: false, message: 'drop is required' });
        }

        // [TC12] Validation: Sai định dạng tọa độ
        if (typeof pickup.lat !== 'number' || typeof pickup.lng !== 'number' ||
            typeof drop.lat !== 'number' || typeof drop.lng !== 'number') {
            return res.status(422).json({ success: false, message: 'Invalid lat/lng format. Must be numeric.' });
        }

        // [TC14] Validation: Phương thức thanh toán
        const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
        if (paymentMethod && !VALID_PAYMENT_METHODS.includes(normalizedPaymentMethod)) {
            return res.status(400).json({ success: false, message: 'Invalid payment method' });
        }

        const normalizedDistanceKm =
            typeof distanceKm === 'number' && Number.isFinite(distanceKm)
                ? distanceKm
                : calculateDistanceKm(pickup, drop);

        // [Tiêu chí 5] Validate quote_id — đảm bảo giá estimate ↔ booking nhất quán
        let lockedPrice = null;
        if (quoteId) {
            const quote = await getAndConsumeQuote(quoteId);
            if (!quote) {
                // Quote không tồn tại hoặc đã hết hạn (TTL = 3 phút)
                return res.status(409).json({
                    success: false,
                    message: 'Giá đã hết hạn hoặc không hợp lệ. Vui lòng lấy giá mới trước khi đặt xe.',
                    code: 'QUOTE_EXPIRED'
                });
            }
            lockedPrice = {
                amount: quote.amount,
                surgeMultiplier: quote.surgeMultiplier,
                surgeSource: quote.surgeSource,
                lockedAt: new Date(),
            };
        }

        const newBooking = new Booking({
            userId: userId || 'USR-TEMP',
            pickup,
            drop,
            distanceKm: normalizedDistanceKm,
            vehicleType: vehicleType || 'bike',
            paymentMethod: normalizedPaymentMethod,
            idempotencyKey,
            quoteId: quoteId || null,
            lockedPrice,
            // Nếu có quote → dùng giá lock; nếu không có → amount mặc định = 0 (backward-compatible)
            priceSnapshot: lockedPrice ? {
                amount: lockedPrice.amount,
                currency: 'VND',
                surgeMultiplier: lockedPrice.surgeMultiplier
            } : (req.body.price ? {
                amount: req.body.price,
                currency: 'VND',
                surgeMultiplier: 1.0
            } : undefined)
        });

        console.log(`[Booking] Creating new booking:
            Pickup: ${newBooking.pickup.address} (${newBooking.pickup.lat}, ${newBooking.pickup.lng})
            Drop: ${newBooking.drop.address} (${newBooking.drop.lat}, ${newBooking.drop.lng})`);
        
        try {
            await newBooking.save();
        } catch (error) {
            if (!isIdempotencyDuplicate(error, idempotencyKey)) throw error;
            const existingBooking = await Booking.findOne({ idempotencyKey });
            if (!existingBooking) throw error;
            return res.status(200).json(formatResponse("Booking already exists", serializeBooking(existingBooking), req));
        }

        // Publish đúng contract kiến trúc để matching/ETA consume ổn định.
        await messageBroker.publish('ride.created', {
            eventId: uuidv4(),
            type: 'RideCreated',
            rideId: newBooking.bookingId,
            bookingId: newBooking.bookingId,
            userId: newBooking.userId,
            pickup: newBooking.pickup,
            drop: newBooking.drop,
            paymentMethod: newBooking.paymentMethod,
            vehicleType: newBooking.vehicleType,
            rideType: newBooking.vehicleType,
            distanceKm: newBooking.distanceKm,
            quoteId: newBooking.quoteId,
            priceSnapshot: newBooking.priceSnapshot ? newBooking.priceSnapshot.amount : 0,
            timestamp: newBooking.createdAt
        });

        res.status(201).json(formatResponse("Booking created successfully", serializeBooking(newBooking), req));
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// [TC4] Lấy danh sách chuyến xe của User
export const getUserBookings = async (req, res) => {
    try {
        const userId = req.query.user_id;
        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Number.isInteger(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 100)
            : 50;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'Missing user_id parameter' });
        }

        const bookings = await Booking.find({ userId }).sort({ createdAt: -1 }).limit(limit);
        res.status(200).json(formatResponse("Retrieved user bookings", bookings.map(serializeBooking), req));
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Lấy chi tiết một chuyến xe
export const getBookingById = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const booking = await Booking.findOne({ bookingId });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        res.status(200).json(formatResponse("Booking details retrieved", booking, req));
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Hủy chuyến xe
export const cancelBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const booking = await Booking.findOne({ bookingId });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (['COMPLETED', 'CANCELLED'].includes(booking.status)) {
            return res.status(400).json({ success: false, message: `Status is ${booking.status}, cannot cancel.` });
        }

        booking.status = 'CANCELLED';
        await booking.save();

        // Bắn event hủy chuyến
        await messageBroker.publish('ride_events', {
            event_type: 'ride_cancelled',
            ride_id: booking.bookingId,
            user_id: booking.userId,
            timestamp: new Date().toISOString()
        });

        res.status(200).json(formatResponse("Booking cancelled", booking, req));
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Cập nhật thông tin booking (Status, Driver,...)
export const updateBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const updates = req.body;

        const booking = await Booking.findOneAndUpdate(
            { bookingId },
            { $set: updates },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        res.status(200).json(formatResponse("Booking updated", booking, req));
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
