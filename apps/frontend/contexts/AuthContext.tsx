"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { UserData } from "../lib/auth";

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    name: string,
    isGovtOfficial: boolean,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check if user is logged in on initial load
  useEffect(() => {
    // Check localStorage first, then cookies
    let token = localStorage.getItem("token") || Cookies.get("token");
    
    console.log("AuthContext: Checking token on load:", !!token);
    console.log("Token source:", localStorage.getItem("token") ? "localStorage" : "cookies");

    if (token) {
      // Try to get user from localStorage first as fallback
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          console.log("AuthContext: Found user in localStorage:", parsedUser);
          setUser(parsedUser);
        } catch (error) {
          console.error("AuthContext: Error parsing stored user:", error);
          localStorage.removeItem("user");
        }
      }

      console.log("AuthContext: Token found, fetching user data");
      fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
        .then((res) => {
          console.log("AuthContext: /api/auth/me response status:", res.status);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          console.log("AuthContext: Received user data:", data);
          if (data.user) {
            setUser(data.user);
            // Store user in localStorage as backup
            localStorage.setItem("user", JSON.stringify(data.user));
            console.log("AuthContext: User set and stored successfully:", data.user);
          } else {
            console.warn("AuthContext: No user in response data");
          }
        })
        .catch((error) => {
          console.error("AuthContext: Authentication error:", error);
          // If API fails but we have stored user and valid token, keep user logged in
          const storedUser = localStorage.getItem("user");
          if (!storedUser) {
            console.log("AuthContext: No fallback user, removing token");
            Cookies.remove("token");
            localStorage.removeItem("user");
          }
        })
        .finally(() => {
          console.log("AuthContext: Setting loading to false");
          setLoading(false);
        });
    } else {
      console.log("AuthContext: No token found, clearing stored user");
      localStorage.removeItem("user");
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Modified approach using localStorage for token
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to login");
      }

      console.log("Login successful, storing token and user:", data);

      // Store token in localStorage as primary method
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      
      // Try to also store in cookies as backup
      try {
        Cookies.set("token", data.token, { expires: 7, path: '/' });
      } catch (cookieError) {
        console.warn("Cookie storage failed, using localStorage only:", cookieError);
      }

      setUser(data.user);

      console.log("Token stored in localStorage:", !!localStorage.getItem("token"));
      console.log("User stored in localStorage:", !!localStorage.getItem("user"));

      if (data.user.isGovtOfficial) {
        router.push("/dashboard");
      } else {
        router.push("/create-post");
      }

    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    isGovtOfficial: boolean,
  ) => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, name, isGovtOfficial }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to register");
      }

      console.log("Signup successful, storing token and user:", data);

      // Store token in cookies - Fix the secure flag for development
      const isProduction = process.env.NODE_ENV === 'production';
      Cookies.set("token", data.token, { 
        expires: 7, 
        secure: isProduction, // Only secure in production
        sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
        path: '/' // Ensure cookie is available site-wide
      });

      // Store user in state and localStorage
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Small delay to ensure cookie is set before redirect
      setTimeout(() => {
        if (data.user.isGovtOfficial) {
          router.push("/dashboard");
        } else {
          router.push("/");
        }
      }, 100);

    } catch (error) {
      console.error("Signup error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    console.log("Logging out, clearing all stored data");
    Cookies.remove("token");
    localStorage.removeItem("user");
    setUser(null);
    router.push("/auth/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}