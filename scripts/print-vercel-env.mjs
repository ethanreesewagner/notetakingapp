#!/usr/bin/env node
/**
 * Prints Firebase env vars to copy into Vercel → Settings → Environment Variables.
 * Run: node scripts/print-vercel-env.mjs
 */
import fs from "fs";
import path from "path";

const credentialsDir = path.join(process.cwd(), "credentials");
const files = fs.existsSync(credentialsDir)
  ? fs.readdirSync(credentialsDir).filter((f) => f.endsWith(".json"))
  : [];

if (files.length === 0) {
  console.error(
    "No credentials/*.json file found. Download a service account key from Firebase Console first."
  );
  process.exit(1);
}

const json = fs.readFileSync(path.join(credentialsDir, files[0]), "utf8");
const minified = JSON.stringify(JSON.parse(json));

console.log("Add these in Vercel → Project → Settings → Environment Variables:\n");
console.log("FIREBASE_API_KEY");
console.log(
  process.env.FIREBASE_API_KEY ??
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "(your Firebase Web API key from Firebase Console)"
);
console.log("\nFIREBASE_SERVICE_ACCOUNT_JSON");
console.log(minified);
console.log("\nThen redeploy the project.");

