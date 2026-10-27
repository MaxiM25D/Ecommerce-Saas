CREATE UNIQUE INDEX "ShippingOrigin_single_default_per_tenant"
ON "ShippingOrigin"("tenantId")
WHERE "isDefault" = true;
