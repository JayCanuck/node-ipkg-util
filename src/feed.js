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

var ar = require("ar-async"),
	fs = require("fs"),
	path = require("path"),
	tar = require("tar-fs"),
	zlib = require("zlib"),
	crypto = require('crypto'),
	appinfo = require("./appinfo.js"),
	control = require("./control.js");

function processIpk(out, file, callback) {
	var arEntries = [];
	var entryByName = function(name) {
		for(var i=0; i<arEntries.length; i++) {
			if(arEntries[i].fileName()==name) {
				return arEntries[i];
			}
		}
	};
	var archive = new ar.ArReader(file);
	archive.on("entry", function(entry, next) {
		arEntries.push(entry);
		next()
	});
	archive.on("error", function(err) {
		console.error(err.message);
	});
	archive.on("close", function() {
		var e1 = entryByName("control.tar.gz");
		if(!e1) {
			callback(new Error("Control archive missing in " + file));
			return;
		}
		extractInfoFile(e1.fileData(), "control", control.parse, function(ctrl) {
			if(ctrl.validPackage()) {
				if(ctrl.palmPackaged()) {
					var e2 = entryByName("data.tar.gz");
					if(!e2) {
						callback(new Error("Data archive missing in " + file));
						return;
					}
					extractInfoFile(e2.fileData(), "usr/palm/applications/" + ctrl["Package"]
							+ "/appinfo.json", appinfo.parse, function(app) {
						if(app) {
							ctrl["Description"] = app.title || ctrl["Description"];
							ctrl["Maintainer"] = app.vendor || ctrl["Maintainer"];
						}
						writePackageEntry(out, file, ctrl, callback);
					});
				} else {
					writePackageEntry(out, file, ctrl, callback);
				}
			} else {
				callback();
			}
		});
	});
};

function extractInfoFile(targz, target, parser, callback) {
	var parsed = {};
	var completed = false;
	var complete = function() {
		if(!completed) {
			completed = true;
			callback(parsed.result);
		}
	};
	targz.pipe(zlib.createGunzip())
		.pipe(tar.extract())
		.on("entry", function(header, data, next) {
			if(header.name.indexOf(target)>=0) {
				parser(data, function(err, processed) {
					parsed.result = processed;
					next();
				});
			} else {
				next();
			}
		})
		.on("error", complete)
		.on("finish", complete);
};

function writePackageEntry(out, file, ctrl, callback) {
	ctrl["Filename"] = path.basename(file);
	var rs = fs.createReadStream(file);
	var hash = crypto.createHash('md5');
	hash.setEncoding('hex');
	rs.on("end", function() {
		if(fs.existsSync("control")) {
			fs.unlinkSync("control");
		}
		hash.end();
		ctrl["MD5Sum"] = hash.read().toString("ascii");
		fs.stat(file, function(err, stat) {
			ctrl["Size"] = stat.size || 0;
			var keys = ["Package", "Version", "Section", "Architecture", "MD5Sum", "Size",
					"Filename", "Description", "Maintainer", "Source"];
			if(ctrl["Depends"]) {
				keys.splice(2, 0, "Depends");
			}
			var pkgEntry = "";
			for(var i=0; i<keys.length; i++) {
				pkgEntry += keys[i] + ": " + ctrl[keys[i]] + "\n";
			}
			pkgEntry += "\n\n";
			fs.write(out, new Buffer(pkgEntry), 0, pkgEntry.length, null, function() {
				callback();
			})
		});
	});
	rs.on("error", callback)
		.pipe(hash)
		.on("error", callback);
};

module.exports = {
	build: function(dir, callback) {
		callback = callback || function() {};
		var pkgs = path.join(dir, "Packages");
		var pkgsGz = path.join(dir, "Packages.gz");
		fs.readdir(dir, function(err, files) {
			if(err) {
				callback && callback(err);
			} else {
				var processAll = function(fd, remaining) {
					if(remaining.length<=0) {
						fs.close(fd, function() {
							var rs = fs.createReadStream(pkgs);
							var ws = fs.createWriteStream(pkgsGz);
							rs.on("error", callback)
								.pipe(zlib.createGzip())
								.on("error", callback)
								.pipe(ws)
								.on("error", callback)
								.on("finish", function() {
									callback(undefined, pkgs, pkgsGz);
								});
						});
					} else {
						var curr = remaining.shift();
						if(path.extname(curr)==".ipk") {
							processIpk(fd, path.join(dir, curr), function(err3) {
								if(err3) {
									callback(err3);
								} else {
									processAll(fd, remaining);
								}
							});
						} else {
							processAll(fd, remaining);
						}
					}
				};
				fs.open(pkgs, "w", function(err2, fd) {
					if(err2) {
						callback(err2);
					} else {
						processAll(fd, files);
					}
				});
			}
		});
	}
};
