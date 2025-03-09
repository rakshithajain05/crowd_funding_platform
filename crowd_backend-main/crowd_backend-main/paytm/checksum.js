"use strict";

const crypt = require("./crypt");
const crypto = require("crypto");

const mandatoryParams = []; // Define this with required keys

// Helper function to convert parameters to a string
function paramsToString(params, mandatoryflag = false, isRefund = false) {
  let data = "";
  let tempKeys = Object.keys(params).sort();

  tempKeys.forEach((key) => {
    let value = params[key];

    if (typeof value === "string") {
      if (value.includes("REFUND") && isRefund) value = "";
      if (value.includes("|")) value = "";
    }

    if (key !== "CHECKSUMHASH") {
      if (value === "null") value = "";
      if (!mandatoryflag || mandatoryParams.includes(key)) {
        data += value + "|";
      }
    }
  });

  return data;
}

// Generate checksum
function genchecksum(params, key, cb) {
  const data = paramsToString(params);
  crypt.gen_salt(4, (err, salt) => {
    if (err) return cb(err);

    const sha256 = crypto.createHash("sha256").update(data + salt).digest("hex");
    const encrypted = crypt.encrypt(sha256 + salt, key);
    cb(null, encrypted);
  });
}

// Generate checksum from a string
function genchecksumbystring(params, key, cb) {
  crypt.gen_salt(4, (err, salt) => {
    if (err) return cb(err);

    const sha256 = crypto.createHash("sha256").update(params + "|" + salt).digest("hex");
    const encrypted = crypt.encrypt(sha256 + salt, key);
    cb(null, encrypted);
  });
}

// Verify checksum
function verifychecksum(params, key, checksumhash) {
  if (!checksumhash) {
    console.log("Checksum not found");
    return false;
  }

  checksumhash = decodeURIComponent(checksumhash.trim());
  const decrypted = crypt.decrypt(checksumhash, key);
  const salt = decrypted.slice(-4);
  const sha256 = decrypted.slice(0, -4);
  const hash = crypto.createHash("sha256").update(paramsToString(params, false) + salt).digest("hex");

  if (hash === sha256) return true;
  
  console.log("Checksum is wrong");
  return false;
}

// Verify checksum from a string
function verifychecksumbystring(params, key, checksumhash) {
  const decrypted = crypt.decrypt(checksumhash, key);
  const salt = decrypted.slice(-4);
  const sha256 = decrypted.slice(0, -4);
  const hash = crypto.createHash("sha256").update(params + "|" + salt).digest("hex");

  if (hash === sha256) return true;

  console.log("Checksum is wrong");
  return false;
}

// Generate checksum for refund transactions
function genchecksumforrefund(params, key, cb) {
  const data = paramsToString(params, false, true);
  crypt.gen_salt(4, (err, salt) => {
    if (err) return cb(err);

    const sha256 = crypto.createHash("sha256").update(data + salt).digest("hex");
    const encrypted = crypt.encrypt(sha256 + salt, key);
    params.CHECKSUM = encodeURIComponent(encrypted);
    cb(null, params);
  });
}

// Exporting functions
module.exports = {
  genchecksum,
  verifychecksum,
  verifychecksumbystring,
  genchecksumbystring,
  genchecksumforrefund,
};
