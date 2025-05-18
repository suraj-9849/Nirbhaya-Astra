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
    const token = Cookies.get("token");
    if (token) {
      fetch("/api/auth/me")
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            setUser(data.user);
          }
        })
        .catch((error) => {
          console.error("Authentication error:", error);
          Cookies.remove("token");
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

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

      Cookies.set("token", data.token, { expires: 7 });
      setUser(data.user);

      // Redirect based on user role
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

      Cookies.set("token", data.token, { expires: 7 });
      setUser(data.user);

      // Redirect based on user role
      if (data.user.isGovtOfficial) {
        router.push("/dashboard");
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Signup error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    Cookies.remove("token");
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
