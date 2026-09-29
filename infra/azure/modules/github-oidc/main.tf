terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm" }
    azuread = { source = "hashicorp/azuread" }
  }
}

variable "name" {
  description = "Display name of the Entra application used by GitHub Actions."
  type        = string
}
variable "github_repository" {
  description = "owner/repo that may deploy."
  type        = string
}
variable "environments" {
  description = "GitHub Environments mapped to the resource group each may deploy to."
  type        = map(string)
}
variable "state_storage_account_id" {
  description = "Terraform state storage account; the deployer needs blob data access."
  type        = string
}

# One app per repository. GitHub exchanges its OIDC token for an Entra token; there is no
# client secret anywhere. Each GitHub Environment gets its own federated credential, so a
# workflow can only act as the environment it runs in (production approvals apply).
resource "azuread_application" "github" {
  display_name = var.name
}

resource "azuread_service_principal" "github" {
  client_id = azuread_application.github.client_id
}

resource "azuread_application_federated_identity_credential" "environment" {
  for_each       = var.environments
  application_id = azuread_application.github.id
  display_name   = "github-${each.key}"
  description    = "GitHub Actions environment ${each.key} of ${var.github_repository}"
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "repo:${var.github_repository}:environment:${each.key}"
}

# Pull requests only validate (no Azure access). The `main` branch credential lets the
# validation job read state for `terraform plan` without an environment.
resource "azuread_application_federated_identity_credential" "main_branch" {
  application_id = azuread_application.github.id
  display_name   = "github-main"
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "repo:${var.github_repository}:ref:refs/heads/main"
}

data "azurerm_resource_group" "environment" {
  for_each = var.environments
  name     = each.value
}

# Contributor creates and updates resources; RBAC Administrator lets Terraform grant the
# app's managed identity its roles. Both are scoped to the environment's resource group.
resource "azurerm_role_assignment" "contributor" {
  for_each             = var.environments
  scope                = data.azurerm_resource_group.environment[each.key].id
  role_definition_name = "Contributor"
  principal_id         = azuread_service_principal.github.object_id
}

resource "azurerm_role_assignment" "rbac_admin" {
  for_each             = var.environments
  scope                = data.azurerm_resource_group.environment[each.key].id
  role_definition_name = "Role Based Access Control Administrator"
  principal_id         = azuread_service_principal.github.object_id
}

resource "azurerm_role_assignment" "state" {
  scope                = var.state_storage_account_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azuread_service_principal.github.object_id
}

output "client_id" { value = azuread_application.github.client_id }
output "service_principal_object_id" { value = azuread_service_principal.github.object_id }
