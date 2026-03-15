variable "aws_region" {
  description = "AWS region for infrastructure resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Optional named AWS CLI profile to use for Terraform operations"
  type        = string
  default     = ""
}

variable "env" {
  description = "Environment for this stack"
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "prod"], var.env)
    error_message = "env must be either \"staging\" or \"prod\"."
  }
}

variable "lambda_function_name" {
  description = "Base name of the backend Lambda function"
  type        = string
  default     = "setback-backend"
}

variable "dynamodb_table_name" {
  description = "Base name of the DynamoDB table for game state"
  type        = string
  default     = "setback-game"
}

variable "frontend_allowed_origins" {
  description = "Allowed browser origins for Lambda Function URL CORS"
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "frontend_bucket_name" {
  description = "Optional base name for the frontend S3 bucket. Leave empty for an environment-scoped auto-generated name."
  type        = string
  default     = ""
}
