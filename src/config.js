"use strict";

require("dotenv").config();

function getConfig() {
  return {
    openaiApiKey: process.env.OPENAI_API_KEY || "OPENAI_API_KEY",
  };
}

module.exports = { getConfig };


