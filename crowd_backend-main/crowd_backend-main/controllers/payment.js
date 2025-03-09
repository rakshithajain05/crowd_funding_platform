"use strict";

// const frontendURL = "https://crowd-funding.vercel.app/";
const frontendURL = "http://localhost:3000/";

const express = require("express");
const checksum_lib = require("../paytm/checksum");
const https = require("https");
const qs = require("querystring");
const db = require("../models");
const config = require("../config");

const app = express();

const success = async (req, res) => {
  try {
    // Read request body
    let body = await new Promise((resolve) => {
      let tempBody = "";
      req.on("data", (chunk) => (tempBody += chunk));
      req.on("end", () => resolve(tempBody));
    });

    let post_data = qs.parse(body);
    console.log("Callback Response:", post_data);

    // Fetch the donation record from DB
    const donation = await db.Donation.findById(post_data.ORDERID);
    if (!donation) {
      console.log("Donation record not found for ORDERID:", post_data.ORDERID);
      return res.status(400).send("Transaction Failed, Please retry!!");
    }

    donation.transactionID = post_data.TXNID;

    if (post_data.RESPCODE !== "01") {
      console.log("Transaction failed. RESPMSG:", post_data.RESPMSG);
      await donation.save();
      return res.status(400).redirect(frontendURL + "donation/failure");
    }

    // Validate checksum
    const { CHECKSUMHASH, ...params } = post_data;
    const isChecksumValid = checksum_lib.verifychecksum(params, config.PaytmConfig.key, CHECKSUMHASH);
    
    if (!isChecksumValid) {
      console.log("Checksum verification failed for ORDERID:", params.ORDERID);
      await donation.save();
      return res.status(400).redirect(frontendURL + "donation/failure");
    }

    // Prepare verification request
    checksum_lib.genchecksum(params, config.PaytmConfig.key, async (err, checksum) => {
      if (err) {
        console.error("Checksum generation error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      params.CHECKSUMHASH = checksum;
      const post_data_str = "JsonData=" + JSON.stringify(params);

      const options = {
        hostname: "securegw-stage.paytm.in", // Staging environment
        // hostname: 'securegw.paytm.in', // Production
        port: 443,
        path: "/merchant-status/getTxnStatus",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(post_data_str),
        },
      };

      // Send request to Paytm for final verification
      let response = "";
      const post_req = https.request(options, (post_res) => {
        post_res.on("data", (chunk) => (response += chunk));
        post_res.on("end", async () => {
          try {
            const txnResult = JSON.parse(response);
            console.log("Final Verification Response:", txnResult);

            if (
              txnResult.STATUS === "TXN_SUCCESS" &&
              txnResult.TXNAMOUNT === params.TXNAMOUNT &&
              txnResult.ORDERID === params.ORDERID
            ) {
              donation.transactionComplete = true;

              const campaign = await db.Campaign.findById(donation.campaign);
              if (campaign) {
                campaign.donors.push({
                  transactionID: donation.transactionID,
                  donationAmount: donation.amount,
                });

                campaign.donorsNum += 1;
                campaign.raised += donation.amount;

                await campaign.save();
              }

              await donation.save();
              console.log("Payment successful for ORDERID:", donation._id);
              return res.status(200).redirect(frontendURL + "donation/success/" + donation._id);
            } else {
              console.log("Final verification failed for ORDERID:", donation._id);
              await donation.save();
              return res.status(400).redirect(frontendURL + "donation/failure");
            }
          } catch (error) {
            console.error("Error parsing Paytm response:", error);
            return res.status(500).json({ message: "Payment verification error" });
          }
        });
      });

      post_req.on("error", (error) => {
        console.error("Error in HTTPS request:", error);
        return res.status(500).json({ message: "Payment gateway error" });
      });

      post_req.write(post_data_str);
      post_req.end();
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error. Sorry from our end." });
  }
};

module.exports = { success };
