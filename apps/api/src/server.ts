import { app } from "./app.js";
import { configurationWarnings, environment } from "./config.js";
import { database } from "./database.js";
import { releaseExpiredReservations } from "./services/orders.js";
import { log } from "./services/logger.js";

const port = environment.PORT ?? environment.API_PORT;
const server = app.listen(port, "0.0.0.0", () => {
  log("info", "server_started", { port, environment: environment.NODE_ENV });
  for (const warning of configurationWarnings()) log("warn", "configuration_warning", { warning });
});

let reservationSweepRunning = false;
async function sweepReservations(): Promise<void> {
  if (reservationSweepRunning) return;
  reservationSweepRunning = true;
  try {
    const released = await releaseExpiredReservations();
    if (released > 0) log("info", "reservations_released", { released });
  } catch (error) {
    log("error", "reservation_sweep_failed", { error });
  } finally {
    reservationSweepRunning = false;
  }
}

const reservationTimer = setInterval(() => {
  void sweepReservations();
}, environment.RESERVATION_SWEEP_INTERVAL_MS);
reservationTimer.unref();
void sweepReservations();

let shuttingDown = false;
async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log("info", "server_stopping", { signal });
  clearInterval(reservationTimer);
  const forceTimer = setTimeout(() => {
    log("error", "server_shutdown_timeout", { signal });
    process.exit(1);
  }, 10_000);
  forceTimer.unref();
  server.close(async (error) => {
    if (error) log("error", "server_close_failed", { error });
    await database.$disconnect().catch((databaseError) => log("error", "database_disconnect_failed", { error: databaseError }));
    clearTimeout(forceTimer);
    process.exit(error ? 1 : exitCode);
  });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("uncaughtException", (error) => { log("error", "uncaught_exception", { error }); void shutdown("uncaughtException", 1); });
process.once("unhandledRejection", (error) => { log("error", "unhandled_rejection", { error }); void shutdown("unhandledRejection", 1); });
