var csv = require("csv"),
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
//ZZZZZZ At the moment, this simply checks that every line has the same number of values.
function pass1_validate(host, accessToken, sourceId, csvfile) {

	console.log("Pass 1: Validation")
	// var stream = fs.createReadStream(csvfile);
	// stream.on('error', function (error) {console.log("Caught", error);bomb('CSV file error.')});

	// Verify each line of the CSV file
	var count = 0;
	var numFields;
	csv()
	.from.path(csvfile, { delimiter: ',', escape: '"' })
		.on("record", function(row, index){
			
			console.log('#'+index+' '+JSON.stringify(row));
			//console.log('have data row', data)
			if (count++ === 0) {

				// Header row
				numFields = row.length;
				// if (data[0] != "source_category" || data[1] != "tea_category") {
				// 	bomb('First line must contain "source_category,tea_category"');
				// }
				return;
			} else {

				// Non-header row
				// Check we have the right number of fields on this line
				if (row.length != numFields) {
					bomb('Line ' + count + ' should contain ' + numFields + ' fields');
				}
			}
		})
		.on("end", function(count){

			// Finished loading the mapping. Send it to TEA.
			console.log("  - pass 1 complete")
			console.log("  - header line and " + (count-1) + " data lines passed validation.")
			pass2_loadProducts(host, accessToken, sourceId, csvfile);
		})
		.on("error", function(err){
			console.log("Pass 1: error loading CSV file (line " + (count+1) + "): " + err)
		});
//		.parse();
}

/**
 *	Second pass. Load the CSV into a Javascript object, with one field for each value.
 *	@return Async function
 */
function pass2_loadProducts(host, accessToken, sourceId, csvfile) {
	console.log("Pass 2: Load mapping")

	// Load the mappings into a Javascript object
	var count = 0;
	var fields = [ ];
	var numFields;
	var productList = [ ];

	csv()
	.from.path(csvfile, { delimiter: ',', escape: '"' })
		.on("record", function(row, index){

			if (count++ === 0) {
				
				// header row
				// Convert the field names to camel case.
				for (var i = 0; i < row.length; i++) {
					console.log("Field is " + row[i]);
					var name = row[i].toLowerCase().replace(/[ ]+/g, '_');
					console.log("  --> " + name)
					fields.push(name);
				}
				numFields = fields.length;
				
			} else {

//if (i > 3) return;
				// Non-header row
				var obj = { };
				for (var i = 0; i < numFields; i++){
					var fieldName = fields[i];
					var value = row[i];
					obj[fieldName] = value;
				}
				productList.push(obj);
			}
		})
		.on("end", function(count){

			// Finished loading the mapping. Send it to TEA.
			console.log('  - pass 2 complete');
			console.log(' products: ', productList)
			pass3_upload(host, accessToken, sourceId, productList);
		})
		.on("error", function(err){
			bomb("Pass 2: error loading CSV file: " + err)
		});
}

/**
 *	Third pass. Upload the new product records into TEA using the RESTful API.
 *	@return Async function
 */
function pass3_upload(host, accessToken, sourceId, productList) {
	console.log("Pass 3: Upload to TEA")
	
	//ZZZZ It might be necessary to rename some of the fields, to match the API that will be called.
	productList.each(function(record){
		//record.abc = record.def
		//delete record.def
	});

	// Prepare the input to the RESTful API
	var json = {
		access_token: accessToken,
		source_id: sourceId,
//		  "overwrite_existing": true,
		products: productList
	};
	
	// Send it to TEA via the RESTful API
	//ZZZZZ This URL needs to be changed
	var url = 'http://' + host + '/product_PHIL';
	
	console.log('  - calling TEA to update categoryMap:')
	// console.log('  url=>' + url + ' (POST)')
	// console.log('  data=>\n', json)
	
	request({
		method: 'POST',
		url: url,
		json: json
	}, function (error, response, body) {

		//console.log("Back, error="+error, body);

		if (error) {
	        bomb("Unexpected error: " + error);
		} else if (response.statusCode != 200) {
	        //console.log("Body is " + body);
	        bomb("Unexpected status code " + response.statusCode);
		} else {
			if (body.response.toLowerCase() != 'success') {
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
	console.log()
	console.log(message);
	console.log("\nStatus: ERROR\n");
	process.exit(1);
}
