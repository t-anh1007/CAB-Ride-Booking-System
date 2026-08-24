import express from 'express';
import * as bookingController from '../controllers/bookingController.js';

const router = express.Router();

//tạo mới
router.post('/', bookingController.createBooking);

//hủy chuyến
router.post('/:bookingId/cancel', bookingController.cancelBooking);

//xem chi tiết chuyến
router.get('/:bookingId', bookingController.getBookingById);

//Cập nhật thông tin booking (Status, Driver,...)
router.patch('/:bookingId', bookingController.updateBooking);

//Lấy danh sách chuyến xe của user
router.get('/', bookingController.getUserBookings);

export default router;