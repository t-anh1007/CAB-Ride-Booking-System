import { getAiGatewayProfile } from "../architecture/ai-topology.js";

export function createAiLayer({ gatewayKey, aiTopology }) {
  const gatewayProfile = getAiGatewayProfile();

  return {
    metadata: {
      gateway: gatewayKey,
      scope: aiTopology.scope,
      useCases: gatewayProfile.useCases,
      aiLayer: gatewayProfile.aiLayer,
      mlPlatform: gatewayProfile.mlPlatform
    },
    middleware(request, response, next) {
      request.aiArchitecture = {
        gateway: gatewayKey,
        scope: aiTopology.scope
      };

      response.setHeader("x-cab-ai-scope", aiTopology.scope);
      response.setHeader("x-cab-ai-serving", aiTopology.mlPlatform.modelServingApi);

      next();
    }
  };
}
