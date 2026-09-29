terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm" }
  }
}

variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "writer_principal_id" {
  description = "Managed identity that appends telemetry/audit blobs (the game server)."
  type        = string
}
variable "telemetry_retention_days" { type = number }
variable "audit_retention_days" { type = number }
variable "privacy_request_retention_days" { type = number }
variable "beta_report_retention_days" { type = number }
variable "lock_audit_immutability" {
  description = "Lock the audit immutability policy (irreversible; production only)."
  type        = bool
}
variable "tags" { type = map(string) }

resource "azurerm_storage_account" "this" {
  name                            = var.name
  location                        = var.location
  resource_group_name             = var.resource_group_name
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  account_kind                    = "StorageV2"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  # Entra ID only: no account keys or SAS tokens to leak.
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  tags                            = var.tags

  blob_properties {
    versioning_enabled = true
    delete_retention_policy {
      days = 7
    }
    container_delete_retention_policy {
      days = 7
    }
  }
}

# telemetry/, privacy/requests/ and beta-reports/ prefixes live in "telemetry";
# the audit trail has its own container so it can carry an immutability policy.
resource "azurerm_storage_container" "telemetry" {
  name                  = "telemetry"
  storage_account_id    = azurerm_storage_account.this.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "audit" {
  name                  = "audit"
  storage_account_id    = azurerm_storage_account.this.id
  container_access_type = "private"
}

# Write-once audit records: appends are allowed, rewrites and deletes are not.
resource "azurerm_storage_container_immutability_policy" "audit" {
  storage_container_resource_manager_id = azurerm_storage_container.audit.id
  immutability_period_in_days           = var.audit_retention_days
  protected_append_writes_enabled       = true
  locked                                = var.lock_audit_immutability
}

resource "azurerm_storage_management_policy" "retention" {
  storage_account_id = azurerm_storage_account.this.id

  rule {
    name    = "telemetry-retention"
    enabled = true
    filters {
      blob_types   = ["appendBlob", "blockBlob"]
      prefix_match = ["telemetry/telemetry/"]
    }
    actions {
      base_blob {
        delete_after_days_since_creation_greater_than = var.telemetry_retention_days
      }
      version {
        delete_after_days_since_creation = 7
      }
    }
  }

  rule {
    name    = "audit-retention"
    enabled = true
    filters {
      blob_types   = ["appendBlob", "blockBlob"]
      prefix_match = ["audit/audit/"]
    }
    actions {
      base_blob {
        delete_after_days_since_creation_greater_than = var.audit_retention_days
      }
    }
  }

  rule {
    name    = "privacy-request-retention"
    enabled = true
    filters {
      blob_types   = ["blockBlob"]
      prefix_match = ["telemetry/privacy/requests/"]
    }
    actions {
      base_blob {
        delete_after_days_since_creation_greater_than = var.privacy_request_retention_days
      }
    }
  }

  rule {
    name    = "beta-report-retention"
    enabled = true
    filters {
      blob_types   = ["blockBlob"]
      prefix_match = ["telemetry/beta-reports/"]
    }
    actions {
      base_blob {
        delete_after_days_since_creation_greater_than = var.beta_report_retention_days
      }
    }
  }
}

resource "azurerm_role_assignment" "writer" {
  scope                = azurerm_storage_account.this.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.writer_principal_id
  principal_type       = "ServicePrincipal"
}

output "account_name" { value = azurerm_storage_account.this.name }
output "blob_endpoint" { value = azurerm_storage_account.this.primary_blob_endpoint }
output "telemetry_container_name" { value = azurerm_storage_container.telemetry.name }
output "audit_container_name" { value = azurerm_storage_container.audit.name }
output "lifecycle_prefixes" {
  description = "Blob prefixes covered by retention rules (container/prefix)."
  value       = flatten([for rule in azurerm_storage_management_policy.retention.rule : rule.filters[0].prefix_match])
}

output "retention_days" {
  value = {
    telemetry        = var.telemetry_retention_days
    audit            = var.audit_retention_days
    privacy_requests = var.privacy_request_retention_days
    beta_reports     = var.beta_report_retention_days
  }
}
