"""Service for managing document storage in AWS S3."""

import boto3
import logging
from typing import Optional
from botocore.exceptions import ClientError
import os

_logger = logging.getLogger(__name__)


class S3Service:
    """Service for uploading and downloading documents to/from S3."""
    
    def __init__(self):
        """Initialize S3 client using EC2 instance IAM role credentials."""
        self.s3_client = boto3.client('s3')
        self.bucket_name = os.getenv('S3_BUCKET_NAME', 'estate-docs-storage')
        self.region = os.getenv('AWS_REGION', 'us-east-2')
    
    def upload_markdown(self, content: str, document_id: int, user_id: int) -> str:
        """
        Upload markdown content to S3.
        
        Args:
            content: Markdown content to upload
            document_id: ID of the generated document
            user_id: ID of the user who generated the document
            
        Returns:
            S3 key where the content was stored
        """
        s3_key = f"documents/user_{user_id}/doc_{document_id}.md"
        
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=content.encode('utf-8'),
                ContentType='text/markdown',
                ServerSideEncryption='AES256'
            )
            _logger.info(f"Uploaded markdown to S3: {s3_key}")
            return s3_key
        except ClientError as e:
            _logger.error(f"Failed to upload to S3: {e}")
            raise Exception(f"Failed to upload document to S3: {str(e)}")
    
    def download_markdown(self, s3_key: str) -> str:
        """
        Download markdown content from S3.
        
        Args:
            s3_key: S3 key of the document
            
        Returns:
            Markdown content as string
        """
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            content = response['Body'].read().decode('utf-8')
            _logger.info(f"Downloaded markdown from S3: {s3_key}")
            return content
        except ClientError as e:
            _logger.error(f"Failed to download from S3: {e}")
            raise Exception(f"Failed to download document from S3: {str(e)}")
    
    def delete_document(self, s3_key: str) -> bool:
        """
        Delete a document from S3.
        
        Args:
            s3_key: S3 key of the document to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            _logger.info(f"Deleted document from S3: {s3_key}")
            return True
        except ClientError as e:
            _logger.error(f"Failed to delete from S3: {e}")
            return False
    
    def create_bucket_if_not_exists(self) -> bool:
        """
        Create the S3 bucket if it doesn't exist.
        
        Returns:
            True if bucket exists or was created successfully
        """
        try:
            # Check if bucket exists
            self.s3_client.head_bucket(Bucket=self.bucket_name)
            _logger.info(f"S3 bucket {self.bucket_name} already exists")
            return True
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                # Bucket doesn't exist, create it
                try:
                    if self.region == 'us-east-1':
                        self.s3_client.create_bucket(Bucket=self.bucket_name)
                    else:
                        self.s3_client.create_bucket(
                            Bucket=self.bucket_name,
                            CreateBucketConfiguration={'LocationConstraint': self.region}
                        )
                    
                    # Enable versioning
                    self.s3_client.put_bucket_versioning(
                        Bucket=self.bucket_name,
                        VersioningConfiguration={'Status': 'Enabled'}
                    )
                    
                    # Enable encryption
                    self.s3_client.put_bucket_encryption(
                        Bucket=self.bucket_name,
                        ServerSideEncryptionConfiguration={
                            'Rules': [
                                {
                                    'ApplyServerSideEncryptionByDefault': {
                                        'SSEAlgorithm': 'AES256'
                                    }
                                }
                            ]
                        }
                    )
                    
                    _logger.info(f"Created S3 bucket {self.bucket_name}")
                    return True
                except ClientError as create_error:
                    _logger.error(f"Failed to create S3 bucket: {create_error}")
                    return False
            else:
                _logger.error(f"Error checking S3 bucket: {e}")
                return False


# Singleton instance
s3_service = S3Service()
