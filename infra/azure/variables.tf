variable "environment" {
  description = "Deployment environment."
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be dev, staging or production."
  }
}

variable "location" {
  description = "Azure region for every resource (single-region MVP)."
  type        = string
  default     = "westeurope"
}

variable "name_prefix" {
  description = "Short prefix used in resource names."
  type        = string
  default     = "dtr"
  validation {
    condition     = can(regex("^[a-z][a-z0-9]{1,7}$", var.name_prefix))
    error_message = "name_prefix must be 2-8 lowercase letters/digits starting with a letter."
  }
}

variable "resource_group_name" {
  description = "Existing resource group for this environment (created by infra/azure/bootstrap)."
  type        = string
}

variable "container_image" {
  description = "Full image reference to run, e.g. <acr>.azurecr.io/donkey-trump-race:<git-sha>. Empty uses a public placeholder until the first deploy."
  type        = string
  default     = ""
}

variable "container_cpu" {
  description = "vCPU for the game server container."
  type        = number
  default     = 1
}

variable "container_memory" {
  description = "Memory for the game server container (must match the CPU ratio, e.g. 2Gi for 1 vCPU)."
  type        = string
  default     = "2Gi"
}

variable "max_replicas" {
  description = "Rooms live in memory, so the MVP runs exactly one replica until rooms are sharded."
  type        = number
  default     = 1
  validation {
    condition     = var.max_replicas == 1
    error_message = "Active rooms are held in memory; scaling beyond one replica needs room affinity first."
  }
}

variable "telemetry_retention_days" {
  description = "Days to keep telemetry JSONL and match summaries."
  type        = number
  default     = 90
  validation {
    condition     = var.telemetry_retention_days >= 30 && var.telemetry_retention_days <= 365
    error_message = "telemetry_retention_days must be between 30 and 365."
  }
}

variable "audit_retention_days" {
  description = "Days audit records are immutable and retained."
  type        = number
  default     = 365
  validation {
    condition     = var.audit_retention_days >= 365
    error_message = "Audit records must be kept for at least 365 days."
  }
}

variable "privacy_request_retention_days" {
  description = "Days to keep GDPR request records (resolution plus the compliance window)."
  type        = number
  default     = 730
  validation {
    condition     = var.privacy_request_retention_days >= 90
    error_message = "privacy_request_retention_days must be at least 90."
  }
}

variable "beta_report_retention_days" {
  description = "Days to keep beta evidence summaries."
  type        = number
  default     = 365
}

variable "log_retention_days" {
  description = "Log Analytics retention for container logs and telemetry mirrors."
  type        = number
  default     = 30
}

variable "extra_allowed_origins" {
  description = "Additional browser origins (e.g. a custom domain) allowed for REST CORS and WebSocket upgrades. The Container App URL is always allowed."
  type        = list(string)
  default     = []
}

variable "alert_email" {
  description = "Optional e-mail address for alert notifications."
  type        = string
  default     = ""
}

variable "enable_front_door" {
  description = "Put Azure Front Door (CDN + WAF) in front of the app. Off for the MVP; the Container App ingress serves HTTPS directly."
  type        = bool
  default     = false
}

variable "key_vault_purge_protection" {
  description = "Enable purge protection on Key Vault (recommended for production; cannot be disabled later)."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Extra tags applied to every resource."
  type        = map(string)
  default     = {}
}
