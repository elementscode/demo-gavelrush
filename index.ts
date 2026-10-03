import { App, getEnv } from "@elements/app";
import config from "#config";
import home from "#app/pages/home";
import lot from "#app/pages/lot";
import signin from "#app/pages/signin";
import signup from "#app/pages/signup";
import admin from "#app/pages/admin";
import adminNewLot from "#app/pages/admin-new-lot";
import checkoutTest from "#app/pages/checkout-test";
import notFound from "#app/pages/errors/not-found";
import unhandled from "#app/pages/errors/unhandled";
import pay from "#app/routes/pay";
import checkoutReturn from "#app/routes/checkout-return";
import stripeWebhook from "#app/routes/stripe-webhook";
import servePhoto from "#app/routes/photos";
import { CloseLotsJob } from "#app/jobs/close-lots";
import { stripeConfigured } from "#app/shared/stripe";

if (getEnv() === "production" && !stripeConfigured()) {
  throw new Error("STRIPE_SECRET_KEY is required in production.");
}

const app = new App();

app.route("/", home);
app.route("/lots/:id", lot);
app.route("/signin", signin);
app.route("/signup", signup);
app.route("/admin", admin);
app.route("/admin/lots/new", adminNewLot);
app.route("/pay/:id", pay);
app.route("/checkout/test/:id", checkoutTest);
app.route("/checkout/return", checkoutReturn);
app.route({ method: "post", path: "/stripe/webhook", handler: stripeWebhook });
app.route("/photos/:id/:hash", servePhoto);

app.cron("every 1m", "close lots", () => new CloseLotsJob().schedule());

app.error((req, res, err) => {
  switch (err.statusCode) {
    case 404:
      return notFound(req, res, err);

    default:
      return unhandled(req, res, err);
  }
});

app.start(config);
