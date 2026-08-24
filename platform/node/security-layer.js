import { getGatewaySecurityProfile } from "../architecture/security-topology.js";

export function createSecurityLayer({ gatewayKey, securityTopology }) {
  const gatewayProfile = getGatewaySecurityProfile();

  return {
    metadata: {
      gateway: gatewayKey,
      model: securityTopology.model,
      trustPath: securityTopology.trustPath,
      gatewayProfile,
      serviceToService: securityTopology.serviceToService,
      iam: securityTopology.iam,
      auditAndDetection: securityTopology.auditAndDetection
    },
    middleware(request, response, next) {
      request.securityArchitecture = {
        model: securityTopology.model,
        gateway: gatewayKey
      };

      response.setHeader("x-cab-security-model", securityTopology.model);
      response.setHeader("x-cab-security-gateway-role", gatewayProfile.role);

      next();
    }
  };
}
