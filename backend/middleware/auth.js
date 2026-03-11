// backend/middleware/auth.js
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { v4 as uuidv4 } from "uuid";

// ---------- Google JWKS ----------
const googleJwks = jwksClient({
  jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
  cache: true,
  rateLimit: true,
});

function getGoogleKey(header, callback) {
  googleJwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

/**
 * Verify a Google ID-token (JWT from Sign-In with Google / credential flow).
 * Returns the decoded payload or throws.
 */
export function verifyGoogleToken(idToken, clientId) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getGoogleKey,
      {
        algorithms: ["RS256"],
        audience: clientId,
        issuer: ["https://accounts.google.com", "accounts.google.com"],
      },
      (err, decoded) => (err ? reject(err) : resolve(decoded))
    );
  });
}

// ---------- Session JWT (our own) ----------
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me-in-production";
const SESSION_EXPIRY = "30d";

export function signSessionToken(sub) {
  return jwt.sign({ sub }, SESSION_SECRET, { expiresIn: SESSION_EXPIRY });
}

export function verifySessionToken(token) {
  return jwt.verify(token, SESSION_SECRET);
}

// ---------- Express middleware ----------

/**
 * Attaches `req.user = { sub, provider }` to every request.
 *
 * - If a valid session cookie exists → authenticated user
 * - Otherwise → creates/reuses a guest session (cookie `guest_id`)
 */
export function authMiddleware(req, res, next) {
  // 1. Try session cookie (logged-in user)
  const sessionToken = req.cookies?.session;
  if (sessionToken) {
    try {
      const decoded = verifySessionToken(sessionToken);
      req.user = { sub: decoded.sub, provider: "google" };
      return next();
    } catch {
      // expired / invalid → fall through to guest
      res.clearCookie("session");
    }
  }

  // 2. Guest session
  let guestId = req.cookies?.guest_id;
  if (!guestId) {
    guestId = uuidv4();
    res.cookie("guest_id", guestId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 90, // 90 days
    });
  }
  req.user = { sub: `guest|${guestId}`, provider: "guest" };
  next();
}
