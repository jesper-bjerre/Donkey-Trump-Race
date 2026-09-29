terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm" }
  }
}

variable "name" { type = string }
variable "resource_group_name" { type = string }
variable "tags" { type = map(string) }
variable "sku_name" {
  description = "Standard_AzureFrontDoor (custom rules) or Premium_AzureFrontDoor (adds managed rule sets)."
  type        = string
  default     = "Standard_AzureFrontDoor"
}

# Edge protection for the (optional) Front Door profile. Disabled for the MVP via
# enable_front_door = false; kept here so it can be switched on without new code.
resource "azurerm_cdn_frontdoor_firewall_policy" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  sku_name            = var.sku_name
  enabled             = true
  mode                = "Prevention"
  tags                = var.tags

  custom_rule {
    name                           = "RoomApiRateLimit"
    enabled                        = true
    priority                       = 100
    type                           = "RateLimitRule"
    rate_limit_duration_in_minutes = 1
    rate_limit_threshold           = 120
    action                         = "Block"

    match_condition {
      match_variable = "RequestUri"
      operator       = "Contains"
      match_values   = ["/api/v1/"]
    }
  }

  custom_rule {
    name     = "OnlyExpectedMethods"
    enabled  = true
    priority = 200
    type     = "MatchRule"
    action   = "Block"

    match_condition {
      match_variable     = "RequestMethod"
      operator           = "Equal"
      negation_condition = true
      match_values       = ["GET", "POST", "HEAD", "OPTIONS"]
    }
  }

  dynamic "managed_rule" {
    for_each = var.sku_name == "Premium_AzureFrontDoor" ? [1] : []
    content {
      type    = "Microsoft_DefaultRuleSet"
      version = "2.1"
      action  = "Block"
    }
  }
}

output "policy_id" { value = azurerm_cdn_frontdoor_firewall_policy.this.id }
