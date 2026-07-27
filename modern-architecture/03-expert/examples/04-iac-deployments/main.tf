# Terraform — Lambda + API Gateway HTTP API (ย่อส่วนสำคัญ)
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "ap-southeast-1"
}

variable "function_name" {
  type    = string
  default = "bootcamp-checkout"
}

# แพ็กเกจโค้ด (สมมติสร้าง zip ภายนอก)
resource "aws_lambda_function" "checkout" {
  function_name = var.function_name
  role          = aws_iam_role.lambda.arn
  handler       = "handler.checkout"
  runtime       = "nodejs20.x"
  filename      = "${path.module}/build/checkout.zip"
  timeout       = 10
  memory_size   = 256

  environment {
    variables = {
      STAGE = "dev"
    }
  }

  tracing_config {
    mode = "Active"
  }
}

resource "aws_iam_role" "lambda" {
  name = "${var.function_name}-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.function_name}-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_headers = ["content-type", "authorization", "x-correlation-id"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_origins = ["*"]
  }
}

resource "aws_apigatewayv2_integration" "checkout" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.checkout.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "checkout" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /checkout"
  target    = "integrations/${aws_apigatewayv2_integration.checkout.id}"
}

# Multi-region แนวคิด: duplicate stack คนละ region + Route53 failover/latency policy
# Canary: aws_lambda_alias + aws_lambda_provisioned_concurrency_config + weighted alias
