"use client";
import React from "react";
import { Button } from "./ui/button";
// Replace with your AuthProvider's useAuth
import { useAuth } from "../../contexts/AuthContext"; // Adjust path if needed

function SignOut() {
  const { logout } = useAuth();
  return (
    <Button variant={"outline"} onClick={() => logout()}>
      Sign Out
    </Button>
  );
}

export default SignOut;
