const path = require("path");

// load configuration from global config file
module.exports = require("../../" + path.basename(__filename));
