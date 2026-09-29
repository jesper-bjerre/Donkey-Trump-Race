terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm" }
  }
}

variable "name" { type = string }
variable "app_name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "environment" { type = string }
variable "log_analytics_workspace_id" { type = string }
variable "identity_id" { type = string }
variable "identity_client_id" { type = string }
variable "registry_server" { type = string }
variable "image" {
  description = "Image to run; empty runs a public placeholder until the first deploy pushes one."
  type        = string
}
variable "cpu" { type = number }
variable "memory" { type = string }
variable "max_replicas" { type = number }
variable "room_token_secret_id" { type = string }
variable "telemetry_salt_secret_id" { type = string }
variable "telemetry_storage_url" { type = string }
variable "telemetry_container" { type = string }
variable "audit_container" { type = string }
variable "extra_allowed_origins" { type = list(string) }
variable "tags" { type = map(string) }

locals {
  placeholder = var.image == ""
  # The placeholder image listens on port 80; ours on 8080.
  image = local.placeholder ? "mcr.microsoft.com/k8se/quickstart:latest" : var.image
  port  = local.placeholder ? 80 : 8080
  # The app URL is predictable from the environment domain, so it can be allowed up front.
  app_origin      = "https://${var.app_name}.${azurerm_container_app_environment.this.default_domain}"
  allowed_origins = join(",", concat([local.app_origin], var.extra_allowed_origins))
}

resource "azurerm_container_app_environment" "this" {
  name                       = "${var.name}-cae"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  log_analytics_workspace_id = var.log_analytics_workspace_id
  tags                       = var.tags
}

resource "azurerm_container_app" "this" {
  name                         = var.app_name
  container_app_environment_id = azurerm_container_app_environment.this.id
  resource_group_name          = var.resource_group_name
  # One active revision: rooms are in memory, so a deploy replaces the single replica.
  revision_mode = "Single"
  tags          = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [var.identity_id]
  }

  registry {
    server   = var.registry_server
    identity = var.identity_id
  }

  # Key Vault references resolved by the platform with the managed identity.
  secret {
    name                = "room-token-signing-key"
    key_vault_secret_id = var.room_token_secret_id
    identity            = var.identity_id
  }

  secret {
    name                = "telemetry-hash-salt"
    key_vault_secret_id = var.telemetry_salt_secret_id
    identity            = var.identity_id
  }

  ingress {
    external_enabled = true
    target_port      = local.port
    # "auto" negotiates HTTP/1.1 upgrades, so WebSockets (/ws) pass through.
    transport = "auto"
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = var.max_replicas

    container {
      name   = "game-server"
      image  = local.image
      cpu    = var.cpu
      memory = var.memory

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "APP_ENV"
        value = var.environment
      }
      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "ALLOWED_ORIGINS"
        value = local.allowed_origins
      }
      env {
        name  = "TRUST_PROXY"
        value = "true"
      }
      env {
        name        = "ROOM_TOKEN_SECRET"
        secret_name = "room-token-signing-key"
      }
      env {
        name        = "TELEMETRY_HASH_SALT"
        secret_name = "telemetry-hash-salt"
      }
      env {
        name  = "TELEMETRY_SINK"
        value = "azure"
      }
      env {
        name  = "TELEMETRY_STORAGE_URL"
        value = var.telemetry_storage_url
      }
      env {
        name  = "TELEMETRY_CONTAINER"
        value = var.telemetry_container
      }
      env {
        name  = "AUDIT_CONTAINER"
        value = var.audit_container
      }
      env {
        # Tells DefaultAzureCredential which user-assigned identity to use for Blob access.
        name  = "AZURE_CLIENT_ID"
        value = var.identity_client_id
      }

      liveness_probe {
        transport        = "HTTP"
        path             = local.placeholder ? "/" : "/healthz"
        port             = local.port
        interval_seconds = 15
      }

      readiness_probe {
        transport        = "HTTP"
        path             = local.placeholder ? "/" : "/health/ready"
        port             = local.port
        interval_seconds = 10
      }

      startup_probe {
        transport               = "HTTP"
        path                    = local.placeholder ? "/" : "/healthz"
        port                    = local.port
        interval_seconds        = 5
        failure_count_threshold = 10
      }
    }
  }
}

output "app_name" { value = azurerm_container_app.this.name }
output "fqdn" { value = azurerm_container_app.this.ingress[0].fqdn }
output "environment_default_domain" {
  value = azurerm_container_app_environment.this.default_domain
}
