#!/bin/bash
set -e

GCLOUD="/opt/homebrew/share/google-cloud-sdk/bin/gcloud"
RANDOM_SUFFIX=$(date +%s)
PROJECT_ID="gcal-notion-sync-$RANDOM_SUFFIX"
SA_NAME="gcal-sync-bot"

echo "Creating project $PROJECT_ID..."
$GCLOUD projects create $PROJECT_ID --name="GCal Notion Sync" --quiet

echo "Setting default project..."
$GCLOUD config set project $PROJECT_ID --quiet

echo "Enabling Google Calendar API..."
$GCLOUD services enable calendar-json.googleapis.com --quiet

echo "Creating Service Account..."
$GCLOUD iam service-accounts create $SA_NAME --display-name="GCal Sync Bot" --quiet

echo "Creating JSON Key..."
$GCLOUD iam service-accounts keys create service-account.json \
    --iam-account=$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com --quiet

echo "Setup Complete."
echo "Service Account Email: $SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
