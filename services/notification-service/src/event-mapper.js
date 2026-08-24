const rideStatusLabels = {
  CREATED: "Yeu cau dat xe da duoc tao",
  ASSIGNED: "Tai xe da duoc gan cho chuyen di",
  DRIVER_EN_ROUTE: "Tai xe dang di den diem don",
  ARRIVING: "Tai xe sap toi diem don",
  STARTED: "Chuyen di da bat dau",
  IN_PROGRESS: "Chuyen di dang duoc thuc hien",
  COMPLETED: "Chuyen di da hoan thanh",
  CANCELLED: "Chuyen di da bi huy",
  FAILED: "Cap nhat chuyen di gap loi"
};

function extractObject(value) {
  return value && typeof value === "object" ? value : {};
}

function toUpper(value) {
  return String(value || "").trim().toUpperCase();
}

export function mapDomainEventToNotificationCommand(envelope) {
  const topic = String(envelope?.topic || envelope?.type || "").trim();
  const payload = extractObject(envelope?.payload);
  const eventType = toUpper(payload.eventType || payload.type || topic);

  if (!topic && !eventType) {
    return null;
  }

  if (matchesAny(topic, eventType, ["ride.assigned", "driver.assigned", "RideAssigned", "DriverAssigned"])) {
    return buildRideAssignedCommand(payload);
  }

  if (matchesAny(topic, eventType, ["ride.status.changed", "RideStatusChanged"])) {
    return buildRideStatusChangedCommand(payload);
  }

  if (matchesAny(topic, eventType, ["payment.failed", "PaymentFailed"])) {
    return buildPaymentFailedCommand(payload);
  }

  if (matchesAny(topic, eventType, ["payment.completed", "payment.success", "PaymentCompleted", "PaymentSuccess"])) {
    return buildPaymentSuccessCommand(payload);
  }

  return null;
}

function matchesAny(topic, eventType, aliases) {
  return aliases.some((alias) => alias === topic || alias.toUpperCase() === eventType);
}

function buildRideAssignedCommand(payload) {
  const rideId = payload.rideId || payload.relatedEntityId || payload.bookingId;
  const driverName = payload.driverName || payload.driver?.name || "Tai xe";

  return {
    userId: payload.userId || payload.customerId || payload.passengerId,
    type: "RIDE_ASSIGNED",
    channel: payload.channel || "push",
    title: "Da tim thay tai xe",
    message: `${driverName} dang den diem don cua ban`,
    relatedEntityType: "RIDE",
    relatedEntityId: rideId,
    idempotencyKey: payload.eventId || payload.idempotencyKey || rideId,
    metadata: {
      sourceEvent: "ride-assigned",
      driverId: payload.driverId || payload.driver?.id || null
    }
  };
}

function buildRideStatusChangedCommand(payload) {
  const rideStatus = toUpper(payload.status || payload.rideStatus || payload.state);
  const rideId = payload.rideId || payload.relatedEntityId;
  const message = rideStatusLabels[rideStatus] || `Trang thai chuyen di da chuyen sang ${rideStatus || "UNKNOWN"}`;

  return {
    userId: payload.userId || payload.customerId || payload.passengerId,
    type: "RIDE_STATUS_UPDATED",
    channel: payload.channel || "push",
    title: "Cap nhat trang thai chuyen di",
    message,
    relatedEntityType: "RIDE",
    relatedEntityId: rideId,
    idempotencyKey: payload.eventId || `${rideId || "ride"}:${rideStatus || "UNKNOWN"}`,
    metadata: {
      sourceEvent: "ride-status-changed",
      rideStatus
    }
  };
}

function buildPaymentFailedCommand(payload) {
  const paymentId = payload.paymentId || payload.relatedEntityId || payload.transactionId;
  const reason = payload.reason || payload.failureReason || "Thanh toan khong thanh cong";

  return {
    userId: payload.userId || payload.customerId,
    type: "PAYMENT_FAILED",
    channel: payload.channel || "push",
    title: "Thanh toan that bai",
    message: reason,
    relatedEntityType: "PAYMENT",
    relatedEntityId: paymentId,
    idempotencyKey: payload.eventId || paymentId,
    metadata: {
      sourceEvent: "payment-failed",
      amount: payload.amount ?? null,
      currency: payload.currency ?? null
    }
  };
}

function buildPaymentSuccessCommand(payload) {
  const paymentId = payload.paymentId || payload.relatedEntityId || payload.transactionId;

  return {
    userId: payload.userId || payload.customerId,
    type: "PAYMENT_COMPLETED",
    channel: payload.channel || "push",
    title: "Thanh toan thanh cong",
    message: "Khoan thanh toan cua ban da duoc ghi nhan thanh cong",
    relatedEntityType: "PAYMENT",
    relatedEntityId: paymentId,
    idempotencyKey: payload.eventId || paymentId,
    metadata: {
      sourceEvent: "payment-completed",
      amount: payload.amount ?? null,
      currency: payload.currency ?? null
    }
  };
}
