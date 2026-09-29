terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm" }
    random  = { source = "hashicorp/random" }
  }
}

variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "tenant_id" { type = string }
variable "reader_principal_id" {
  description = "Managed identity that may read secret values (the game server). Nothing else gets read access."
  type        = string
}
variable "administrator_object_id" {
  description = "Principal running Terraform; needs to write the generated secrets."
  type        = string
}
variable "purge_protection_enabled" { type = bool }
variable "tags" { type = map(string) }

resource "azurerm_key_vault" "this" {
  name                          = var.name
  location                      = var.location
  resource_group_name           = var.resource_group_name
  tenant_id                     = var.tenant_id
  sku_name                      = "standard"
  rbac_authorization_enabled    = true
  soft_delete_retention_days    = 30
  purge_protection_enabled      = var.purge_protection_enabled
  public_network_access_enabled = true
  tags                          = var.tags
}

# Least privilege: the app can only read secret values; the deployer manages them.
resource "azurerm_role_assignment" "app_secrets_user" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = var.reader_principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "deployer_secrets_officer" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = var.administrator_object_id
}

# Secret values are generated here and never appear in code or variables. They do live in
# Terraform state, which is why the state container is private and Entra-ID only.
resource "random_password" "room_token_signing_key" {
  length  = 64
  special = false
}

resource "random_password" "telemetry_hash_salt" {
  length  = 48
  special = false
}

resource "azurerm_key_vault_secret" "room_token_signing_key" {
  name         = "room-token-signing-key"
  value        = random_password.room_token_signing_key.result
  key_vault_id = azurerm_key_vault.this.id
  content_type = "HMAC-SHA256 key for room tokens"
  depends_on   = [azurerm_role_assignment.deployer_secrets_officer]
}

resource "azurerm_key_vault_secret" "telemetry_hash_salt" {
  name         = "telemetry-hash-salt"
  value        = random_password.telemetry_hash_salt.result
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Salt for pseudonymous telemetry identifiers"
  depends_on   = [azurerm_role_assignment.deployer_secrets_officer]
}

output "id" { value = azurerm_key_vault.this.id }
output "uri" { value = azurerm_key_vault.this.vault_uri }
output "room_token_secret_versionless_id" {
  value = azurerm_key_vault_secret.room_token_signing_key.versionless_id
}
output "telemetry_salt_secret_versionless_id" {
  value = azurerm_key_vault_secret.telemetry_hash_salt.versionless_id
}
