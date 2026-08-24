import { getGatewayResilienceProfile } from "../architecture/resilience-topology.js";

export function createResilienceLayer({ gatewayKey, resilienceTopology }) {
  const gatewayProfile = getGatewayResilienceProfile();

  return {
    metadata: {
      gateway: gatewayKey,
      scope: resilienceTopology.scope,
      globalEdge: gatewayProfile.globalEdge,
      patterns: gatewayProfile.patterns,
      asyncBackPressure: gatewayProfile.asyncBackPressure
    },
    middleware(request, response, next) {
      request.resilienceArchitecture = {
        gateway: gatewayKey,
        scope: resilienceTopology.scope
      };

      response.setHeader("x-cab-resilience-scope", resilienceTopology.scope);
      response.setHeader("x-cab-async-broker", resilienceTopology.asyncBackPressure.broker);

      next();
    }
  };
}
