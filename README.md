# FreeSync - Obsidian Vault Sync with Cloudflare R2

FreeSync is an Obsidian plugin that syncs your vault using Cloudflare R2 as the storage backend.

## Setup Instructions

### 1. Create a Cloudflare R2 Bucket

1. Log in to your Cloudflare account
2. Navigate to `R2` in the sidebar
3. Click "Create bucket"
4. Name your bucket (e.g., "free-sync")
5. Click "Create bucket" to finish

### 2. Create R2 API Tokens

1. In R2, click on "Manage R2 API Tokens"
2. Click "Create API Token"
3. Choose a name for your token (e.g., "FreeSync Access")
4. Select permissions:
   - Object Read
   - Object Write
   - Bucket Read
   - Bucket Write
5. Click "Create API Token"
6. Save both the `Access Key ID` and `Secret Access Key` - you'll need these later

### 3. Get Your R2 Endpoint

1. In R2, click on your bucket name
2. Look for the "R2 Endpoint" URL
3. It should look like: `https://<account-id>.r2.cloudflarestorage.com`

### 4. Configure the Plugin

1. Open Obsidian Settings
2. Navigate to "FreeSync" in the Community Plugins section
3. Fill in the following fields:
   - **R2 Endpoint**: Your R2 endpoint URL
   - **Access Key ID**: The Access Key ID from step 2
   - **Secret Access Key**: The Secret Access Key from step 2
   - **Bucket Name**: The name of your R2 bucket (e.g., "free-sync")

### 5. Initial Sync

After configuring the plugin:
1. The plugin will automatically attempt an initial sync
2. If you have an existing remote vault, it will download the files
3. If this is a new setup, it will create an initial snapshot

## Usage

- Files are automatically synced when changes are detected
- Use the "Sync Vault" command to manually trigger a sync
- Check the console for detailed sync logs

## Security Note

Your R2 credentials are stored locally in Obsidian's config. Make sure to keep them secure and never share them with others.

## Troubleshooting

If you encounter sync issues:
1. Verify your R2 credentials are correct
2. Check that your bucket name matches exactly
3. Ensure your R2 endpoint URL is correct
4. Look for error messages in the console (Ctrl/Cmd + Shift + I)

## Support

If you encounter any issues or have questions:
1. Check the [GitHub Issues](https://github.com/yourusername/obsidian-free-sync/issues)
2. Create a new issue with detailed information about your problem

## License

[Your chosen license]
