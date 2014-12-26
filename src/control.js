/*
	Copyright 2014 Jason Robitaille

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

		http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

// control file handler

var fs = require("fs");

if(!String.prototype.trim) {
	String.prototype.trim = function() { return this.replace(/^\s+|\s+$/g, ''); };
}

function Control(data) {
	this["Package"] = "unknown";
	this["Version"] = "1.0.0";
	this["Section"] = "misc";
	this["Priority"] = "optional";
	this["Architecture"] = "all";
	this["Description"] = "";
	this["Maintainer"] = "";
	this["Source"] = "";

	if(data) {
		var raw = data.split(/\r\n|\r|\n/);
		for(var i=0; i<raw.length; i++) {
			var index = raw[i].indexOf(":");
			if(index>=0) {
				this[raw[i].substring(0, index).trim()] = raw[i].substring(index+1).trim();
			}
		}
	}
}

Control.prototype.validPackage = function() {
	return (this["Package"]!==undefined && this["Package"].length>0);
};

Control.prototype.palmPackaged = function() {
	return (this["Description"]=="This is a webOS application."
			|| this["Maintainer"]=="N/A <nobody@example.com>");
};

Control.prototype.sourceJSON = function() {
	var obj;
	try {
		obj = JSON.parse(this["Source"]);
	} catch(e) {
		obj = undefined;
	}
	return obj;
};

Control.prototype.toJSON = function() {
	return {
		package: this["Package"],
		version: this["Version"],
		section: this["Section"],
		priority: this["Priority"],
		architecture: this["Architecture"],
		depends: (this["Depends"] || undefined),
		maintainer: this["Maintainer"],
		description: this["Description"],
		source: this.sourceJSON()
	};
};

Control.prototype.writeTo = function(output, callback) {
	var data = "Package: " + this["Package"] + "\n" +
			"Version: " + this["Version"] + "\n" +
			"Section: " + this["Section"] + "\n" +
			"Priority: " + this["Priority"] + "\n" +
			"Architecture: " + this["Architecture"] + "\n";
	if(this["Depends"]) {
		data += "Depends: " + this["Depends"] + "\n";
	}
	data += "Maintainer: " + this["Maintainer"] + "\n" +
			"Description: " + this["Description"] + "\n" +
			"Source: " + this["Source"] + "\n";
	fs.writeFile(output, data, callback);
};

module.exports = {
	create: function() {
		return new Control();
	},
	parse: function(stream, callback) {
		var data = "";
		stream.setEncoding("utf8");
		stream.on("data", function(chunk) {
			data += chunk;
		});
		stream.on("error", function(err) {
			callback(err, {});
		});
		stream.on("end", function() {
			callback(undefined, new Control(data));
		});
	}
};
