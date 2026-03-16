terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    key          = "setback/terraform.tfstate"
    use_lockfile = true
    bucket = "ctk-tfstate"
    region = "us-east-1"
    profile = var.aws_profile
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.5"
    }
  }
}
