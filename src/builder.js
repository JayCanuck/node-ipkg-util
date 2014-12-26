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
	os = require("os"),
	path = require("path"),
	tar = require("tar-fs"),
	zlib = require("zlib"),
	shell = require("shelljs"),
	ar = require("ar-async"),
	appinfo = require("./appinfo.js"),
	control = require("./control.js");

var ROOT_ID = 0,
	FILE_MODE = 33188,
	DIR_MODE = 33261;

function control(opts, callback) {
	var controlPath = path.join(stage, "control")
	shell.mkdir(controlPath);
}

function loadControl(ctrl, data, webos, callback) {
	ctrl = findControlFile("control", ctrl, data);
	if(ctrl) {
		control.parse(fs.createReadStream(ctrl), function(err, cObj) {
			if(err || !webos) {
				callback(err, cObj);
			} else {
				webOSAppInfoMixin(cObj, data, callback);
			}
		});
	} else {
		if(webos) {
			webOSAppInfoMixin(control.create(), data, callback);
		} else {
			callback(undefined, control.create());
		}
	}
}

function webOSAppInfoMixin(ctrl, data, callback) {
	var appInfoPath = path.join(data, "appinfo.json");
	if(fs.existsSync(appInfoPath)) {
		appinfo.parse(fs.createReadStream(appInfoPath), function(err, aiObj) {
			if(err) {
				callback(err, aiObj);
			} else {
				if(aiObj.title) {
					ctrl["Description"] = aiObj.title;
				}
				if(aiObj.id) {
					ctrl["Package"] = aiObj.id;
				}
				if(aiObj.version) {
					ctrl["Version"] = aiObj.version;
				}
				if(aiObj.vendor) {
					ctrl["Maintainer"] = aiObj.vendor;
				}
				callback(undefined, ctrl);
			}
		});
	} else {
		callback(undefined, ctrl);
	}
}

function findControlFile(name, specified, data) {
	var result = undefined;
	if(specified && fs.existsSync(specified)) {
		result = specified;
	} else {
		var check = [path.join(data, name),
				path.join(data, "..", name)];
		for(var i=0; i<check.length; i++) {
			if(fs.existsSync(check[i])) {
				result = check[i];
				break;
			}
		}
	}
	return result;
}

function buildControl(stage, opts, callback) {
	var dir = path.join(stage, "control")
	shell.mkdir("-p", dir);
	loadControl(opts.control, opts.source, opts.webos, function(err, ctrl) {
		if(err) {
			callback(err);
		} else {
			ctrl.writeTo(path.join(dir, "control"), function(err2) {
				if(err2) {
					callback(err2);
				} else {
					var scripts = ["preinst", "postinst", "prerm", "postrm"];
					for(var i=0; i<scripts.length; i++) {
						var curr = findControlFile(scripts[i], opts[scripts[i]], opts.source);
						if(curr) {
							shell.cp("-f", curr, path.join(dir, scripts[i]));
						}
					}
					tarGz(dir, "", path.join(stage, "control.tar.gz"), function(err3, out) {
						var ipkName = ctrl["Package"] + "_" + ctrl["Version"] + "_" +
								ctrl["Architecture"] + ".ipk";
						callback(err3, out, ipkName, ctrl["Package"])
					});
				}
			});
		}
	});
}

function buildData(stage, opts, callback) {
	if(opts.webos && !opts.prefix && opts.id) {
		opts.prefix = "usr/palm/applications/" + opts.id + "/";
	} else if(opts.prefix) {
		opts.prefix = opts.prefix.replace(/\\/g, "/");
		if(opts.prefix.indexOf("/")==0) {
			opts.prefix = opts.prefix.substring(1);
		}
	} else {
		opts.prefix = "";
	}
	tarGz(opts.source, opts.prefix, path.join(stage, "data.tar.gz"), callback);
}

function tarGz(source, prefix, output, callback) {
	var pack = tar.pack(source, {
		map: function(header) {
			if(header.name!==".") {
				header.name = "./" + prefix + header.name;
			}
			header.uid = ROOT_ID;
			header.gid = ROOT_ID;
			if(header.type==='file') {
				header.mode = FILE_MODE;
			} else {
				header.mode = DIR_MODE;
			}
			return header;
		}
	});
	pack.on("error", callback)
		.pipe(zlib.createGzip())
		.on("error", callback)
		.pipe(fs.createWriteStream(output))
		.on("error", callback)
		.on("finish", function() {
			callback(undefined, output);
		})
}

function buildPackage(stage, opts, callback) {
	buildControl(stage, opts, function(err, controlTarGz, defaultIpkName, id) {
		if(err) {
			callback(err);
		} else {
			opts.id = id;
			opts.output = opts.output || defaultIpkName;
			buildData(stage, opts, function(err2, dataTarGz) {
				if(err2) {
					callback(err2);
				} else {
					var debianBinary = path.join(stage, "debian-binary");
					fs.writeFile(debianBinary, "2.0\n", function(err3) {
						if(err3) {
							callback(err3);
						} else {
							var writer = new ar.ArWriter(opts.output, {
								variant: "gnu",
								uid: ROOT_ID,
								gid: ROOT_ID,
								mode: FILE_MODE
							});
							var files = [
								debianBinary,
								controlTarGz,
								dataTarGz
							];
							if(opts["webos-postinst"] && fs.existsSync(opts["webos-postinst"])) {
								var webosPostInst = path.join(stage, "pmPostInstall.script");
								shell.cp("-f", opts["webos-postinst"], webosPostInst);
								files.push(webosPostInst);
							}
							if(opts["webos-prerm"] && fs.existsSync(opts["webos-prerm"])) {
								var webosPreRm = path.join(stage, "pmPreRemove.script");
								shell.cp("-f", opts["webos-prerm"], webosPreRm);
								files.push(webosPreRm);
							}
							writer.writeEntries(files);
							writer.on("error", callback);
							writer.on("finish", function() {
								callback(undefined, opts.output);
							});
						}
					});
				}
			});
		}
	});
}

module.exports = {
	build: function(opts, callback) {
		var tmp = os.tmpdir();
		var stage = path.join(tmp, "node-ipkg-util" + new Date().getTime());
		shell.mkdir("-p", stage);
		buildPackage(stage, opts, function(err, output) {
			shell.rm("-fr", stage);
			callback && callback(err, output);
		});
	}
};
