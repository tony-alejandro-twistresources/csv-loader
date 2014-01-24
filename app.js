#!/usr/bin/env node

var fs = require("fs");


// Check the command line prameters
if (process.argv.length === 7 && process.argv[2] === 'categoryMap' && endsWith(process.argv[6], '.csv')){

	// Load category map from CSV file
	var url = process.argv[3];
	var accessToken = process.argv[4];
	var sourceId = process.argv[5];
	var csvFile = process.argv[6];
	require('./code/categoryMap_csv').load(url, accessToken, sourceId, csvFile); // async
} else if (process.argv.length === 7 && process.argv[2] === 'product' && endsWith(process.argv[6], '.csv')){

	// Load products from CSV file
	var url = process.argv[3];
	var accessToken = process.argv[4];
	var sourceId = process.argv[5];
	var csvFile = process.argv[6];
	require('./code/products_csv').load(url, accessToken, sourceId, csvFile); // async
} else {
	
	// Unrecognised command
	var cmd = process.argv[1];
	console.log("usage:\n");
	console.log("  [node] " + cmd + " categoryMap <url> <accessToken> <sourceId> <csvFile>");
	console.log("  [node] " + cmd + " product <url> <accessToken> <sourceId> <csvFile>");
	process.exit(1);
}




//process.exit(0);
// Finished

/**
 *	Return true if name ends with a specific suffix
 *  @example
 *  endsWith("image.png", ".png"))
 *	// true
 */
function endsWith(name, suffix) {
	//console.log("endsWith(" + name + ", " + suffix + ")")
	var nameLen = name.length;
	var suffixLen = suffix.length;
	if (nameLen < suffixLen)
		return false;
	var ending = name.substring(nameLen - suffixLen);
	return (ending === suffix);
}