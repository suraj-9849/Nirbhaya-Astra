"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  if (pathname.startsWith("/auth/")) {
    return null;
  }
  const navigationLinks = user?.isGovtOfficial
    ? [
        { name: "Dashboard", href: "/dashboard" },
        { name: "TrackX", href: "/video-analyser" },
        { name: "Investigation", href: "/investigation" },
      ]
    : [
        { name: "Create Post", href: "/create-post" },
        { name: "Law Bot", href: "/lawbot" },
        { name: "Therapy Bot", href: "http://localhost:5173" },
        { name: "Safe Route", href: "/safe-route" },
      ];

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  if (!user) {
    return null;
  }

  return (
    <nav className="mb-5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link
                href={user.isGovtOfficial ? "/dashboard" : "/"}
                className="text-white font-bold text-xl"
              >
                Nirbhaya-Astra
              </Link>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navigationLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`${
                      pathname === link.href
                        ? "bg-indigo-700 text-white"
                        : "text-white hover:bg-indigo-500"
                    } px-3 py-2 rounded-md text-sm font-medium`}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              <div className="text-white mr-4">
                {user.name ? `Welcome, ${user.name}` : `Welcome, ${user.email}`}
              </div>
              <button
                onClick={logout}
                className="px-3 py-2 rounded-md text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800"
              >
                Logout
              </button>
            </div>
          </div>
          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className="bg-indigo-700 inline-flex items-center justify-center p-2 rounded-md text-white hover:text-white hover:bg-indigo-800 focus:outline-none"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className="block h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navigationLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`${
                  pathname === link.href
                    ? "bg-indigo-700 text-white"
                    : "text-white hover:bg-indigo-500"
                } block px-3 py-2 rounded-md text-base font-medium`}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-indigo-700">
            <div className="flex items-center px-5">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-indigo-800 flex items-center justify-center">
                  <span className="text-white font-medium">
                    {user.name ? user.name.charAt(0) : user.email.charAt(0)}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <div className="text-base font-medium leading-none text-white">
                  {user.name || "User"}
                </div>
                <div className="text-sm font-medium leading-none text-indigo-200 mt-1">
                  {user.email}
                </div>
              </div>
            </div>
            <div className="mt-3 px-2 space-y-1">
              <button
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-white bg-indigo-700 hover:bg-indigo-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
