import { app } from "./app.js";
import { environment } from "./config.js";
import { releaseExpiredReservations } from "./services/orders.js";

app.listen(environment.API_PORT, () => {
  console.log(`InfinityShop API listening on http://localhost:${environment.API_PORT}`);
});

const reservationTimer = setInterval(() => {
  void releaseExpiredReservations().catch((error) => console.error("[RESERVATIONS]", error));
}, environment.RESERVATION_SWEEP_INTERVAL_MS);
reservationTimer.unref();
void releaseExpiredReservations().catch((error) => console.error("[RESERVATIONS]", error));
