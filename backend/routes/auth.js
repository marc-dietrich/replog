// backend/routes/auth.js
import { Router } from "express";
import User from "../models/User.js";
import { verifyGoogleToken, signSessionToken } from "../middleware/auth.js";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

/**
 * POST /api/auth/google
 * Body: { idToken: string, claimGuestData?: boolean }
 *
 * 1. Verifies the Google ID-token
 * 2. Finds or creates the Google user in the DB
 * 3. If claimGuestData is true AND a guest cookie exists,
 *    merges guest data into the Google user (then deletes the guest doc)
 * 4. Sets a session cookie and returns user state
 */
router.post("/google", async (req, res) => {
  try {
    const { idToken, claimGuestData } = req.body;
    if (!idToken) return res.status(400).json({ error: "idToken required" });
    if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: "GOOGLE_CLIENT_ID not configured" });

    const payload = await verifyGoogleToken(idToken, GOOGLE_CLIENT_ID);
    const googleSub = `google|${payload.sub}`;

    // Find or create the authenticated user
    let user = await User.findOne({ sub: googleSub });
    if (!user) {
      user = await User.create({
        sub: googleSub,
        provider: "google",
        email: payload.email,
        displayName: payload.name || payload.email,
      });
    }

    // ---- Guest → Authenticated data claim ----
    if (claimGuestData) {
      const guestId = req.cookies?.guest_id;
      if (guestId) {
        const guestSub = `guest|${guestId}`;
        const guestUser = await User.findOne({ sub: guestSub });
        if (guestUser && guestUser.exercises.length > 0) {
          // Only merge if the authenticated user has NO exercises yet,
          // otherwise we'd lose their data. In conflict we keep authenticated data.
          if (user.exercises.length === 0) {
            user.exercises = guestUser.exercises;
            user.groups = guestUser.groups;
            user.settings = guestUser.settings;
            await user.save();
          }
          // Clean up guest document
          await User.deleteOne({ sub: guestSub });
        }
        // Clear guest cookie since user is now authenticated
        res.clearCookie("guest_id");
      }
    }

    // Set session cookie
    const sessionJwt = signSessionToken(googleSub);
    res.cookie("session", sessionJwt, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    });

    return res.json({
      user: {
        sub: user.sub,
        provider: user.provider,
        email: user.email,
        displayName: user.displayName,
      },
      state: {
        exercises: user.exercises,
        groups: user.groups,
        settings: user.settings,
      },
    });
  } catch (err) {
    console.error("Google auth error:", err);
    return res.status(401).json({ error: "Invalid Google token" });
  }
});

/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */
router.post("/logout", (_req, res) => {
  res.clearCookie("session");
  return res.json({ ok: true });
});

/**
 * GET /api/auth/me
 * Returns the current user info (or guest info).
 */
router.get("/me", async (req, res) => {
  try {
    const user = await User.findOne({ sub: req.user.sub });
    if (!user) {
      return res.json({
        user: { sub: req.user.sub, provider: req.user.provider },
        state: { exercises: [], groups: [], settings: {} },
      });
    }
    return res.json({
      user: {
        sub: user.sub,
        provider: user.provider,
        email: user.email,
        displayName: user.displayName,
      },
      state: {
        exercises: user.exercises,
        groups: user.groups,
        settings: user.settings,
      },
    });
  } catch (err) {
    console.error("GET /me error:", err);
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
