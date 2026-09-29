data "azurerm_client_config" "current" {}

data "azurerm_resource_group" "env" {
  name = var.resource_group_name
}

locals {
  name = "${var.name_prefix}-${var.environment}"
  # Globally unique, alphanumeric names (storage account, registry, key vault).
  suffix     = substr(sha1("${data.azurerm_resource_group.env.id}/${var.name_prefix}"), 0, 6)
  compact    = "${var.name_prefix}${replace(var.environment, "production", "prod")}${local.suffix}"
  app_name   = "${local.name}-app"
  production = var.environment == "production"

  tags = merge(
    {
      application = "donkey-trump-race"
      environment = var.environment
      managed-by  = "terraform"
    },
    var.tags,
  )
}

# The app identity exists before the app so Key Vault, Storage and ACR roles can be granted
# first; the container starts with every permission already in place.
resource "azurerm_user_assigned_identity" "app" {
  name                = "${local.name}-app-id"
  location            = var.location
  resource_group_name = data.azurerm_resource_group.env.name
  tags                = local.tags
}

module "application_insights" {
  source              = "./modules/application-insights"
  name                = local.name
  location            = var.location
  resource_group_name = data.azurerm_resource_group.env.name
  log_retention_days  = var.log_retention_days
  alert_email         = var.alert_email
  environment         = var.environment
  tags                = local.tags
}

module "container_registry" {
  source              = "./modules/container-registry"
  name                = "${local.compact}acr"
  location            = var.location
  resource_group_name = data.azurerm_resource_group.env.name
  pull_principal_id   = azurerm_user_assigned_identity.app.principal_id
  tags                = local.tags
}

module "key_vault" {
  source                   = "./modules/key-vault"
  name                     = "${local.compact}-kv"
  location                 = var.location
  resource_group_name      = data.azurerm_resource_group.env.name
  tenant_id                = data.azurerm_client_config.current.tenant_id
  reader_principal_id      = azurerm_user_assigned_identity.app.principal_id
  administrator_object_id  = data.azurerm_client_config.current.object_id
  purge_protection_enabled = var.key_vault_purge_protection || local.production
  tags                     = local.tags
}

module "blob_storage" {
  source                         = "./modules/blob-storage"
  name                           = "${local.compact}st"
  location                       = var.location
  resource_group_name            = data.azurerm_resource_group.env.name
  writer_principal_id            = azurerm_user_assigned_identity.app.principal_id
  telemetry_retention_days       = var.telemetry_retention_days
  audit_retention_days           = var.audit_retention_days
  privacy_request_retention_days = var.privacy_request_retention_days
  beta_report_retention_days     = var.beta_report_retention_days
  lock_audit_immutability        = local.production
  tags                           = local.tags
}

module "container_apps" {
  source                     = "./modules/container-apps"
  name                       = local.name
  app_name                   = local.app_name
  location                   = var.location
  resource_group_name        = data.azurerm_resource_group.env.name
  environment                = var.environment
  log_analytics_workspace_id = module.application_insights.log_analytics_workspace_id
  identity_id                = azurerm_user_assigned_identity.app.id
  identity_client_id         = azurerm_user_assigned_identity.app.client_id
  registry_server            = module.container_registry.login_server
  image                      = var.container_image
  cpu                        = var.container_cpu
  memory                     = var.container_memory
  max_replicas               = var.max_replicas
  room_token_secret_id       = module.key_vault.room_token_secret_versionless_id
  telemetry_salt_secret_id   = module.key_vault.telemetry_salt_secret_versionless_id
  telemetry_storage_url      = module.blob_storage.blob_endpoint
  telemetry_container        = module.blob_storage.telemetry_container_name
  audit_container            = module.blob_storage.audit_container_name
  extra_allowed_origins      = var.extra_allowed_origins
  tags                       = local.tags

  # Roles must exist before the first revision pulls the image and reads secrets.
  depends_on = [module.container_registry, module.key_vault, module.blob_storage]
}

module "waf" {
  count               = var.enable_front_door ? 1 : 0
  source              = "./modules/waf"
  name                = replace("${local.name}waf", "-", "")
  resource_group_name = data.azurerm_resource_group.env.name
  tags                = local.tags
}

module "cdn" {
  count               = var.enable_front_door ? 1 : 0
  source              = "./modules/cdn"
  name                = local.name
  resource_group_name = data.azurerm_resource_group.env.name
  origin_host_name    = module.container_apps.fqdn
  waf_policy_id       = module.waf[0].policy_id
  tags                = local.tags
}
