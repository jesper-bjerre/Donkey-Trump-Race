output "app_url" {
  description = "Public HTTPS URL of the game (Container Apps ingress, or Front Door when enabled)."
  value       = var.enable_front_door ? "https://${module.cdn[0].endpoint_host_name}" : "https://${module.container_apps.fqdn}"
}

output "container_app_name" {
  description = "Container App name (used by the deploy workflow)."
  value       = module.container_apps.app_name
}

output "container_app_fqdn" {
  description = "Container App ingress host name."
  value       = module.container_apps.fqdn
}

output "acr_login_server" {
  description = "Registry the deploy workflow pushes images to."
  value       = module.container_registry.login_server
}

output "acr_name" {
  description = "Registry resource name (for `az acr login`)."
  value       = module.container_registry.name
}

output "key_vault_uri" {
  description = "Key Vault URI holding the room token signing key and telemetry hash salt."
  value       = module.key_vault.uri
}

output "storage_account_name" {
  description = "Storage account for telemetry, audit, privacy requests and beta reports."
  value       = module.blob_storage.account_name
}

output "telemetry_blob_endpoint" {
  description = "Blob endpoint used by the server and by `pnpm beta:summary -- --source azure:<url>`."
  value       = module.blob_storage.blob_endpoint
}

output "log_analytics_workspace_id" {
  description = "Workspace receiving container logs and telemetry mirrors."
  value       = module.application_insights.log_analytics_workspace_id
}

output "workbook_id" {
  description = "Beta operations workbook (dashboard)."
  value       = module.application_insights.workbook_id
}
