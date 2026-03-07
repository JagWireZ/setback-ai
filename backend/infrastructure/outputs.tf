output "lambda_function_name" {
  description = "Deployed Lambda function name"
  value       = aws_lambda_function.backend.function_name
}

output "lambda_function_arn" {
  description = "Deployed Lambda function ARN"
  value       = aws_lambda_function.backend.arn
}

output "dynamodb_table_name" {
  description = "DynamoDB table name used by the backend"
  value       = aws_dynamodb_table.setback_game.name
}

output "dynamodb_table_arn" {
  description = "DynamoDB table ARN"
  value       = aws_dynamodb_table.setback_game.arn
}

output "lambda_function_url" {
  description = "Public Lambda function URL"
  value       = aws_lambda_function_url.backend.function_url
}
