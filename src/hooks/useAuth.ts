import { useState, useEffect, useCallback } from "react";
import { 
  PublicClientApplication, 
  AccountInfo, 
  AuthenticationResult,
  InteractionRequiredAuthError,
  SilentRequest
} from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { msalConfig, loginRequest } from "@/services/authConfig";
import { GraphService, MSALAuthenticationProvider } from "@/services/graphService";
import { GraphUser } from "@/types/graph";

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: GraphUser | null;
  error: string | null;
  graphService: GraphService | null;
}

export const useAuth = () => {
  const { instance, accounts, inProgress } = useMsal();
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
    graphService: null
  });

  /**
   * Get access token for Microsoft Graph API
   */
  const getAccessToken = useCallback(async (): Promise<string> => {
    const account = accounts[0];
    if (!account) {
      throw new Error("No account found");
    }

    const silentRequest: SilentRequest = {
      ...loginRequest,
      account
    };

    try {
      const response = await instance.acquireTokenSilent(silentRequest);
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        // Fallback to popup if silent request fails
        const response = await instance.acquireTokenPopup(loginRequest);
        return response.accessToken;
      }
      throw error;
    }
  }, [instance, accounts]);

  /**
   * Initialize Graph service with authentication provider
   */
  const initializeGraphService = useCallback(async () => {
    if (accounts.length > 0) {
      try {
        const authProvider = new MSALAuthenticationProvider(getAccessToken);
        const graphService = new GraphService(authProvider);
        
        // Test the connection by getting current user
        const user = await graphService.getCurrentUser();
        
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: true,
          isLoading: false,
          user,
          error: null,
          graphService
        }));
      } catch (error) {
        console.error("Failed to initialize Graph service:", error);
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: false,
          isLoading: false,
          error: error instanceof Error ? error.message : "Authentication failed",
          graphService: null
        }));
      }
    } else {
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
        graphService: null
      }));
    }
  }, [accounts, getAccessToken]);

  /**
   * Login user
   */
  const login = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await instance.loginPopup(loginRequest);
      // Graph service will be initialized in the effect hook
    } catch (error) {
      console.error("Login failed:", error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Login failed"
      }));
    }
  }, [instance]);

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await instance.logoutPopup({
        postLogoutRedirectUri: window.location.origin,
        mainWindowRedirectUri: window.location.origin
      });
      
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
        graphService: null
      });
    } catch (error) {
      console.error("Logout failed:", error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Logout failed"
      }));
    }
  }, [instance]);

  // Initialize auth state on mount and when accounts change
  useEffect(() => {
    if (inProgress === "none") {
      initializeGraphService();
    }
  }, [accounts, inProgress, initializeGraphService]);

  return {
    ...authState,
    login,
    logout,
    getAccessToken
  };
};
