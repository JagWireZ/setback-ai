output "env" {
  description = "Environment for this stack"
  value       = var.env
}

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

output "frontend_cognito_identity_pool_id" {
  description = "Cognito Identity Pool id for guest frontend credentials"
  value       = aws_cognito_identity_pool.frontend.id
}

output "frontend_unauth_role_arn" {
  description = "IAM role assumed by unauthenticated Cognito identities"
  value       = aws_iam_role.frontend_unauth.arn
}

output "frontend_bucket_name" {
  description = "S3 bucket name hosting the frontend"
  value       = aws_s3_bucket.frontend.id
}

output "frontend_website_url" {
  description = "Public S3 website URL for the frontend"
  value       = aws_s3_bucket_website_configuration.frontend.website_endpoint
}

output "frontend_bucket_public_url" {
  description = "Public HTTPS URL for the frontend index document in the S3 bucket"
  value       = "https://${aws_s3_bucket.frontend.bucket_regional_domain_name}/index.html"
}

output "frontend_domain_name" {
  description = "Custom domain name for the frontend"
  value       = local.frontend_domain_name
}

output "frontend_cloudfront_domain_name" {
  description = "CloudFront distribution domain name for the frontend"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_cloudfront_url" {
  description = "CloudFront URL for the frontend"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "frontend_custom_domain_url" {
  description = "Custom HTTPS URL for the frontend"
  value       = local.frontend_origin
}
