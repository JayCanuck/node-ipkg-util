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

// appinfo.json handler for webOS packages

var jju = require("jju");

module.exports = {
	parse: function(stream, callback) {
		var data = "";
		stream.setEncoding("utf8");
		stream.on("data", function(chunk) {
			data += chunk;
		});
		stream.on("error", function(err) {
			callback(err, {})
		});
		stream.on("end", function() {
			var obj, err;
			try {
				obj = jju.parse(data.trim());
			} catch(e) {
				obj = {};
				err = e;
			}
			callback(err, obj);
		});
	}
};
