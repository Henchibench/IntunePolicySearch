# Intune Policy Search Dashboard - Complete Project Brief

## Project Overview
Create a modern web application that connects to Microsoft Intune via Graph API to search through configuration policies and settings. This is a read-only dashboard for demo purposes that allows searching across all policy configurations to find specific settings.

## Technical Requirements

### Frontend Stack
- **Framework**: React 18+ with TypeScript
- **UI Library**: shadcn/ui components with Tailwind CSS
- **Icons**: Lucide React
- **Animations**: Framer Motion for smooth transitions
- **Search**: Fuse.js for fuzzy search capabilities
- **Build Tool**: Vite or Create React App

### Authentication & API
- **Authentication**: MSAL (Microsoft Authentication Library) for React
- **API**: Microsoft Graph API for Intune data
- **Permissions Needed**: 
  - `DeviceManagementConfiguration.Read.All`
  - `DeviceManagementApps.Read.All`
  - `DeviceManagementManagedDevices.Read.All`

### Data Management
- **Caching**: Local JSON file storage or localStorage
- **Data Sources**: Configuration policies, compliance policies, app protection policies
- **Refresh**: Manual refresh button to re-fetch from Graph API

## Key Features to Implement

### 1. Authentication Flow
```typescript
// App registration setup needed:
// - Azure AD app registration
// - Redirect URIs configured
// - API permissions granted
// - Client ID for MSAL configuration
```

### 2. Data Fetching from Graph API
```typescript
// Key Graph API endpoints to implement:
// GET /deviceManagement/deviceConfigurations
// GET /deviceManagement/deviceCompliancePolicies
// GET /deviceManagement/managedAppPolicies
// GET /deviceManagement/configurationPolicies
```

### 3. Search Functionality
- Global search across all policy settings
- Search in: policy names, descriptions, setting categories, setting keys, setting values
- Real-time search with highlighting
- Fuzzy search for typo tolerance

### 4. Filtering System
- Filter by policy type (Device Configuration, Compliance Policy, App Protection, etc.)
- Filter by platform (Windows, iOS, Android, macOS, All Platforms)
- Combined search + filter functionality

### 5. UI Components Needed
- **Header**: Title, description, refresh button
- **Search Bar**: Global search with search icon
- **Filter Dropdown**: Policy type and platform filters
- **Policy Cards**: Expandable cards showing policy metadata
- **Settings Display**: Organized settings by category with highlighting
- **Loading States**: Skeleton loaders during API calls
- **Error Handling**: User-friendly error messages

## Data Structure Example
```typescript
interface Policy {
  id: string;
  name: string;
  type: 'Device Configuration' | 'Compliance Policy' | 'App Protection' | 'Configuration Policy';
  platform: 'Windows' | 'iOS' | 'Android' | 'macOS' | 'All Platforms';
  description: string;
  settings: Record<string, Record<string, any>>; // Category -> Setting -> Value
  assignedGroups: string[];
  lastModified: string;
  createdBy: string;
}
```

## Design Requirements

### Visual Design
- Modern, clean interface with shadcn/ui components
- Card-based layout for policies
- Expandable sections for policy details
- Platform-specific color coding:
  - Windows: Blue theme
  - iOS: Gray theme  
  - Android: Green theme
  - All Platforms: Purple theme
- Dark mode support
- Responsive design (mobile-friendly)

### Animations & Interactions
- Smooth expand/collapse animations for policy cards
- Hover effects on interactive elements
- Loading animations during data fetching
- Highlight animation for search matches
- Refresh button spin animation

## Implementation Steps

### Phase 1: Setup & Basic UI
1. Initialize React project with TypeScript
2. Install dependencies (shadcn/ui, Tailwind, Lucide, MSAL, etc.)
3. Set up basic routing and layout
4. Create mock data structure
5. Build search and filter UI components

### Phase 2: Authentication
1. Configure Azure AD app registration
2. Implement MSAL authentication
3. Add login/logout functionality
4. Handle authentication errors

### Phase 3: Graph API Integration
1. Set up Graph API client
2. Implement data fetching functions
3. Add error handling for API calls
4. Implement caching mechanism

### Phase 4: Advanced Features
1. Add Fuse.js for fuzzy search
2. Implement search highlighting
3. Add export functionality
4. Performance optimizations

## File Structure
```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── PolicyCard.tsx   # Individual policy display
│   ├── SearchBar.tsx    # Search input component
│   ├── FilterBar.tsx    # Filter dropdowns
│   └── Header.tsx       # App header
├── hooks/
│   ├── useAuth.ts       # Authentication hook
│   ├── useGraphAPI.ts   # Graph API calls hook
│   └── useSearch.ts     # Search functionality hook
├── services/
│   ├── authConfig.ts    # MSAL configuration
│   ├── graphService.ts  # Graph API service
│   └── cacheService.ts  # Data caching service
├── types/
│   └── index.ts         # TypeScript interfaces
├── utils/
│   ├── searchHelpers.ts # Search utility functions
│   └── dataTransform.ts # Data transformation helpers
└── App.tsx              # Main application component
```

## Environment Variables Needed
```env
VITE_AZURE_CLIENT_ID=your-client-id
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/your-tenant-id
VITE_AZURE_REDIRECT_URI=http://localhost:3000
```

## Azure AD App Registration Setup
1. Create new app registration in Azure Portal
2. Set redirect URI to your app URL
3. Add required API permissions for Microsoft Graph
4. Grant admin consent for permissions
5. Note the Client ID and Tenant ID for configuration

## Testing Strategy
- Use mock data during development
- Test authentication flow
- Test search functionality with various queries
- Test responsive design on different screen sizes
- Test error scenarios (network failures, auth errors)

## Deployment Considerations
- Build for production with environment variables
- Consider hosting on Azure Static Web Apps or Vercel
- Ensure HTTPS for authentication redirects
- Configure proper CORS settings

## Future Enhancements
- Add policy comparison functionality
- Export search results to Excel
- Advanced filtering options
- Policy change history tracking
- Bulk policy operations
- Integration with other Microsoft 365 services

---

**Important Note**: This is a read-only dashboard for demo purposes. Ensure proper permissions and security practices when handling organizational dat