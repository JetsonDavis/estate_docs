# AWS S3 Setup for Estate Docs

This document describes the AWS IAM permissions needed for the Estate Docs application to store document content in S3.

## Overview

The application stores generated document markdown content in AWS S3 instead of the PostgreSQL database to reduce database size and improve performance.

## S3 Bucket Configuration

- **Bucket Name**: `estate-docs-storage` (configurable via `S3_BUCKET_NAME` env var)
- **Region**: `us-east-2` (configurable via `AWS_REGION` env var)
- **Encryption**: Server-side encryption with AES256
- **Versioning**: Enabled
- **Access**: Private (no public access)

## Required IAM Permissions

The EC2 instance running the application needs an IAM role with the following permissions:

### IAM Policy JSON

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3BucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:GetBucketVersioning",
        "s3:PutBucketVersioning",
        "s3:GetBucketEncryption",
        "s3:PutBucketEncryption"
      ],
      "Resource": "arn:aws:s3:::estate-docs-storage"
    },
    {
      "Sid": "S3ObjectAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::estate-docs-storage/*"
    }
  ]
}
```

### Permissions Breakdown

1. **Bucket-level permissions** (`s3:CreateBucket`, `s3:ListBucket`, etc.):
   - Create the bucket if it doesn't exist
   - Configure bucket versioning
   - Configure bucket encryption
   - List objects in the bucket

2. **Object-level permissions** (`s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`):
   - Upload markdown files to S3
   - Download markdown files from S3
   - Delete markdown files from S3

## Setup Instructions

### 1. Create IAM Policy

1. Go to AWS IAM Console → Policies
2. Click "Create Policy"
3. Choose JSON tab
4. Paste the policy JSON above
5. Name it: `EstateDocs-S3-Access`
6. Click "Create Policy"

### 2. Attach Policy to EC2 Instance Role

1. Go to AWS IAM Console → Roles
2. Find your EC2 instance role (or create one if it doesn't exist)
3. Click "Attach policies"
4. Search for `EstateDocs-S3-Access`
5. Select and attach the policy

### 3. Attach Role to EC2 Instance

1. Go to AWS EC2 Console
2. Select your instance
3. Actions → Security → Modify IAM role
4. Select the role with the S3 policy attached
5. Click "Update IAM role"

### 4. Configure Environment Variables (Optional)

Add to your `.env` file if you want to customize:

```bash
# S3 Configuration
S3_BUCKET_NAME=estate-docs-storage
AWS_REGION=us-east-2
```

## File Structure in S3

Documents are stored with the following key pattern:

```
documents/user_{user_id}/doc_{document_id}.md
```

Example:
```
documents/user_123/doc_456.md
```

## Testing

After setup, the application will:

1. Automatically create the S3 bucket on first document generation (if it doesn't exist)
2. Upload markdown content to S3 when generating documents
3. Download markdown content from S3 when listing/viewing documents
4. Delete from S3 when documents are deleted

## Troubleshooting

### Permission Denied Errors

If you see errors like "Access Denied" or "403 Forbidden":

1. Verify the IAM policy is attached to the EC2 instance role
2. Check the bucket name matches the policy ARN
3. Ensure the EC2 instance has the role attached
4. Wait a few minutes for IAM changes to propagate

### Bucket Already Exists

If the bucket name is already taken globally:

1. Choose a different bucket name
2. Update `S3_BUCKET_NAME` in your `.env` file
3. Update the IAM policy ARN to match the new bucket name

### Credentials Not Found

The application uses the EC2 instance's IAM role for credentials. If you see "credentials not found":

1. Ensure the EC2 instance has an IAM role attached
2. The boto3 library will automatically use the instance role credentials
3. No need to configure AWS access keys manually

## Migration from Database Storage

For existing documents stored in the database:

1. The migration makes `markdown_content` nullable
2. New documents will use S3 storage
3. Old documents will continue to work with database storage
4. You can optionally migrate old documents to S3 with a data migration script

## Security Considerations

- ✅ All objects are encrypted at rest with AES256
- ✅ Bucket versioning is enabled for data recovery
- ✅ No public access to the bucket
- ✅ IAM role-based authentication (no hardcoded credentials)
- ✅ Principle of least privilege (only necessary permissions granted)
