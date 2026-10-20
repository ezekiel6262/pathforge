import { route } from "../src/server.js";
import { config } from "../src/config.js";
import { AppError } from "../src/lib/errors.js";
import { send } from "../src/http.js";

export default async function handler(request, response) {
  try {
    await route(request, response);
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    send(response, status, {
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: status === 500 ? "Unexpected server error." : error.message,
        details: error.details
      }
    }, config.corsOrigin);
    if (status === 500) console.error(error);
  }
}
