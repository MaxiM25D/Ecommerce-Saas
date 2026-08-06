import { app } from "./app.js";
import { environment } from "./config.js";

app.listen(environment.API_PORT, () => {
  console.log(`LUNEK API listening on http://localhost:${environment.API_PORT}`);
});
