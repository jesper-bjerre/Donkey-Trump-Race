terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm" }
  }
}

variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "pull_principal_id" {
  description = "Managed identity allowed to pull images (the Container App)."
  type        = string
}
variable "tags" { type = map(string) }

resource "azurerm_container_registry" "this" {
  name                = var.name
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "Basic"
  # Pushes use Entra ID (GitHub OIDC); pulls use the app's managed identity.
  admin_enabled = false
  tags          = var.tags
}

resource "azurerm_role_assignment" "pull" {
  scope                = azurerm_container_registry.this.id
  role_definition_name = "AcrPull"
  principal_id         = var.pull_principal_id
  principal_type       = "ServicePrincipal"
}

output "id" { value = azurerm_container_registry.this.id }
output "name" { value = azurerm_container_registry.this.name }
output "login_server" { value = azurerm_container_registry.this.login_server }
