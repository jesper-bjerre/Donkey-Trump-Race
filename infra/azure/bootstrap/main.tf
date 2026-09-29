# One-time setup, run by a person with Owner on the subscription and permission to create
# Entra applications (see infra/README.md). It creates:
#   - a resource group per environment,
#   - the Terraform state storage account (Entra-ID only, versioned, private),
#   - the GitHub Actions OIDC identity with roles scoped to those resource groups.
# Its own state is kept locally by the operator (it contains no secrets).

terraform {
  required_version = ">= 1.9.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.40"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "azurerm" {
  features {}
  storage_use_azuread = true
}

provider "azuread" {}

variable "location" {
  type    = string
  default = "westeurope"
}

variable "name_prefix" {
  type    = string
  default = "dtr"
}

variable "environments" {
  description = "Environments to prepare now. Production can be added later."
  type        = list(string)
  default     = ["dev", "staging"]
  validation {
    condition     = alltrue([for e in var.environments : contains(["dev", "staging", "production"], e)])
    error_message = "Environments must be dev, staging or production."
  }
}

variable "github_repository" {
  description = "owner/repo allowed to deploy, e.g. jesper-bjerre/Donkey-Trump-Race."
  type        = string
}

variable "enable_github_oidc" {
  description = "Create the Entra app + federated credentials (needs Application Administrator or equivalent)."
  type        = bool
  default     = true
}

locals {
  tags = { application = "donkey-trump-race", managed-by = "terraform-bootstrap" }
}

resource "azurerm_resource_group" "environment" {
  for_each = toset(var.environments)
  name     = "rg-${var.name_prefix}-${each.key}"
  location = var.location
  tags     = merge(local.tags, { environment = each.key })
}

resource "azurerm_resource_group" "state" {
  name     = "rg-${var.name_prefix}-tfstate"
  location = var.location
  tags     = local.tags
}

resource "random_string" "state" {
  length  = 6
  special = false
  upper   = false
}

resource "azurerm_storage_account" "state" {
  name                            = "${var.name_prefix}tfstate${random_string.state.result}"
  resource_group_name             = azurerm_resource_group.state.name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = "ZRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  tags                            = local.tags

  blob_properties {
    versioning_enabled = true
    delete_retention_policy {
      days = 30
    }
  }
}

resource "azurerm_storage_container" "state" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"
}

data "azurerm_client_config" "current" {}

# The operator running bootstrap also needs to read/write state for local applies.
resource "azurerm_role_assignment" "operator_state" {
  scope                = azurerm_storage_account.state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azurerm_client_config.current.object_id
}

module "github_oidc" {
  count                    = var.enable_github_oidc ? 1 : 0
  source                   = "../modules/github-oidc"
  name                     = "github-${var.name_prefix}-deploy"
  github_repository        = var.github_repository
  environments             = { for env, rg in azurerm_resource_group.environment : env => rg.name }
  state_storage_account_id = azurerm_storage_account.state.id
}

output "resource_groups" {
  value = { for env, rg in azurerm_resource_group.environment : env => rg.name }
}

output "state_backend" {
  description = "Values for env/<environment>.backend.hcl."
  value = {
    resource_group_name  = azurerm_resource_group.state.name
    storage_account_name = azurerm_storage_account.state.name
    container_name       = azurerm_storage_container.state.name
  }
}

output "github_actions" {
  description = "Set these as GitHub repository variables (not secrets; none of them are sensitive)."
  value = var.enable_github_oidc ? {
    AZURE_CLIENT_ID         = module.github_oidc[0].client_id
    AZURE_TENANT_ID         = data.azurerm_client_config.current.tenant_id
    AZURE_SUBSCRIPTION_ID   = data.azurerm_client_config.current.subscription_id
    TFSTATE_RESOURCE_GROUP  = azurerm_resource_group.state.name
    TFSTATE_STORAGE_ACCOUNT = azurerm_storage_account.state.name
  } : null
}
