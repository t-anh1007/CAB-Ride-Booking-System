export function createRoutingMiddleware({ proxyClient }) {
  return async function routingMiddleware(request, response, next) {
    try {
      if (!request.routeConfig?.isApiRoute) {
        return next();
      }

      if (response.locals.gatewayResponse) {
        return next();
      }

      if (!request.routeConfig.serviceKey || !request.routeConfig.upstreamUrl) {
        response.locals.gatewayResponse = {
          status: 404,
          body: {
            error: "Route not found"
          }
        };
        return next();
      }

      response.locals.gatewayResponse = await proxyClient.forward({
        request,
        routeConfig: request.routeConfig,
        context: request.context
      });

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
