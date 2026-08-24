function wait(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

class BaseChannelAdapter {
  constructor({ channel, provider, minLatencyMs = 5 }) {
    this.channel = channel;
    this.provider = provider;
    this.minLatencyMs = minLatencyMs;
  }

  async deliver(notification) {
    await wait(this.minLatencyMs);

    return {
      channel: this.channel,
      provider: this.provider,
      deliveryReference: `${this.channel}-${notification.id}`,
      deliveredAt: new Date().toISOString()
    };
  }
}

class PushChannelAdapter extends BaseChannelAdapter {
  constructor(options = {}) {
    super({
      channel: "push",
      provider: "in-app-push",
      ...options
    });
  }
}

class EmailChannelAdapter extends BaseChannelAdapter {
  constructor(options = {}) {
    super({
      channel: "email",
      provider: "smtp-simulator",
      ...options
    });
  }

  async deliver(notification) {
    if (!notification.destination?.email) {
      throw new Error("Email channel requires destination.email");
    }

    return super.deliver(notification);
  }
}

class SmsChannelAdapter extends BaseChannelAdapter {
  constructor(options = {}) {
    super({
      channel: "sms",
      provider: "sms-simulator",
      ...options
    });
  }

  async deliver(notification) {
    if (!notification.destination?.phoneNumber) {
      throw new Error("SMS channel requires destination.phoneNumber");
    }

    return super.deliver(notification);
  }
}

export class NotificationChannelDispatcher {
  constructor({
    adapters = {
      push: new PushChannelAdapter(),
      email: new EmailChannelAdapter(),
      sms: new SmsChannelAdapter()
    }
  } = {}) {
    this.adapters = adapters;
  }

  async dispatch(notification) {
    const adapter = this.adapters[notification.channel];

    if (!adapter) {
      throw new Error(`Unsupported channel: ${notification.channel}`);
    }

    return adapter.deliver(notification);
  }
}

export function createDefaultDispatcher() {
  return new NotificationChannelDispatcher();
}
