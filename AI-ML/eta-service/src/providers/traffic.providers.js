'use strict';

const config = require('../eta.config');

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function deriveRushHourFactor(date) {
  const hour = date.getHours();
  if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
    return 1.18;
  }
  if (hour >= 22 || hour <= 5) {
    return 0.95;
  }
  return 1.0;
}

async function heuristicTrafficDelay(origin, destination, context = {}) {
  const now = context.timestamp ? new Date(context.timestamp) : new Date();
  const avgSpeedKmh = Number(context.avgSpeedKmh || 0);
  const rainIndicator = Number(context.rainIndicator || 0);
  const eventFlag = Number(context.eventFlag || 0);

  let delayFactor = deriveRushHourFactor(now);

  if (avgSpeedKmh > 0) {
    if (avgSpeedKmh < 10) {
      delayFactor += 0.35;
    } else if (avgSpeedKmh < 20) {
      delayFactor += 0.18;
    } else if (avgSpeedKmh < 30) {
      delayFactor += 0.08;
    } else if (avgSpeedKmh > 45) {
      delayFactor -= 0.05;
    }
  }

  if (rainIndicator > 0) {
    delayFactor += 0.08;
  }

  if (eventFlag > 0) {
    delayFactor += 0.12;
  }

  return {
    delayFactor: clamp(Number(delayFactor.toFixed(2)), 0.85, 2.5),
    provider: 'heuristic',
    inputs: {
      avgSpeedKmh: avgSpeedKmh || null,
      rainIndicator,
      eventFlag,
      hourOfDay: now.getHours(),
    },
    origin,
    destination,
  };
}

async function noTrafficProvider(origin, destination) {
  return {
    delayFactor: clamp(config.defaultTrafficDelayFactor, 0.85, 2.5),
    provider: 'none',
    inputs: {},
    origin,
    destination,
  };
}

const PROVIDERS = {
  heuristic: heuristicTrafficDelay,
  none: noTrafficProvider,
};

async function getTrafficDelayFactor(origin, destination, context = {}) {
  const providerName = (config.trafficProvider || 'heuristic').toLowerCase();
  const provider = PROVIDERS[providerName] || noTrafficProvider;
  return provider(origin, destination, context);
}

module.exports = {
  getTrafficDelayFactor,
  heuristicTrafficDelay,
  noTrafficProvider,
};
