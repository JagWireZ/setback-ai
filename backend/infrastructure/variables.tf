variable "aws_region" {
  description = "AWS region for infrastructure resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Named AWS CLI profile to use for Terraform operations"
  type        = string
  default     = "default"
}

variable "lambda_function_name" {
  description = "Name of the backend Lambda function"
  type        = string
  default     = "setback-backend"
}

variable "dynamodb_table_name" {
  description = "Name of the DynamoDB table for game state"
  type        = string
  default     = "setback-game"
}

variable "frontend_allowed_origins" {
  description = "Allowed browser origins for Lambda Function URL CORS"
  type        = list(string)
  default     = ["http://localhost:5173"]
}
