provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile != "" ? var.aws_profile : null
}

data "aws_caller_identity" "current" {}

locals {
  env                  = var.env
  lambda_function_name = "${var.lambda_function_name}-${local.env}"
  dynamodb_table_name  = "${var.dynamodb_table_name}-${local.env}"
  frontend_dist_dir    = "${path.module}/../dist"

  backend_source_files = concat(
    [for file in fileset("${path.module}/../backend/src", "**/*.ts") : "backend/src/${file}"],
    [for file in fileset("${path.module}/../backend/engine", "**/*.ts") : "backend/engine/${file}"],
    [for file in fileset("${path.module}/../backend/db", "**/*.ts") : "backend/db/${file}"],
    [for file in fileset("${path.module}/../shared/types", "**/*.ts") : "shared/types/${file}"],
    [
      "backend/package.json",
      "backend/package-lock.json",
      "backend/tsconfig.json"
    ]
  )

  backend_source_hash = sha256(
    join("", [for file in local.backend_source_files : filesha256("${path.module}/../${file}")]),
  )

  frontend_bucket_name = var.frontend_bucket_name != "" ? "${var.frontend_bucket_name}-${local.env}" : null
  frontend_dist_files  = try(fileset(local.frontend_dist_dir, "**"), [])

  frontend_content_types = {
    ".css"  = "text/css"
    ".gif"  = "image/gif"
    ".html" = "text/html"
    ".ico"  = "image/x-icon"
    ".jpeg" = "image/jpeg"
    ".jpg"  = "image/jpeg"
    ".js"   = "application/javascript"
    ".json" = "application/json"
    ".map"  = "application/json"
    ".png"  = "image/png"
    ".svg"  = "image/svg+xml"
    ".txt"  = "text/plain"
    ".webp" = "image/webp"
  }
}

data "archive_file" "lambda_package" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "/tmp/setback-backend-lambda-${local.backend_source_hash}.zip"

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
  name         = local.dynamodb_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"
  deletion_protection_enabled = false

  attribute {
    name = "id"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
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
  name               = "${local.lambda_function_name}-execution-role"
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
  name   = "${local.lambda_function_name}-dynamodb-policy"
  policy = data.aws_iam_policy_document.lambda_dynamodb_access.json
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb_access" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.lambda_dynamodb_access.arn
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.lambda_function_name}"
  retention_in_days = 14
}

resource "aws_lambda_function" "backend" {
  function_name = local.lambda_function_name
  role          = aws_iam_role.lambda_execution.arn
  runtime       = "nodejs22.x"
  description   = "${local.lambda_function_name}-${substr(local.backend_source_hash, 0, 12)}"
  skip_destroy  = false

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
    allow_origins = distinct(concat(
      var.frontend_allowed_origins,
      ["https://${aws_s3_bucket.frontend.bucket_regional_domain_name}"],
    ))
    allow_methods = ["POST"]
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

resource "aws_cognito_identity_pool" "frontend" {
  identity_pool_name               = "${local.lambda_function_name}-frontend-guests"
  allow_unauthenticated_identities = true
}

data "aws_iam_policy_document" "frontend_unauth_assume_role" {
  statement {
    effect = "Allow"

    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = ["cognito-identity.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "cognito-identity.amazonaws.com:aud"
      values   = [aws_cognito_identity_pool.frontend.id]
    }

    condition {
      test     = "ForAnyValue:StringLike"
      variable = "cognito-identity.amazonaws.com:amr"
      values   = ["unauthenticated"]
    }
  }
}

resource "aws_iam_role" "frontend_unauth" {
  name               = "${local.lambda_function_name}-frontend-unauth"
  assume_role_policy = data.aws_iam_policy_document.frontend_unauth_assume_role.json
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

  statement {
    effect = "Allow"
    actions = [
      "lambda:InvokeFunction"
    ]
    resources = [aws_lambda_function.backend.arn]

    condition {
      test     = "Bool"
      variable = "lambda:InvokedViaFunctionUrl"
      values   = ["true"]
    }
  }
}

resource "aws_iam_role_policy" "frontend_lambda_invoke_url" {
  name   = "${var.lambda_function_name}-invoke-url"
  role   = aws_iam_role.frontend_unauth.id
  policy = data.aws_iam_policy_document.frontend_lambda_invoke_url.json
}

resource "aws_cognito_identity_pool_roles_attachment" "frontend" {
  identity_pool_id = aws_cognito_identity_pool.frontend.id
  roles = {
    unauthenticated = aws_iam_role.frontend_unauth.arn
  }
}

resource "aws_lambda_permission" "allow_frontend_invoker_function_url" {
  statement_id           = "AllowFrontendInvokerFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.backend.function_name
  principal              = data.aws_caller_identity.current.account_id
  function_url_auth_type = "AWS_IAM"
}

resource "aws_s3_bucket" "frontend" {
  bucket        = local.frontend_bucket_name
  bucket_prefix = local.frontend_bucket_name == null ? "setback-frontend-${local.env}-" : null
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

data "aws_iam_policy_document" "frontend_public_read" {
  statement {
    effect = "Allow"
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    actions = ["s3:GetObject"]
    resources = [
      "${aws_s3_bucket.frontend.arn}/*"
    ]
  }
}

resource "aws_s3_bucket_policy" "frontend_public_read" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend_public_read.json

  depends_on = [aws_s3_bucket_public_access_block.frontend]
}

resource "aws_s3_object" "frontend_dist" {
  for_each = { for file in local.frontend_dist_files : file => file }

  bucket = aws_s3_bucket.frontend.id
  key    = each.value
  source = "${local.frontend_dist_dir}/${each.value}"
  etag   = filemd5("${local.frontend_dist_dir}/${each.value}")

  content_type = lookup(
    local.frontend_content_types,
    lower(try(regex("\\.[^.]+$", each.value), "")),
    "application/octet-stream",
  )

  depends_on = [aws_s3_bucket_policy.frontend_public_read]
}
