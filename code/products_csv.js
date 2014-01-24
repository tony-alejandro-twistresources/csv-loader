var csv = require("csv"),
	fs = require("fs"),
	request = require('request');	
	

exports.load = function(host, accessToken, sourceId, csvfile) {
	
	console.log("categoryMap_csv.load(" + host + ". " + accessToken + ", " + sourceId + ", " + csvfile + ")");
	var credentials = {
		host : host,
		accessToken : accessToken,
		sourceId : sourceId
	}
	ProductLoader.execute(credentials, csvfile);
}

var ProductLoader = {

	headers : [ 'Name', 'Price', 'Weight', 'Manufacturer', 'Sku',
  				'Summary', 'Description', 'Categories', 'ImageUrl',
  				'Sub_ImageUrl', 'option' ],
	categoryMap : [],
	categoryIdMap : [],
	varianceMap :[],
	products : [],
	
	/**
	*	Entry point for the product loader
	*/
  	execute : function(credentials, csvfile){

  		functions = [
  		/* Step 1 */	function(next){ProductLoader.validate(csvfile, next)},
  		/* Step 2 */	function(next){ProductLoader.initializeCategoryMapping(next)},
  		/* Step 3 */	function(next){ProductLoader.initializeVarianceMapping(next)},
  		/* Step 4 */	function(next){ProductLoader.initializeCategoryIdMapping(credentials, next)},
  		/* Step 5 */	function(next){ProductLoader.parseDetails(credentials, csvfile, next)},
  		/* Step 6 */	function(next){ProductLoader.persist(credentials, next)}
  					];
  		/**
  		*	Facilitates running the functions synchronously.
  		*/
  		function next() {
		    var fn = functions.shift();
		    if(fn) {
			    fn(function() {
					next();
				});
		    } else {
		    	console.log("Processing completed.");
			}
		}
		next();
  	}, // end execute method


  	/**
  	*	Checks that the csv file is in the correct format.
  	*/
	validate : function(csvfile, next){

		console.log("Pass 1: Validation")
		var stream = fs.createReadStream(csvfile);
		stream.on('error', function (error) {console.log("Caught", error);bomb('CSV file error.')});

		// Verify each line of the CSV file
		var count = 0;
		var lineErrors = "";
		
		csv()
		.from.stream(stream, { delimiter: ',', escape: '"' })
		.on('record', function(row){
			if(count++ === 0){
				for (var i = 0; i < row.length; i++) {
					if( ProductLoader.headers[i] == undefined || ProductLoader.headers[i] != row[i] ) {
						lineErrors += "File headers should be: " + headers + "\n";
					} 
				};
			} else {
				if(row.length != ProductLoader.headers.length){
					lineErrors += "Line " + count + " currently has " + row.length + 
								  " columns. Proper format requires " + ProductLoader.headers.length + " columns.\n";
				}
			}
		})
		.on('end', function(count){
			console.log("Done reading csv file with " + count + " records.");
			if( lineErrors != ""){
				bomb(lineErrors.substr(0, lineErrors.length - 1));
			}
			next();
		})
		.on('error', function(err){
			console.log("Pass 1: Error encountered: " + err);
		});

	}, // end validate method

	/**
	*	Loads the csv file that contains the mapping of Dropshipper categories
	*	to Metrosix categories and places it in a property map.
	*/
	initializeCategoryMapping : function (next){

		console.log("Retrieving Dropshipper -> Metrosix category mapping.");
		var stream = fs.createReadStream("./code/category-mapping.csv");
		stream.on('error', function (error) {console.log("Caught", error);bomb('CSV file error.')});

		var categoryMap = [];

		csv()
		.from.stream(stream, {columns: true})
		.on('record', function(category){
			categoryMap[category.from] = category.to;	
		})
		.on('end', function(count){
			console.log("Done reading csv file with " + count + " categories.");
			ProductLoader.categoryMap = categoryMap;
			next();
		})
		.on('error', function(err){
			console.log("Dropshipper -> Metrosix Category Mapping: Error encountered: " + err);
		});

	},// end initializeCategoryMapping

	/**
	*	Loads the csv file that contains the mapping of variances
	*	and places it in a property map.
	*/
	initializeVarianceMapping : function (next){

		console.log("Retrieving variance mapping.");
		var stream = fs.createReadStream("./code/variance-mapping.csv");
		stream.on('error', function (error) {console.log("Caught", error);bomb('CSV file error.')});

		var varianceMap = [];

		csv()
		.from.stream(stream, {columns: true})
		.on('record', function(variantInfo){
			varianceMap[(variantInfo.Variance + "").toLowerCase()] = variantInfo.Type;	
		})
		.on('end', function(count){
			console.log("Done reading csv file with " + count + " variances.");
			ProductLoader.varianceMap = varianceMap;
			next();
		})
		.on('error', function(err){
			console.log("Variance Mapping: Error encountered: " + err);
		});

	},// end initializeVarianceMapping


	/**
	*	Loads the category IDs from Tea /getParentCategories
	*	and places it in a property map.
	*/
	initializeCategoryIdMapping : function (credentials, next){

		console.log("Retrieving Metrosix Category ID mapping.");
		
		var categoryIds = [];

		var url = 'http://' + credentials.host + '/getParentCategories';
		var json = {
			accessToken : credentials.accessToken
		}

		request.apply(this, [{
			method: 'POST',
			url: url,
			json: json },
			function (error, response, body) {
				if (error) {
			        bomb("Unexpected error: ", error);
				} else if (response.statusCode != 200) {
			        bomb("Unexpected status code " + response.statusCode);
				} else {
					if(body == undefined || body.response == "Error"){
						bomb("Failed to retrieve category IDs.")
					}
					for (var i = body.categories.length - 1; i >= 0; i--) {
						categoryIds[body.categories[i].name.trim()] = body.categories[i].category_id;
					};
					ProductLoader.categoryIdMap = categoryIds;
					console.log("Category IDs successfully loaded.")
					next();
				}
			}
		]);

	},

	/**
	*	Loads the products from the dropshipper's csv file onto a
	*	a property array.
	*/
	parseDetails : function(credentials, csvfile, next){
		console.log("Pass 2: Load Details")
		var stream = fs.createReadStream(csvfile);
		stream.on('error', function (error) {console.log("Caught", error);bomb('CSV file error.')});

		// Load csv file rows into a map
		var count = 0;
		var item = {};
		var products = [];
		var lineErrors = "";

		csv()
		.from.stream(stream, { columns : true })
		.on('record', function(item){
			ProductLoader.insertVariant(products, ProductLoader.createVariant(item));
		})
		.on('end', function(count){
			console.log("Done reading csv file with " + count + " products in " + products.length + " categories.");
			ProductLoader.products = products;
			next();
		})
		.on('error', function(err){
			console.log("Pass 2: Error encountered: " + err);
		});

	},// end load method

	/**
	*	Saves the products into the database using webservices.
	*/
	persist : function(credentials, next){

		console.log("Pass 3: Upload to TEA")
	
		var url = 'http://' + credentials.host + '/loadProducts';
		var json = {
			accessToken : credentials.accessToken,
			products: ProductLoader.products 
		};

		request({
			method: 'POST',
			url: url,
			json: json
		}, function (error, response, body) {

			if (error) {
		        bomb("Unexpected error: ", error);
			} else if (response.statusCode != 200) {
		        bomb("Unexpected status code " + response.statusCode);
			} else {
				if (body === undefined || body.response !== 'Success') {
					bomb('ERROR: response="' + body.response + '", message="' + body.message + '"');
				} else {
					console.log("Successfully saved products.");
				}
				next();
			}
		});

	},// end persist method


	/**
	*	Creates a variant JSON object using details from the items
	*	retrieved from the csv file.
	*/
	createVariant: function(item){
		
		var variant = {
			categoryId : ProductLoader.categoryIdMap[ProductLoader.categoryMap[item.Categories]],
			product  : {
				name : item.Name,
				short_description : item.Summary,
				long_description : item.Description,
				sku : item.Sku,
				cost_price : item.Price,
				weight : item.Weight,
				variant_value : item.option,
				variant_type : ProductLoader.varianceMap[(item.option + "").toLowerCase()],
				image : {
					image_type : ProductLoader.getImageExtension(item.ImageUrl),
					image_path : item.ImageUrl,
					image_name : ProductLoader.getImageName(item.ImageUrl)
				}
			}
		}
		return variant;
	}, // end createVariant method


	/**
	*	Places items under categories for more efficient storage during
	*	persist stage.
	*/
	insertVariant : function(categories, itemVariant){
		var categoryIndex = ProductLoader.findInList(categories, itemVariant.categoryId);
		if( categoryIndex != -1 ){ // item's category was found
			var productIndex = ProductLoader.findInList(categories[categoryIndex].products, itemVariant.product.name);
			if( productIndex != -1 ){ // item product was found
				categories[categoryIndex].products[productIndex].variants.push(itemVariant);
			} else { // add a new product under this category
				categories[categoryIndex].products.push({
					id : itemVariant.product.name,
					variants : [itemVariant]
				});
			} 
		} else { // add a new category with this item as the first product variant
			// uncomment if products with no category will not be uploaded.
			//if(itemVariant.categoryId == undefined){
			//	console.log("Item : " + itemVariant.product.name + " will not be uploaded since it does not have a category.");
			//} else {
				categories.push({
					id : itemVariant.categoryId,
					products : [{
						name : itemVariant.product.name,
						variants : [itemVariant]
					}]
				});
			//}
		}
	}, // end insertVariant method

	/**
	*	Parses the imageUrl provided for the file extension
	*/
	getImageExtension : function(imageUrl){
		if(imageUrl != undefined && imageUrl.length > 0 && imageUrl.lastIndexOf(".") != -1){
			return imageUrl.substr(imageUrl.lastIndexOf(".") + 1);
		}
	},

	/**
	*	Parses the imageUrl provided for the file name
	*/
	getImageName : function(imageUrl){
		if(imageUrl != undefined && imageUrl.length > 0 && imageUrl.lastIndexOf("/") != -1){
			return imageUrl.substring(imageUrl.lastIndexOf("/") + 1, imageUrl.lastIndexOf("."));
		}
	},

	/**
	*	Convenience method for locating an object in a list using
	*	its id property.
	*/
	findInList : function(list, id){
		for (var i = list.length - 1; i >= 0; i--) {
			if(list[i].id === id) return i;
		}
		return -1;
	},

	/**
	 *	Write out a message, and exit with error status
	 */
	bomb : function(message) {
		console.log(message);
		console.log("\nStatus: ERROR\n");
		process.exit(1);
	} // end bomb method

}

