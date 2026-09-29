terraform {
  required_version = ">= 1.9.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.40"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Partial configuration: supply env/<environment>.backend.hcl at init time.
  # `terraform init -backend=false` is enough for fmt/validate/test.
  backend "azurerm" {}
}

# Subscription and tenant come from ARM_SUBSCRIPTION_ID / ARM_TENANT_ID (set by azure/login
# with OIDC in GitHub Actions, or by `az login` locally). Nothing is hardcoded here.
provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = false
    }
  }
  # Blob containers are managed with Entra ID; shared keys are disabled on the account.
  storage_use_azuread = true
}
