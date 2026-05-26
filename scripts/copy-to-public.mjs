/**
 * TRACE — Copy built SPAs to public/ for Vercel
 */
import { cpSync, mkdirSync, existsSync } from "node:fs";

console.log("Copying builds to public/...");

mkdirSync("public", { recursive: true });
mkdirSync("public/operator", { recursive: true });

// PWA → public/ (root)
if (existsSync("pwa/dist")) {
  cpSync("pwa/dist", "public", { recursive: true });
  console.log("+ PWA → public/");
}

// Operator → public/operator/
if (existsSync("operator/dist")) {
  cpSync("operator/dist", "public/operator", { recursive: true });
  console.log("+ Operator → public/operator/");
}

console.log("Done.");
