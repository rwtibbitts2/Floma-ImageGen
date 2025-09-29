// Authentication system - From blueprint:javascript_auth_all_persistance
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { z } from "zod";

declare global {
  namespace Express {
    interface User extends SelectUser {}
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

export function setupAuth(app: Express) {
  // Validate SESSION_SECRET is present
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required for authentication');
  }

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: process.env.NODE_ENV === 'production', // Only HTTPS in prod
      sameSite: 'lax' // Works with Replit's preview domain structure
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Use email as username field
  passport.use(
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password' },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !user.isActive || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: 'Invalid email or password' });
          }
          
          // Update last login
          await storage.updateUserLastLogin(user.id);
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    ),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Authentication routes (public registration removed - now admin-only)

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: SelectUser | false, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || "Authentication failed" });
      }

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        
        // Remove password from response
        const { password, ...userResponse } = user;
        res.status(200).json(userResponse);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie('connect.sid');
        res.sendStatus(200);
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    
    // Remove password from response
    const { password, ...userResponse } = req.user;
    res.json(userResponse);
  });

  // Admin-only user management endpoints
  
  // Create new user (admin-only)
  app.post("/api/admin/create-user", requireAdmin, async (req, res, next) => {
    try {
      const userData = insertUserSchema.parse({
        email: req.body.email,
        password: req.body.password,
        role: req.body.role || 'user' // Admin can set role during creation
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

  // Update user role (admin-only) - renamed from elevate-user for clarity
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

// Authentication middleware
export function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export { hashPassword, comparePasswords };