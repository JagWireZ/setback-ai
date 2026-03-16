provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile != "" ? var.aws_profile : null
}

data "aws_caller_identity" "current" {}

data "aws_route53_zone" "frontend" {
  name         = var.domain
  private_zone = false
}

locals {
  env                  = var.env
  lambda_function_name = "${var.lambda_function_name}-${local.env}"
  dynamodb_table_name  = "${var.dynamodb_table_name}-${local.env}"
  frontend_dist_dir    = "${path.module}/../dist"
  frontend_subdomain   = local.env == "prod" ? "setback" : "staging.setback"
  frontend_domain_name = "${local.frontend_subdomain}.${var.domain}"
  frontend_origin      = "https://${local.frontend_domain_name}"

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

  frontend_source_files = concat(
    [for file in fileset("${path.module}/../src", "**/*") : "src/${file}"],
    [for file in fileset("${path.module}/../public", "**/*") : "public/${file}"],
    [
      "index.html",
      "package.json",
      "package-lock.json",
      "vite.config.js",
      "tailwind.config.js",
      "postcss.config.js"
    ]
  )

  frontend_source_hash = sha256(
    join("", [for file in local.frontend_source_files : filesha256("${path.module}/../${file}")]),
  )

  frontend_bucket_name = var.frontend_bucket_name != "" ? "${var.frontend_bucket_name}-${local.env}" : null

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

resource "terraform_data" "build_backend" {
  triggers_replace = {
    source_hash = local.backend_source_hash
  }

  provisioner "local-exec" {
    working_dir = "${path.module}/.."
    command     = "npm --prefix ./backend run build"
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

  depends_on = [terraform_data.build_backend]

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
      [local.frontend_origin],
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

resource "aws_acm_certificate" "frontend" {
  domain_name       = local.frontend_domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "frontend_certificate_validation" {
  for_each = {
    for option in aws_acm_certificate.frontend.domain_validation_options :
    option.domain_name => {
      name   = option.resource_record_name
      record = option.resource_record_value
      type   = option.resource_record_type
    }
  }

  zone_id = data.aws_route53_zone.frontend.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "frontend" {
  certificate_arn         = aws_acm_certificate.frontend.arn
  validation_record_fqdns = [for record in aws_route53_record.frontend_certificate_validation : record.fqdn]
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.frontend_domain_name} frontend"
  default_root_object = "index.html"
  aliases             = [local.frontend_domain_name]

  origin {
    domain_name = aws_s3_bucket_website_configuration.frontend.website_endpoint
    origin_id   = "frontend-s3-website"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "frontend-s3-website"

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.frontend.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  depends_on = [aws_acm_certificate_validation.frontend]
}

resource "aws_route53_record" "frontend_cname" {
  zone_id = data.aws_route53_zone.frontend.zone_id
  name    = local.frontend_domain_name
  type    = "CNAME"
  ttl     = 300
  records = [aws_cloudfront_distribution.frontend.domain_name]
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

resource "terraform_data" "build_frontend" {
  triggers_replace = {
    source_hash      = local.frontend_source_hash
    backend_url      = aws_lambda_function_url.backend.function_url
    identity_pool_id = aws_cognito_identity_pool.frontend.id
    app_env          = local.env
  }

  provisioner "local-exec" {
    working_dir = "${path.module}/.."
    command     = "npm run build:frontend"

    environment = {
      VITE_BACKEND_URL              = aws_lambda_function_url.backend.function_url
      VITE_COGNITO_IDENTITY_POOL_ID = aws_cognito_identity_pool.frontend.id
      VITE_AWS_REGION               = var.aws_region
      VITE_APP_ENV                  = local.env == "staging" ? "staging" : ""
    }
  }

  depends_on = [
    aws_lambda_function_url.backend,
    aws_cognito_identity_pool.frontend,
    aws_s3_bucket.frontend,
  ]
}

resource "terraform_data" "deploy_frontend" {
  triggers_replace = {
    source_hash     = local.frontend_source_hash
    bucket          = aws_s3_bucket.frontend.id
    distribution_id = aws_cloudfront_distribution.frontend.id
  }

  provisioner "local-exec" {
    working_dir = "${path.module}/.."
    command     = "node ./scripts/deploy-frontend.mjs"

    environment = {
      AWS_REGION                 = var.aws_region
      AWS_PROFILE                = var.aws_profile != "" ? var.aws_profile : ""
      FRONTEND_BUCKET            = aws_s3_bucket.frontend.id
      CLOUDFRONT_DISTRIBUTION_ID = aws_cloudfront_distribution.frontend.id
    }
  }

  depends_on = [
    terraform_data.build_frontend,
    aws_s3_bucket_policy.frontend_public_read,
    aws_cloudfront_distribution.frontend,
  ]
}
