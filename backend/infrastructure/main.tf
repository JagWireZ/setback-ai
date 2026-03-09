provider "aws" {
  region  = var.aws_region
}

locals {
  dist_files = fileset("${path.module}/../dist", "**")
  dist_hash = sha256(
    join("", [for file in local.dist_files : filesha256("${path.module}/../dist/${file}")]),
  )
}

data "archive_file" "lambda_package" {
  type        = "zip"
  source_dir  = "${path.module}/.."
  output_path = "/tmp/setback-backend-lambda-${local.dist_hash}.zip"

  excludes = [
    ".git",
    "infrastructure",
    "test",
    "src",
    "engine",
    "db",
    "*.ts",
    "tsconfig.json"
  ]
}

resource "aws_dynamodb_table" "setback_game" {
  name         = var.dynamodb_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_execution" {
  name               = "${var.lambda_function_name}-execution-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "lambda_dynamodb_access" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:TransactWriteItems",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan"
    ]
    resources = [aws_dynamodb_table.setback_game.arn]
  }
}

resource "aws_iam_policy" "lambda_dynamodb_access" {
  name   = "${var.lambda_function_name}-dynamodb-policy"
  policy = data.aws_iam_policy_document.lambda_dynamodb_access.json
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb_access" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.lambda_dynamodb_access.arn
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.lambda_function_name}"
  retention_in_days = 14
}

resource "aws_lambda_function" "backend" {
  function_name = var.lambda_function_name
  role          = aws_iam_role.lambda_execution.arn
  runtime       = "nodejs22.x"
  description   = "setback-backend-${substr(local.dist_hash, 0, 12)}"

  # TypeScript compiles to dist/backend/src/handler.js in this project.
  handler = "dist/backend/src/handler.handler"

  filename         = data.archive_file.lambda_package.output_path
  source_code_hash = data.archive_file.lambda_package.output_base64sha256
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.setback_game.name
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy_attachment.lambda_dynamodb_access,
    aws_cloudwatch_log_group.lambda
  ]
}

resource "aws_lambda_function_url" "backend" {
  function_name      = aws_lambda_function.backend.function_name
  authorization_type = "AWS_IAM"

  cors {
    allow_origins = var.frontend_allowed_origins
    allow_methods = ["POST", "OPTIONS"]
    allow_headers = [
      "content-type",
      "authorization",
      "x-amz-date",
      "x-amz-security-token",
      "x-amz-content-sha256"
    ]
    max_age = 3600
  }
}

resource "aws_iam_user" "frontend_lambda_invoker" {
  name = "${var.lambda_function_name}-frontend-invoker"
}

data "aws_iam_policy_document" "frontend_lambda_invoke_url" {
  statement {
    effect = "Allow"
    actions = [
      "lambda:InvokeFunctionUrl"
    ]
    resources = [aws_lambda_function.backend.arn]

    condition {
      test     = "StringEquals"
      variable = "lambda:FunctionUrlAuthType"
      values   = ["AWS_IAM"]
    }
  }
}

resource "aws_iam_user_policy" "frontend_lambda_invoke_url" {
  name   = "${var.lambda_function_name}-invoke-url"
  user   = aws_iam_user.frontend_lambda_invoker.name
  policy = data.aws_iam_policy_document.frontend_lambda_invoke_url.json
}

resource "aws_iam_access_key" "frontend_lambda_invoker" {
  user = aws_iam_user.frontend_lambda_invoker.name
}

resource "aws_lambda_permission" "allow_frontend_invoker_function_url" {
  statement_id             = "AllowFrontendInvokerFunctionUrl"
  action                   = "lambda:InvokeFunctionUrl"
  function_name            = aws_lambda_function.backend.function_name
  principal                = aws_iam_user.frontend_lambda_invoker.arn
  function_url_auth_type   = "AWS_IAM"
}
