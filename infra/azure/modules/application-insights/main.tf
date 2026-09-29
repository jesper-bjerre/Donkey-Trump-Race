terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm" }
    random  = { source = "hashicorp/random" }
  }
}

variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "environment" { type = string }
variable "log_retention_days" { type = number }
variable "alert_email" { type = string }
variable "tags" { type = map(string) }

locals {
  queries_dir = "${path.module}/../../queries"
  queries = {
    join_success_rate     = file("${local.queries_dir}/join-success-rate.kql")
    match_completion_rate = file("${local.queries_dir}/match-completion-rate.kql")
    desync_rate           = file("${local.queries_dir}/desync-correction-rate.kql")
    match_breaking_errors = file("${local.queries_dir}/match-breaking-errors.kql")
    disconnects           = file("${local.queries_dir}/websocket-disconnects.kql")
  }
  telemetry = <<-KQL
    ContainerAppConsoleLogs_CL
    | extend entry = parse_json(Log_s)
    | where tostring(entry.msg) == "telemetry"
    | extend event = tostring(entry.event)
  KQL
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = "${var.name}-law"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_days
  daily_quota_gb      = 1
  tags                = var.tags
}

resource "azurerm_application_insights" "this" {
  name                = "${var.name}-appi"
  location            = var.location
  resource_group_name = var.resource_group_name
  workspace_id        = azurerm_log_analytics_workspace.this.id
  application_type    = "Node.JS"
  tags                = var.tags
}

resource "azurerm_monitor_action_group" "ops" {
  name                = "${var.name}-ops"
  resource_group_name = var.resource_group_name
  short_name          = "dtrops"
  tags                = var.tags

  dynamic "email_receiver" {
    for_each = var.alert_email == "" ? [] : [var.alert_email]
    content {
      name                    = "ops-email"
      email_address           = email_receiver.value
      use_common_alert_schema = true
    }
  }
}

locals {
  alerts = {
    match-breaking-errors = {
      description = "A match ended early because of an unrecoverable server error."
      severity    = 1
      window      = "PT15M"
      query       = "${local.telemetry}| where event == \"match_breaking_error\""
      threshold   = 0
    }
    websocket-disconnect-spike = {
      description = "Unusually many realtime disconnects (network or server trouble)."
      severity    = 2
      window      = "PT5M"
      query       = "${local.telemetry}| where event == \"disconnect\""
      threshold   = 50
    }
    join-failures = {
      description = "More than 10% of join attempts failed in the last hour (at least 10 attempts)."
      severity    = 2
      window      = "PT1H"
      query       = <<-KQL
        ${local.telemetry}| where event in ("join_attempt", "join_failure")
        | summarize attempts = countif(event == "join_attempt"), failures = countif(event == "join_failure")
        | where attempts >= 10 and todouble(failures) / attempts > 0.1
      KQL
      threshold   = 0
    }
    match-completion = {
      description = "Fewer than 80% of matches started in the last hour reached a rescue (at least 5 started)."
      severity    = 2
      window      = "PT1H"
      query       = <<-KQL
        ${local.telemetry}| where event in ("match_start", "match_end")
        | summarize started = countif(event == "match_start"),
                    completed = countif(event == "match_end" and tostring(entry.outcome) == "completed" and toint(entry.finishers) > 0)
        | where started >= 5 and todouble(completed) / started < 0.8
      KQL
      threshold   = 0
    }
    desync-rate = {
      description = "More than 5% of matches in the last hour had a major prediction correction."
      severity    = 3
      window      = "PT1H"
      query       = <<-KQL
        ${local.telemetry}| where event in ("match_start", "desync_correction")
        | summarize started = dcountif(tostring(entry.matchId), event == "match_start"),
                    desynced = dcountif(tostring(entry.matchId), event == "desync_correction" and tostring(entry.severity) == "major")
        | where started >= 5 and todouble(desynced) / started > 0.05
      KQL
      threshold   = 0
    }
  }
}

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "this" {
  for_each             = local.alerts
  name                 = "${var.name}-${each.key}"
  location             = var.location
  resource_group_name  = var.resource_group_name
  description          = each.value.description
  severity             = each.value.severity
  scopes               = [azurerm_log_analytics_workspace.this.id]
  evaluation_frequency = each.value.window == "PT1H" ? "PT15M" : "PT5M"
  window_duration      = each.value.window
  # The container log table only appears after the first deployment writes logs.
  skip_query_validation = true
  tags                  = var.tags

  criteria {
    query                   = each.value.query
    time_aggregation_method = "Count"
    operator                = "GreaterThan"
    threshold               = each.value.threshold
    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }

  action {
    action_groups = [azurerm_monitor_action_group.ops.id]
  }
}

resource "random_uuid" "workbook" {}

resource "azurerm_application_insights_workbook" "beta" {
  name                = random_uuid.workbook.result
  location            = var.location
  resource_group_name = var.resource_group_name
  display_name        = "Donkey Trump Race beta operations (${var.environment})"
  source_id           = lower(azurerm_log_analytics_workspace.this.id)
  tags                = var.tags
  data_json = jsonencode({
    version = "Notebook/1.0"
    items = concat(
      [{
        type = 1
        name = "intro"
        content = {
          json = "## Closed-beta health\nTelemetry mirrored from the game server logs. Targets: join success >= 90%, match completion >= 80%, match-breaking errors < 2%, desync < 5%."
        }
      }],
      [for key, query in local.queries : {
        type = 3
        name = key
        content = {
          version       = "KqlItem/1.0"
          query         = query
          size          = 0
          title         = title(replace(key, "_", " "))
          timeContext   = { durationMs = 604800000 }
          queryType     = 0
          resourceType  = "microsoft.operationalinsights/workspaces"
          visualization = can(regex("rate", key)) ? "timechart" : "table"
        }
      }],
    )
    isLocked = false
  })
}

output "log_analytics_workspace_id" { value = azurerm_log_analytics_workspace.this.id }
output "application_insights_connection_string" {
  value     = azurerm_application_insights.this.connection_string
  sensitive = true
}
output "workbook_id" { value = azurerm_application_insights_workbook.beta.id }
