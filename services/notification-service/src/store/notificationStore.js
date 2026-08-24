const notifications = [];

function nowIso() {
  return new Date().toISOString();
}

function buildMessage(payload) {
  switch (payload.topic) {
    case 'payment.completed':
    case 'notification.payment.completed':
      return 'Thanh toán chuyến đi đã thành công';
    case 'payment.failed':
    case 'notification.payment.failed':
      return 'Thanh toán chuyến đi thất bại';
    case 'payment.refunded':
    case 'notification.payment.refunded':
      return 'Thanh toán đã được hoàn tiền';
    default:
      return 'Cập nhật thanh toán mới';
  }
}

export function appendNotification(payload) {
  const record = {
    notificationId: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId: payload.userId || null,
    rideId: payload.rideId || null,
    paymentId: payload.paymentId || null,
    topic: payload.topic,
    title: 'Payment Update',
    message: buildMessage(payload),
    status: 'SENT',
    createdAt: nowIso()
  };
  notifications.unshift(record);
  return record;
}

export function listNotifications(userId = null) {
  if (!userId) return notifications;
  return notifications.filter((item) => item.userId === userId);
}
