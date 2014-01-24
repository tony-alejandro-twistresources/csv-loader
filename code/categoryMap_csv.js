var csv = require("fast-csv"),
	fs = require("fs"),
	request = require('request');



exports.load = function(host, accessToken, sourceId, csvfile) {
	
	console.log("categoryMap_csv.load(" + host + ", " + accessToken + ", " + sourceId + ", " + csvfile + ")");
	
	pass1_validate(host, accessToken, sourceId, csvfile);
}

/**
 *	First. Check the CSV has the correct heading line, and the right number of values
 *	on each line. Also, check that the TEA categories are all valid (ZZZZ NOT YET).
 *	@return Async function
 */
function pass1_validate(host, accessToken, sourceId, csvfile) {

	console.log("Pass 1: Validation")
	var stream = fs.createReadStream(csvfile);
	stream.on('error', function (error) {console.log("Caught", error);bomb('CSV file error.')});

	// Verify each line of the CSV file
	var count = 0;
	csv(stream)
		.on("data", function(data){
			//console.log('have data row', data)
			if (count++ === 0) {

				// Header row
				if (data[0] != "source_category" || data[1] != "tea_category") {
					bomb('First line must contain "source_category,tea_category"');
				}
				return;
			} else {

				// Non-header row
				if (data.length != 2) {
					bomb('Line ' + count + ' should contain 2 fields');
				}
			}
		})
		.on("end", function(){

			// Finished loading the mapping. Send it to TEA.
			console.log("  - pass 1 complete")
			console.log("  - header line and " + count + " data lines passed validation.")
			pass2_loadMap(host, accessToken, sourceId, csvfile);
		})
		.on("error", function(){
			console.log("Pass 1: error loading CSV file.")
		})
		.parse();
}

/**
 *	Second pass. Load the CSV into a Javascript object, using the source_category
 *	as the property name, and the tea_category as the value.
 *	@return Async function
 */
function pass2_loadMap(host, accessToken, sourceId, csvfile) {
	console.log("Pass 2: Load mapping")
	var stream = fs.createReadStream(csvfile);
	stream.on('error', function (error) {console.log("Caught", error);bomb('CSV file error.')});

	// Load the mappings into a Javascript object
	var count = 0;
	var map = { };
	
	csv(stream)
		.on("data", function(data){
			if (count++ > 0) {

				// Non-header row
				var source_category = data[0];
				var tea_category = data[1];
				map[source_category] = tea_category;
			}
		})
		.on("end", function(){

			// Finished loading the mapping. Send it to TEA.
			console.log('  - pass 2 complete');
			pass3_upload(host, accessToken, sourceId, map);
		})
		.on("error", function(){
			bomb("Pass 2: error loading CSV file.")
		})
		.parse();
}

/**
 *	Third pass. Upload the new category mappings into TEA using the RESTful API.
 *	@return Async function
 */
function pass3_upload(host, accessToken, sourceId, map) {
	console.log("Pass 3: Upload to TEA")

	var json = {
		access_token: accessToken,
		source_id: sourceId,
//		  "overwrite_existing": true,
		map: map
	};
	
	// Send it to TEA via the RESTful API
	var url = 'http://' + host + '/categoryMap';
	
	console.log('  - calling TEA to update categoryMap:')
	console.log('  url=>' + url + ' (POST)')
	console.log('  data=>\n', json)
	
	request({
		method: 'POST',
		url: url,
		json: json
	}, function (error, response, body) {

		//console.log("Back, error="+error, body);

		if (error) {
	        bomb("Unexpected error: ", error);
		} else if (response.statusCode != 200) {
	        //console.log("Body is " + body);
	        bomb("Unexpected status code " + response.statusCode);
		} else {
			if (body.response != 'Success') {
				bomb('ERROR: response="' + body.response + '", message="' + body.message + '"');
			}
			console.log('  - upload complete');
			console.log("\nStatus: OK\n");
			process.exit(0);
		}
	});
}

/**
 *	Write out a message, and exit with error status
 */
function bomb(message) {
	console.log(message);
	console.log("\nStatus: ERROR\n");
	process.exit(1);
}
