# Entra ID App Registration Setup Guide

This guide will walk you through setting up an Entra ID app registration for the Intune Policy Search Dashboard to connect to Microsoft Graph API.

## Prerequisites

- Microsoft Entra ID tenant with Intune licenses
- Global Administrator or Application Administrator permissions
- Access to Microsoft Entra admin center (https://entra.microsoft.com) or Azure Portal (https://portal.azure.com)

## Step 1: Create App Registration

1. Navigate to the [Microsoft Entra admin center](https://entra.microsoft.com) or [Azure Portal](https://portal.azure.com)
2. Go to **Microsoft Entra ID** > **App registrations**
3. Click **+ New registration**
4. Fill in the registration details:
   - **Name**: `Intune Policy Search Dashboard`
   - **Supported account types**: Select appropriate option:
     - Single tenant: `Accounts in this organizational directory only`
     - Multi-tenant: `Accounts in any organizational directory`
   - **Redirect URI**: 
     - Platform: `Single-page application (SPA)`
     - URI: `http://localhost:8080` (for development)
5. Click **Register**

## Step 2: Configure Authentication

1. In your app registration, go to **Authentication**
2. Under **Single-page application**, ensure your redirect URI is listed
3. For production, add your production domain (e.g., `https://yourdomain.com`)
4. Under **Advanced settings**:
   - **Allow public client flows**: No
   - **Live SDK support**: No

## Step 3: Add API Permissions

1. Go to **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Choose **Delegated permissions**
5. Add the following permissions:
   - `DeviceManagementConfiguration.Read.All`
   - `DeviceManagementApps.Read.All` 
   - `DeviceManagementManagedDevices.Read.All`
   - `User.Read` (usually already present)

6. Click **Add permissions**
7. **Important**: Click **Grant admin consent** for your organization
   - This step requires Global Administrator permissions
   - Without this, users will see consent prompts

## Step 4: Configure Application Settings

1. Go to **Overview** tab
2. Copy the following values for your environment configuration:
   - **Application (client) ID**
   - **Directory (tenant) ID**

## Step 5: Configure Environment Variables

1. Create a `.env` file in your project root
2. Add the following environment variables:

```env
# Replace with your actual values
VITE_AZURE_CLIENT_ID=your-application-client-id-here
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/your-tenant-id-here
VITE_AZURE_REDIRECT_URI=http://localhost:8080
VITE_AZURE_TENANT_ID=your-tenant-id-here
```

## Step 6: Test the Configuration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:8080`
3. Click the **Sign In** button
4. You should be redirected to Microsoft login
5. After successful authentication, you should see:
   - Your user information in the header
   - "Connected" badge
   - Real policy data loading from Intune

## Troubleshooting

### Common Issues

1. **"AADSTS50011: Reply URL mismatch"**
   - Ensure your redirect URI in Entra ID matches exactly what you're using
   - Check for trailing slashes and protocol (http vs https)

2. **"AADSTS65001: User or administrator has not consented"**
   - Admin consent hasn't been granted for the required permissions
   - Go back to API permissions and grant admin consent

3. **"Insufficient privileges to complete the operation"**
   - The user doesn't have permissions to read Intune data
   - Ensure the user has appropriate Intune roles (e.g., Intune Service Administrator)

4. **Network/CORS Errors**
   - MSAL handles CORS for authentication flows
   - Ensure you're using the correct authority URL
   - Check browser console for specific error messages

### Required User Permissions

Users signing into the application need one of these Entra ID roles:
- **Global Administrator**
- **Intune Service Administrator** 
- **Global Reader**
- **Security Reader**
- Custom role with Intune read permissions

### Development vs Production

**Development:**
- Use `http://localhost:8080` as redirect URI
- Can use "common" tenant for multi-tenant testing

**Production:**
- Use your actual domain with HTTPS
- Configure proper tenant ID for single-tenant apps
- Ensure redirect URIs are updated in Entra ID

## Security Considerations

1. **Never commit** your `.env` file to version control
2. Use **different app registrations** for development and production
3. Regularly **review and rotate** client secrets (if using confidential client)
4. **Monitor** app sign-ins and permissions in Entra ID logs
5. **Principle of least privilege**: Only grant necessary permissions

## Next Steps

After successful setup:
1. Test authentication flow
2. Verify policy data is loading from your Intune tenant
3. Configure additional features as needed
4. Deploy to production environment

For additional help, refer to:
- [Microsoft Graph permissions reference](https://docs.microsoft.com/en-us/graph/permissions-reference)
- [MSAL.js documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-js-initializing-client-applications)
- [Entra ID app registration guide](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
