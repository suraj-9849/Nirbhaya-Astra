import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export interface UserData {
  id: string;
  email: string;
  name?: string | null;
  isGovtOfficial: boolean;
}

export async function register(
  email: string,
  password: string,
  name?: string,
  isGovtOfficial: boolean = false,
) {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error("User already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        isGovtOfficial,
      },
    });

    // Generate JWT token
    const token = generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isGovtOfficial: user.isGovtOfficial,
      },
      token,
    };
  } catch (error) {
    throw error;
  }
}

export async function login(email: string, password: string) {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // Generate JWT token
    const token = generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isGovtOfficial: user.isGovtOfficial,
      },
      token,
    };
  } catch (error) {
    throw error;
  }
}

function generateToken(user: any) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      isGovtOfficial: user.isGovtOfficial,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

export function verifyToken(token: string): UserData | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserData;
    return decoded;
  } catch (error) {
    return null;
  }
}
