# terraform test with mocked providers: no Azure credentials or network access needed.
mock_provider "azurerm" {
  mock_data "azurerm_client_config" {
    defaults = {
      tenant_id       = "00000000-0000-0000-0000-000000000000"
      object_id       = "00000000-0000-0000-0000-000000000001"
      subscription_id = "00000000-0000-0000-0000-000000000002"
    }
  }
  mock_data "azurerm_resource_group" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000002/resourceGroups/rg-dtr-dev"
    }
  }
  mock_resource "azurerm_container_app_environment" {
    defaults = { default_domain = "example.westeurope.azurecontainerapps.io" }
  }
  mock_resource "azurerm_key_vault_secret" {
    defaults = { versionless_id = "https://kv.vault.azure.net/secrets/placeholder" }
  }
  mock_resource "azurerm_log_analytics_workspace" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000002/resourceGroups/rg-dtr-dev/providers/Microsoft.OperationalInsights/workspaces/law"
    }
  }
}

mock_provider "random" {}

variables {
  environment         = "dev"
  resource_group_name = "rg-dtr-dev"
}

run "front_door_is_off_by_default" {
  command = plan
  assert {
    condition     = length(module.cdn) == 0 && length(module.waf) == 0
    error_message = "Front Door must be disabled unless enable_front_door = true."
  }
}

run "retention_defaults_meet_policy" {
  command = plan
  assert {
    condition     = module.blob_storage.retention_days.telemetry == 90
    error_message = "Telemetry must be kept 90 days by default."
  }
  assert {
    condition     = module.blob_storage.retention_days.audit >= 365
    error_message = "Audit records must be kept at least 365 days."
  }
}

run "short_audit_retention_is_rejected" {
  command = plan
  variables {
    audit_retention_days = 30
  }
  expect_failures = [var.audit_retention_days]
}

run "unknown_environment_is_rejected" {
  command = plan
  variables {
    environment = "qa"
  }
  expect_failures = [var.environment]
}

run "single_replica_only" {
  command = plan
  variables {
    max_replicas = 3
  }
  expect_failures = [var.max_replicas]
}

run "front_door_can_be_enabled" {
  command = plan
  variables {
    enable_front_door = true
  }
  assert {
    condition     = length(module.cdn) == 1 && length(module.waf) == 1
    error_message = "enable_front_door = true should create the CDN and WAF modules."
  }
}
