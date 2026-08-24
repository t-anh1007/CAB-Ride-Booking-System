import express from 'express';
import {
  confirmPaymentHandler,
  createPaymentHandler,
  getPaymentHandler,
  refundPaymentHandler,
  routeNotAllowed
} from '../controllers/paymentController.js';

const router = express.Router();

router.route('/').post(createPaymentHandler).all(routeNotAllowed);
router.route('/:paymentId').get(getPaymentHandler).all(routeNotAllowed);
router.route('/:paymentId/confirm').post(confirmPaymentHandler).all(routeNotAllowed);
router.route('/:paymentId/refund').post(refundPaymentHandler).all(routeNotAllowed);

export default router;
