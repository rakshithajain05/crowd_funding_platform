"use strict";

const crypto = require("crypto");

const crypt = {
  iv: Buffer.from("@@@@&&&&####$$$$"), // Convert IV to a buffer

  encrypt: function (data, custom_key) {
    if (![16, 24, 32].includes(custom_key.length)) {
      throw new Error("Invalid key length. Key must be 16, 24, or 32 bytes long.");
    }

    const algo = `AES-${custom_key.length * 8}-CBC`;
    const cipher = crypto.createCipheriv(algo, custom_key, this.iv);

    let encrypted = cipher.update(data, "utf8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
  },

  decrypt: function (data, custom_key) {
    if (![16, 24, 32].includes(custom_key.length)) {
      throw new Error("Invalid key length. Key must be 16, 24, or 32 bytes long.");
    }

    const algo = `AES-${custom_key.length * 8}-CBC`;
    const decipher = crypto.createDecipheriv(algo, custom_key, this.iv);

    let decrypted;
    try {
      decrypted = decipher.update(data, "base64", "utf8");
      decrypted += decipher.final("utf8");
    } catch (e) {
      console.error("Decryption error:", e.message);
      return null;
    }
    return decrypted;
  },

  gen_salt: function (length, cb) {
    crypto.randomBytes(Math.ceil((length * 3) / 4), (err, buf) => {
      cb(err, err ? null : buf.toString("base64"));
    });
  },

  /* One-way MD5 hash with salt */
  md5sum: function (salt, data) {
    return crypto.createHash("md5").update(salt + data).digest("hex");
  },

  sha256sum: function (salt, data) {
    return crypto.createHash("sha256").update(data + salt).digest("hex");
  },
};

module.exports = crypt;

// Self-invoking function for testing
(function () {
  function logsalt(err, salt) {
    if (err) {
      console.error("Salt generation error:", err);
    } else {
      console.log("Generated salt:", salt);
    }
  }

  if (require.main === module) {
    const key = "0123456789abcdef"; // Example 16-byte key
    const enc = crypt.encrypt("One97", key);
    console.log("Encrypted:", enc);
    console.log("Decrypted:", crypt.decrypt(enc, key));

    for (let i = 0; i < 5; i++) {
      crypt.gen_salt(4, logsalt);
    }
  }
})();
