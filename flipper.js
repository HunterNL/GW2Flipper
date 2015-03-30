(function(){ //Module pattern

var API_ENTRY = "http://www.gw2spidy.com/api/"
var TEST_DATA_URL = localStorage["test_url"] || "www.example.com/test_data.json"
var USE_TEST_DATA = true
var SHOW_IMAGES = false

//Formats nice url for API call
function buildURL(format, version) {
	version = version || "v0.9"
	format = format || "json"
	var url = encodeURI(API_ENTRY + version + "/" + format + "/all-items/*all*");
	return url;
}

//Start getting data, tries localStorage first, otherwise gets new data
function initData(forceNewRequest) {
	if (forceNewRequest) {
		requestData()
	} else {
		var items = loadList()
		if (typeof items != "undefined") {
			calcAdditionData(items);
			items.sort(profitSorter);
			fillPage(items)
		} else {
			requestData() //If we didn't load anything, request fresh data
		}
	}
}

//Gets new data from remote location
function requestData() {
	console.log("Requesting new data")
	
	if (USE_TEST_DATA) {
		$.get(TEST_DATA_URL,onDataReceive)
	} else {
		$.ajax({
			url: buildURL(),
			dataType : "jsonp",
			succes : onDataReceive
		})
	}

}

//Makes an element to display gold nicely
function createGoldCounter(count,tag) {
	function appendCoin(min_count,img_src) {
		var img = document.createElement("img")
		img.src = img_src
		element.appendChild(img) 
		
		
		var roundedcount=Math.floor(count/min_count)%100
		var text = document.createElement("p")
		text.appendChild(document.createTextNode(roundedcount))
		element.appendChild(text)
	}
	
	
	tag = tag || "div"
	
	var element = document.createElement(tag)
	element.className = "gold_counter"
	
	if (count >= 10000) {
		appendCoin(10000,"gold.png")
	}
	if (count >= 100) {
		appendCoin(100,"silver.png")
	}	
	appendCoin(1,"copper.png")
	
	/*
	if (count > 9999) {
		var gold = Math.round(gold/10000)
		element.appendChild(document.createElement(img).src="gold.png")
		element.appendChild(document.createTextNode(gold)
	}
	*/
	
	return element
}

//Adds the legend to container
function appendLegend(container) {
	
	var div = document.createElement("div")
	
	if (SHOW_IMAGES) {
		var fakeimg = document.createElement("div")
		fakeimg.className = "item_img"
		div.appendChild(fakeimg)
	}
	
	appendData(div,"ID")
	appendData(div,"Name")
	appendData(div,"Lowest seller")
	appendData(div,"Highest buyer")
	appendData(div,"Buyer count")
	appendData(div,"Seller count")
	appendData(div,"Profit")
	appendData(div,"Profit %")
	
	//container.appendChild(div)
	$('#datacontainer').prepend(div);
	//$('#datacontainer').children().first().before(div);
}

//Helper for appendLegend and appendItems
function appendData(parent,data) {
	var div = document.createElement("div")
	div.appendChild(document.createTextNode(data))
	parent.appendChild(div)
}

//Goes over every child node and removes it
function emptyElement(element) {
	while(element.hasChildNodes()) {
		element.removeChild(element.firstChild)
	}
}

//Main function, refreshes all elements on the page with itemdata
function fillPage(itemdata) {
	if(!itemdata || itemdata.length === 0) {
		throw new Error("fillPage called without itemdata")
	}
	var container = document.getElementById("datacontainer")
	
	emptyElement(container)
	
	appendLegend(container)
	appendItems(container,itemdata)
	updateTimeText()
}

//Add new elements to the container from itemdata
function appendItems(container,itemdata) {
	container.style.display="block"
	
	itemdata.forEach(function(entry) {
		var div = document.createElement("div")
		
		if (SHOW_IMAGES) {
			var img = document.createElement("img")
			img.src=entry.img
			img.className = "item_img"
			div.appendChild(img)
		}
		
		//0.85 is 15% transaction cost (kinda decprecated with item.profit)
		var profit = entry.min_sale_unit_price*.85 - entry.max_offer_unit_price
		
		appendData(div,entry.data_id) //ID
		appendData(div,entry.name) //Name
		
		div.appendChild(createGoldCounter(entry.min_sale_unit_price)) //Sell price
		div.appendChild(createGoldCounter(entry.max_offer_unit_price)) //Buy price
		
		function loground(x) {
			return Math.round((Math.log(x)/Math.LN10)*10)/10
		}
		
		appendData(div,loground(entry.offer_availability)) //Buyer count
		appendData(div,loground(entry.sale_availability)) //Seller count

		div.appendChild(createGoldCounter(profit)) //Profit
		
		appendData(div,Math.round((profit/entry.min_sale_unit_price)*100)+"%") //Profit %
		
		container.appendChild(div)
	})
}


function calcAdditionData(data) {
	function calculateAdditionItemData(item) {
		item.profit = item.min_sale_unit_price*.85 - item.max_offer_unit_price
		//item.profit_percentage = Math.round((item.profit/item.min_sale_unit_price)*100)
		item.profit_percentage = Math.round((item.profit/item.max_offer_unit_price)*100)
	}
	
	data.forEach(function(entry) {
		calculateAdditionItemData(entry)
	})
}


//Takes the full 10MB list of items and and array with itemID's
function filterArrayWithArray(fullItemList,array) {
	var array = valueToKey(array)

	var filtered_data = []
	fullItemList.forEach(function(entry) {
		if (typeof array[entry.data_id] != "undefined") {
			filtered_data[entry.data_id]=entry
		}
	})
	return filtered_data
}

//Both these functions are aids for parsing non *fancyword* arrays with JSON
//JSON doesn't like [1,2,9000001] and will go over localStorage limit
function arrayToObj(array) {
	var obj = {}
	for (key in array)	{
		if (array.hasOwnProperty(key)) {
			obj[key]=array[key]
		}
	}
	return obj
}

//See arrayToObj above
function objToArray(obj) {
	var array = []
	for (key in obj) {
		if (obj.hasOwnProperty(key)) {
			array[key]=obj[key]
		}
	}
	return array
}


function getSavedTime() {
	return localStorage["update_timestamp"]
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
]

//Takes array with items, turns object into array without named keys, runs lz-string compression
//Returns new data without affecting origional 
function compressData(data) {
	var arrayData = [] //New array for arrayified data
	
	for(var i =0;i<data.length;i++) {
		var objArray = [] //Array for single item
		
		for(var o=0;o<data_item_members.length;o++) {
			//For every member in item obj, push it to the new aray
			objArray.push(data[i][data_item_members[o]])
		}
		arrayData.push(objArray)
	}
	
	/*
	for(var o=0;o<9;o++) {
		console.log("o now ",o)
		for(var i=0;i<arrayData.length;i++) {
			console.log(typeof arrayData[i][o])
		}
	}
	*/
	
	var jsonString = JSON.stringify(arrayData)
	var compressedString = LZString.compress(jsonString)
	
	console.log("Saved data size : \nUncompressed:\t"+jsonString.length+"\nCompressed:\t"+compressedString.length)
	
	return compressedString
}

//As above, but in reverse
function deCompressData(string) {
	var jsonString = LZString.decompress(string)
	var jsonData = JSON.parse(jsonString)
	
	var data = []
	
	for(var i=0;i<jsonData.length;i++) {
		var obj = {}
		var oldArray = jsonData[i]
		
		for(var o=data_item_members.length-1;o>=0;o--){
			obj[data_item_members[o]]=oldArray.pop()
		}
		data.push(obj)
	}
	/*
	for(var o=0;o<9;o++) {
		console.log("o now ",o)
		for(var i=0;i<data.length;i++) {
			console.log(typeof data[i][data_item_members[o]])
		}
	}
	*/
	
	return data
}

//Saves JSON data to localStorage
function saveList(list) {
	console.log("Saving filtered data")
	
	var compressedData = compressData(list)
	
	try  {
		localStorage["gw2_items"] = compressedData
		localStorage["update_timestamp"] = Date.now()
	} catch(e) {
		if(e.name && e.name == "QuotaExceededError") { //https://developer.mozilla.org/en/docs/Web/API/DOMException .name is prefered over .code
			console.error("localStorage quota exceeded")
		} else {
			console.error("Unable to save")
		}
	}
}

//Loads localStorage data and parses to JSON, returns nothing if not found
function loadList() {
	var local_data = localStorage["gw2_items"]
	
	if(local_data) {
		console.log("Loading stored data")
		var new_data = deCompressData(local_data)
		return new_data
	}
}

function filterNoPriceItem(item) {
	return ((item.min_sale_unit_price > 20) && (item.max_offer_unit_price > 20))
}

function filterLowMarketItem(item) {
	return (item.offer_availability + item.sale_availability > 2000) && 
	(item.offer_availability > 500) &&
	(item.sale_availability > 500)
}

function profitSorter(a,b) {
	return b.profit_percentage - a.profit_percentage
}

function condenseArray(data) {
	data = data.filter(function(element) {return element !== undefined && element !== null})
}


//Get rid of properties we're not going to use
function dataStrip(data) {
	for(var i = 0;i<data.length;i++) {
		var item = data[i]
		delete item.offer_price_change_last_hour
		delete item.sale_price_change_last_hour
		delete item.restriction_level
		delete item.sub_type_id
		delete item.type_id
	}
}

//Called by either data retrieving function
function onDataReceive(data) {
	var data = JSON.parse(data).results
	//var data = filterArrayWithArray(data,watchlist)
	
	condenseArray(data);
	dataStrip(data);
	
	//console.log(data);
	
	data = data.filter(filterNoPriceItem);
	data = data.filter(filterLowMarketItem);
	
	saveList(data);
	
	calcAdditionData(data);
	data.sort(profitSorter);
	
	fillPage(data);
}

//Helper for filtering
// [123,456,789] -> r[123]==true r[456]==true r[789] == true
function valueToKey(oldArray) {
	var newArray = []
	oldArray.forEach(function(entry) {
		newArray[entry]=true
	})
	return newArray
}

//Adds listener to force update button
function setupButton() {
	var button = document.getElementById("updateItemButton")
	button.addEventListener("click", function(event) {
		initData(true)
	})
}

//Updates(or creates) the timer text
function updateTimeText() {
	function getChildTextNode(em) {
		if (em.firstChild) {
			return em.firstChild
		} else {
			var text = document.createTextNode("")
			em.appendChild(text)
			return text
		}
	}
	
	var em = document.getElementById("update_timer")
	var last_update_time = getSavedTime()
	var textnode = getChildTextNode(em)
	
	if (typeof last_update_time != "undefined") {
		//We have a saved update time
		var secondsSinceUpdate = (Date.now() - last_update_time) / 1000
		textnode.nodeValue = Math.floor(secondsSinceUpdate)
	} else {
		console.error("No saved time")
	}
}

//TODO: Make me an event listener
window.addEventListener("load",function() {
	setupButton()
	
	appendLegend(document.getElementById("datacontainer"))
	
	initData()
})

}()) //module pattern end
