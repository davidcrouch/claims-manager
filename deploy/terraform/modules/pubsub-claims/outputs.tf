output "topic_names" {
  description = "Map of domain → topic name"
  value       = { for k, m in module.topic : k => m.name }
}

output "dlq_topic_names" {
  description = "Map of domain → DLQ topic name"
  value       = { for k, m in module.dlq_topic : k => m.name }
}

output "topic_ids" {
  description = "Map of domain → topic ID"
  value       = { for k, m in module.topic : k => m.id }
}
