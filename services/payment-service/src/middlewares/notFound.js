import { sendError } from '../utils/response.js';

export function notFoundHandler(request, response) {
  return sendError(response, request, 'Route not found', 404);
}
