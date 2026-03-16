terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
  bucket               = "ctk-tfstate"
  key                  = "terraform.tfstate"
  region               = "us-east-1"
  profile               = var.aws_profile
  use_lockfile         = true
  workspace_key_prefix = "setback"
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
