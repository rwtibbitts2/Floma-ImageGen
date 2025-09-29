// Token-based authentication system
import { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { z } from "zod";

declare global {
  namespace Express {
    interface Request {
      user?: SelectUser;
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Generate JWT token
function generateToken(user: SelectUser): string {
  const jwtSecret = process.env.SESSION_SECRET;
  if (!jwtSecret) {
    throw new Error('SESSION_SECRET environment variable is required for JWT signing');
  }
  
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    jwtSecret,
    { expiresIn: '24h' }
  );
}

// Verify JWT token and extract user data
function verifyToken(token: string): { id: string; email: string; role: string } | null {
  const jwtSecret = process.env.SESSION_SECRET;
  if (!jwtSecret) {
    throw new Error('SESSION_SECRET environment variable is required for JWT verification');
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: string; email: string; role: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

export function setupAuth(app: Express) {
  console.log('[Auth] Using token-based authentication (JWT)');

  // Authentication routes
  app.post("/api/login", async (req, res, next) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.isActive || !(await comparePasswords(password, user.password))) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Update last login
      await storage.updateUserLastLogin(user.id);

      // Generate JWT token
      const token = generateToken(user);

      // Remove password from response
      const { password: _, ...userResponse } = user;
      res.status(200).json({ ...userResponse, token });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/logout", (req, res) => {
    // With JWT, logout is handled client-side by removing the token
    res.sendStatus(200);
  });

  app.get("/api/user", requireAuth, (req, res) => {
    // Remove password from response
    const { password, ...userResponse } = req.user!;
    res.json(userResponse);
  });

  // Admin-only user management endpoints
  
  // Create new user (admin-only)
  app.post("/api/admin/create-user", requireAdmin, async (req, res, next) => {
    try {
      const userData = insertUserSchema.parse({
        email: req.body.email,
        password: req.body.password,
        role: req.body.role || 'user'
      });

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      // Hash password and create user
      const user = await storage.createUser({
        ...userData,
        password: await hashPassword(userData.password),
      });

      // Remove password from response
      const { password, ...userResponse } = user;
      res.status(201).json({ message: "User created successfully", user: userResponse });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      next(error);
    }
  });

  // List all users (admin-only)
  app.get("/api/admin/users", requireAdmin, async (req, res, next) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const usersResponse = users.map(({ password, ...user }) => user);
      res.json(usersResponse);
    } catch (error) {
      next(error);
    }
  });

  // Toggle user active status (admin-only)
  app.post("/api/admin/toggle-user-status", requireAdmin, async (req, res, next) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

      // Prevent users from deactivating their own account
      if (userId === req.user?.id) {
        return res.status(403).json({ error: "You cannot deactivate your own account" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const updatedUser = await storage.updateUser(userId, { isActive: !user.isActive });
      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update user status" });
      }

      // Remove password from response
      const { password, ...userResponse } = updatedUser;
      res.json({ 
        message: `User ${updatedUser.isActive ? 'activated' : 'deactivated'} successfully`, 
        user: userResponse 
      });
    } catch (error) {
      next(error);
    }
  });

  // Update user role (admin-only)
  app.post("/api/admin/elevate-user", requireAdmin, async (req, res, next) => {
    try {
      const { userId, role } = req.body;
      
      if (!userId || !role || !['admin', 'user'].includes(role)) {
        return res.status(400).json({ error: "Valid userId and role (admin/user) required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const updatedUser = await storage.updateUser(userId, { role: role as 'admin' | 'user' });
      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update user role" });
      }

      // Remove password from response
      const { password, ...userResponse } = updatedUser;
      res.json({ message: "User role updated successfully", user: userResponse });
    } catch (error) {
      next(error);
    }
  });
}

// Authentication middleware - verifies JWT token
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    // Fetch full user data from database
    const user = await storage.getUser(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Authentication failed" });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const user = await storage.getUser(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" });
    }
    
    if (user.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Authentication failed" });
  }
}

export { hashPassword, comparePasswords };
