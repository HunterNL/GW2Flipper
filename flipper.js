(function(){ //Module pattern

var API_ENTRY = "http://www.gw2spidy.com/api/";
var TEST_DATA_URL = localStorage["test_url"] || "www.example.com/test_data.json";
var USE_TEST_DATA = true;
var SHOW_IMAGES = true;

//Formats nice url for API call
function buildURL(format, version) {
	version = version || "v0.9";
	format = format || "json";
	var url = encodeURI(API_ENTRY + version + "/" + format + "/all-items/*all*");
	return url;
}

//Start getting data, tries localStorage first, otherwise gets new data
function initData(forceNewRequest) {
	if (forceNewRequest) {
		requestData();
	} else {
		var items = loadList();
		if (typeof items != "undefined") {
			calcAdditionData(items);
			items.sort(profitSorter);
			fillPage(items);
		} else {
			requestData(); //If we didn't load anything, request fresh data
		}
	}
}

//Gets new data from remote location
function requestData() {
	console.log("Requesting new data");

	if (USE_TEST_DATA) {
		$.get(TEST_DATA_URL,onDataReceive);
	} else {
		$.get(buildURL(),onDataReceive);
	}
}

//Makes an element to display gold nicely
function createGoldCounter(count,tag) {
	function appendCoin(min_count,img_src) {
		var img = document.createElement("img");
		img.src = img_src;
		element.appendChild(img);


		var roundedcount=Math.floor(count/min_count)%100;
		var text = document.createElement("p");
		text.appendChild(document.createTextNode(roundedcount));
		element.appendChild(text);
	}

	tag = tag || "div";

	var element = document.createElement(tag);
	element.className = "gold_counter";

	if (count >= 10000) {
		appendCoin(10000,"gold.png");
	}
	if (count >= 100) {
		appendCoin(100,"silver.png");
	}
	appendCoin(1,"copper.png");


	return element;
}

//Helper for appendLegend and appendItems
function appendData(parent,data) {
	var div = document.createElement("div");
	div.appendChild(document.createTextNode(data));
	parent.appendChild(div);
}

//Goes over every child node and removes it
function emptyElement(element) {
	while(element.hasChildNodes()) {
		element.removeChild(element.firstChild);
	}
}

function createBaseTable(baseTable) {
	var table = baseTable || document.createElement("table");
	var thead = document.createElement("thead");
	var item_legend = [
		"ID",
		"Name",
		"Lowest seller",
		"Highest buyer",
		"Buyer count",
		"Seller count",
		"Profit",
		"Profit %"
	];

	if(SHOW_IMAGES) {
		item_legend.unshift("");
	}


	item_legend.forEach(function(text){
		var td = document.createElement("td");
		var tn = document.createTextNode(text);
		td.appendChild(tn);
		thead.appendChild(td);
	});
	table.appendChild(thead);

	return table;
}

//Main function, refreshes all elements on the page with itemdata
function fillPage(itemdata) {
	if(!itemdata || itemdata.length === 0) {
		throw new Error("fillPage called without itemdata");
	}

	console.log("Filling page with data: ",itemdata);

	var container = document.getElementById("datacontainer");

	emptyElement(container);

	var table = createBaseTable(container);
	appendItems(table,itemdata);
	//TODO Use documentFragment?

	//appendLegend(container)

	updateTimeText();
}

//Add new elements to the container from itemdata
function appendItems(container,itemdata) {

	function appendData(data) {
		var td = document.createElement("td");
		var tn = document.createTextNode(data);
		td.appendChild(tn);
		tr.appendChild(td);
	}

	for(var i=0;i<itemdata.length;i++) {
		var item = itemdata[i];
		var tr = document.createElement("tr");

		if(SHOW_IMAGES) {
			var td=document.createElement("td");
			var img = new Image(32,32);
			img.src = item.img;
			td.appendChild(img);
			tr.appendChild(td);

		}

		appendData(item.data_id);
		appendData(item.name);

		tr.appendChild(createGoldCounter(item.min_sale_unit_price,"td"));
		tr.appendChild(createGoldCounter(item.max_offer_unit_price,"td"));

		appendData(item.offer_availability);
		appendData(item.sale_availability);

		tr.appendChild(createGoldCounter(item.profit,"td"));
		appendData(Math.round((item.profit/item.min_sale_unit_price)*100)+"%");

		container.appendChild(tr);
	}

}


function calcAdditionData(data) {
	function calculateAdditionItemData(item) {
		item.profit = item.min_sale_unit_price* 0.85 - item.max_offer_unit_price;
		//item.profit_percentage = Math.round((item.profit/item.min_sale_unit_price)*100)
		item.profit_percentage = Math.round((item.profit/item.max_offer_unit_price)*100);
	}

	data.forEach(function(entry) {
		calculateAdditionItemData(entry);
	});
}

function getSavedTime() {
	return localStorage["update_timestamp"];
}

var data_item_members = [
	"data_id",
	"img",
	"max_offer_unit_price",
	"min_sale_unit_price",
	"name",
	"offer_availability",
	"price_last_changed",
	"rarity",
	"sale_availability"
];

//Takes array with items, turns object into array without named keys, runs lz-string compression
//Returns new data without affecting origional
function compressData(data) {
	var arrayData = []; //New array for arrayified data

	for(var i =0;i<data.length;i++) {
		var objArray = []; //Array for single item

		for(var o=0;o<data_item_members.length;o++) {
			//For every member in item obj, push it to the new aray
			objArray.push(data[i][data_item_members[o]]);
		}
		arrayData.push(objArray);
	}

	var jsonString = JSON.stringify(arrayData);
	var compressedString = LZString.compress(jsonString);

	console.log("Saved data size : \nUncompressed:\t"+jsonString.length+"\nCompressed:\t"+compressedString.length);

	return compressedString;
}

//As above, but in reverse
function deCompressData(string) {
	var jsonString = LZString.decompress(string);
	var jsonData = JSON.parse(jsonString);

	var data = [];

	for(var i=0;i<jsonData.length;i++) {
		var obj = {};
		var oldArray = jsonData[i];

		for(var o=data_item_members.length-1;o>=0;o--){
			obj[data_item_members[o]]=oldArray.pop();
		}
		data.push(obj);
	}

	return data;
}

//Saves JSON data to localStorage
function saveList(list) {
	console.log("Saving filtered data");

	var compressedData = compressData(list);

	try  {
		localStorage["gw2_items"] = compressedData;
		localStorage["update_timestamp"] = Date.now();
	} catch(e) {
		if(e.name && e.name == "QuotaExceededError") { //https://developer.mozilla.org/en/docs/Web/API/DOMException .name is prefered over .code
			console.error("localStorage quota exceeded");
		} else {
			console.error("Unable to save");
		}
	}
}

//Loads localStorage data and parses to JSON, returns nothing if not found
function loadList() {
	var local_data = localStorage["gw2_items"];

	if(local_data) {
		console.log("Loading stored data");
		var new_data = deCompressData(local_data);
		return new_data;
	}
}

function filterNoPriceItem(item) {
	return ((item.min_sale_unit_price > 20) && (item.max_offer_unit_price > 20));
}

function filterLowMarketItem(item) {
	return (item.offer_availability + item.sale_availability > 2000) &&
	(item.offer_availability > 500) &&
	(item.sale_availability > 500);
}

function profitSorter(a,b) {
	return b.profit_percentage - a.profit_percentage;
}

function condenseArray(data) {
	data = data.filter(function(element) {
		return element !== undefined && element !== null;
	});
}


//Get rid of properties we're not going to use
function dataStrip(data) {
	for(var i = 0;i<data.length;i++) {
		var item = data[i];
		delete item.offer_price_change_last_hour;
		delete item.sale_price_change_last_hour;
		delete item.restriction_level;
		delete item.sub_type_id;
		delete item.type_id;
	}
}

//Called by either data retrieving function
function onDataReceive(data) {
	console.log("Received new data!");
	if(typeof data === "string") {
		data = JSON.parse(data).results;
	} else {
		data = data.results;
	}

	condenseArray(data);
	dataStrip(data);

	data = data.filter(filterNoPriceItem);
	data = data.filter(filterLowMarketItem);

	saveList(data);

	calcAdditionData(data);
	data.sort(profitSorter);

	fillPage(data);
}

//Adds listener to force update button
function setupButton() {
	var button = document.getElementById("updateItemButton");
	if(USE_TEST_DATA) {
		button.className +=" using_test_data";
	}

	button.addEventListener("click", function(event) {
		initData(true);
	});
}

//Updates(or creates) the timer text
function updateTimeText() {
	function getChildTextNode(em) {
		if (em.firstChild) {
			return em.firstChild;
		} else {
			var text = document.createTextNode("");
			em.appendChild(text);
			return text;
		}
	}

	var em = document.getElementById("update_timer");
	var last_update_time = getSavedTime();
	var textnode = getChildTextNode(em);

	if (typeof last_update_time != "undefined") {
		//We have a saved update time
		var secondsSinceUpdate = (Date.now() - last_update_time) / 1000;
		textnode.nodeValue = Math.floor(secondsSinceUpdate);
	} else {
		console.error("No saved time");
	}
}

//TODO: Make me an event listener
window.addEventListener("load",function() {
	setupButton();

	initData();
});

}()); //module pattern end
