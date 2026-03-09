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
  description = "Lambda function URL (AWS_IAM authenticated)"
  value       = aws_lambda_function_url.backend.function_url
}

output "frontend_lambda_invoker_access_key_id" {
  description = "Access key id for frontend Lambda URL invoker"
  value       = aws_iam_access_key.frontend_lambda_invoker.id
  sensitive   = true
}

output "frontend_lambda_invoker_secret_access_key" {
  description = "Secret access key for frontend Lambda URL invoker"
  value       = aws_iam_access_key.frontend_lambda_invoker.secret
  sensitive   = true
}

output "frontend_bucket_name" {
  description = "S3 bucket name hosting the frontend"
  value       = aws_s3_bucket.frontend.id
}

output "frontend_website_url" {
  description = "Public S3 website URL for the frontend"
  value       = aws_s3_bucket_website_configuration.frontend.website_endpoint
}
